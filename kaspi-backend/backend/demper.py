# demper.py
# nohup python3 demper.py > demper.log 2>&1 &
import asyncio
import logging
import random
import time
from decimal import Decimal

from supabase import create_client, Client

from api_parser import parse_product_by_sku, sync_product, sync_store_api  # ваши функции
from db import create_pool

logging.getLogger("postgrest").setLevel(logging.WARNING)

# Если используются httpx / urllib3 — тоже понизить им уровень
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("urllib3").setLevel(logging.WARNING)
for lib in ("supabase", "httpx", "httpcore", "urllib3", "postgrest", "gotrue"):
    lg = logging.getLogger(lib)
    lg.setLevel(logging.WARNING)
    lg.propagate = False

MAX_CONCURRENT_TASKS = 100
semaphore = asyncio.Semaphore(MAX_CONCURRENT_TASKS)


class NoHttpRequestFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        # пропускаем всё, кроме сообщений, начинающихся с "HTTP Request"
        return not record.getMessage().startswith("HTTP Request:")


logging.getLogger().addFilter(NoHttpRequestFilter())
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    handlers=[logging.FileHandler("price_worker.log", encoding="utf-8"), logging.StreamHandler()]
)
logger = logging.getLogger("price_worker")


# добавляем фильтр на уровень корневого логгера


async def process_product(product, clogger, pool):
    """Обрабатывает данные о продукте и обновляет цену в базе данных Supabase"""
    start_time = time.time()
    
    async with semaphore:
        product_id = product["id"]
        product_external_id = product["external_kaspi_id"]
        sku = product["kaspi_sku"]
        current_price = Decimal(product["price"])
        min_profit = Decimal(product['min_profit']) if product['min_profit'] else Decimal('0.00')
        max_profit = Decimal(product['max_profit']) if product.get('max_profit') else None
        price_step = Decimal(product.get('price_step', '1.00'))  # Шаг изменения цены, по умолчанию 1 тенге
        
        try:
            # Получаем данные о предложениях конкурентов
            product_data = await parse_product_by_sku(str(product_external_id))
            
            if product_data and len(product_data):
                # Собираем все цены конкурентов
                competitor_prices = [Decimal(offer["price"]) for offer in product_data]
                min_offer_price = min(competitor_prices)
                max_offer_price = max(competitor_prices)
                
                # Получаем историю цен продукта
                async with pool.acquire() as connection:
                    price_history = await connection.fetch(
                        """
                        SELECT price, created_at
                        FROM price_history
                        WHERE product_id = $1
                        ORDER BY created_at DESC
                        LIMIT 10
                        """,
                        product_id
                    )
                
                previous_price = price_history[1]['price'] if len(price_history) > 1 else current_price
                
                # Анализ рынка
                market_analysis = {
                    'avg_price': sum(competitor_prices) / len(competitor_prices),
                    'median_price': sorted(competitor_prices)[len(competitor_prices) // 2],
                    'price_range': max_offer_price - min_offer_price,
                    'competitors_count': len(competitor_prices)
                }
                
                # Проверяем условия изменения цены
                new_price = None
                
                # Сценарий 1: Конкурент ушел ниже минимальной прибыли
                if min_offer_price < min_profit and max_profit:
                    new_price = max_profit
                    clogger.info(f"[{sku}] Конкурент ушел ниже минимальной прибыли ({min_offer_price}). Поднимаем цену до {new_price}")
                
                # Сценарий 2: Все конкуренты подняли цены
                elif all(price > current_price for price in competitor_prices):
                    target_price = min_offer_price - price_step
                    if target_price > current_price:  # Проверяем, что новая цена действительно выше текущей
                        new_price = min(target_price, max_profit or target_price)
                        clogger.info(f"[{sku}] Конкуренты подняли цены. Поднимаем с {current_price} до {new_price}")
                
                # Сценарий 3: Стандартный демпинг
                elif current_price > min_offer_price + price_step:
                    target_price = min_offer_price - price_step
                    if target_price >= min_profit:  # Проверяем, что новая цена не ниже минимальной прибыли
                        new_price = target_price
                        clogger.info(f"[{sku}] Снижаем цену для конкуренции с {current_price} до {new_price}")
                
                # Проверка граничных условий
                if new_price is not None:
                    # Проверка минимальной прибыли
                    if new_price < min_profit:
                        new_price = min_profit
                        clogger.info(f"[{sku}] Цена скорректирована до минимальной прибыли: {new_price}")
                    
                    # Проверка максимальной прибыли
                    if max_profit and new_price > max_profit:
                        new_price = max_profit
                        clogger.info(f"[{sku}] Цена скорректирована до максимальной прибыли: {new_price}")
                    
                    # Анализ резких изменений цены
                    price_change_percent = ((new_price - current_price) / current_price) * 100
                    if abs(price_change_percent) > 20:  # Если изменение больше 20%
                        clogger.warning(f"[{sku}] Внимание! Резкое изменение цены на {price_change_percent:.2f}%")

                # Синхронизация с базой данных
                sync_result = await sync_product(product_id, new_price)

                if sync_result.get('success'):
                    # Обновляем цену продукта и сохраняем в историю
                    async with pool.acquire() as connection:
                        await connection.execute(
                            """
                            UPDATE products
                            SET price = $1
                            WHERE id = $2
                            """,
                            int(new_price), product_id
                        )
                        
                        # Получаем последнюю запись о потерях
                        last_loss = await connection.fetchrow(
                            """
                            SELECT cumulative_loss
                            FROM price_history
                            WHERE product_id = $1
                            ORDER BY created_at DESC
                            LIMIT 1
                            """,
                            product_id
                        )
                        
                        # Рассчитываем потери от демпинга
                        price_decrease = int(current_price) - int(new_price) if new_price < current_price else 0
                        cumulative_loss = (last_loss['cumulative_loss'] if last_loss else 0) + price_decrease
                        
                        # Определяем причину изменения
                        if price_decrease > 0:
                            change_reason = 'demping_decrease'
                        elif new_price > current_price:
                            change_reason = 'price_increase'
                        else:
                            change_reason = 'no_change'
                        
                        # Сохраняем историю изменения цены с информацией о потерях
                        await connection.execute(
                            """
                            INSERT INTO price_history 
                            (product_id, price, created_at, price_decrease, cumulative_loss, change_reason)
                            VALUES ($1, $2, NOW(), $3, $4, $5)
                            """,
                            product_id, int(current_price), price_decrease, cumulative_loss, change_reason
                        )
                        
                    clogger.info(f"Демпер: Успешно обновлена цена [{sku}] -> {new_price}")
            else:
                clogger.warning(f"Конкурентов нет [{sku}]")
        except Exception as e:
            clogger.error(f"Ошибка при обработке продукта [{sku}]: {e}")
            # traceback.print_exc()
        # Пауза для имитации случайной задержки между запросами
        await asyncio.sleep(random.uniform(0.1, 0.3))

    elapsed_time = time.time() - start_time
    clogger.info(f"Время обработки продукта [{product['kaspi_sku']}]: {elapsed_time:.2f} секунд")


async def fetch_products(pool):
    """Асинхронно извлекает список продуктов из базы данных Supabase через пул соединений"""
    async with pool.acquire() as connection:
        query = """
        SELECT id, store_id, kaspi_sku, external_kaspi_id, price, min_profit
        FROM products
        WHERE bot_active = TRUE
        """
        products = await connection.fetch(query)
        return products


async def sync_store(sid, clogger):
    """Синхронизация магазина"""
    async with semaphore:
        try:
            result = await sync_store_api(sid)
            clogger.info(f"Синхронизирован магазин {sid}: {result}")
        except Exception as e:
            clogger.error(f"Ошибка sync_store_api для {sid}: {e}", exc_info=True)


async def check_and_update_prices():
    clogger = logging.getLogger("price_checker")
    clogger.setLevel(logging.INFO)
    pool = await create_pool()

    while True:
        try:
            clogger.info("Начинаем работу демпера...")
            products = await fetch_products(pool)
            clogger.info(f"Нашли {len(products)} активных продуктов.")

            # Список задач для обработки продуктов
            tasks = []
            for product in products:
                task = asyncio.create_task(process_product(product, clogger, pool))
                tasks.append(task)

            # Ограничиваем количество одновременно выполняемых задач
            await asyncio.gather(*tasks)

            # Список задач для синхронизации магазинов
            store_ids = {p["store_id"] for p in products}
            clogger.info(f"Найдено {len(store_ids)} магазинов для синхронизации.")

            # Обрабатываем каждый магазин по очереди
            for sid in store_ids:
                await sync_store(sid, clogger)  # Синхронизируем магазин последовательно

        except Exception as e:
            clogger.error(f"Error during price check/update: {e}", exc_info=True)

        await asyncio.sleep(5)


if __name__ == "__main__":
    asyncio.run(check_and_update_prices())
