from fastapi import APIRouter, HTTPException
from datetime import datetime, timedelta
from typing import Optional
from db import create_pool

router = APIRouter(prefix="/analytics", tags=["analytics"])

@router.get("/demping-losses")
async def get_demping_losses(
    product_id: Optional[str] = None,
    store_id: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None
):
    """
    Получение статистики потерь от демпинга
    """
    pool = await create_pool()
    
    try:
        query_parts = []
        params = []
        param_count = 1

        # Базовый запрос
        base_query = """
            SELECT 
                p.kaspi_sku,
                p.name,
                ph.created_at,
                ph.price_decrease,
                ph.cumulative_loss,
                ph.change_reason
            FROM price_history ph
            JOIN products p ON p.id = ph.product_id
            WHERE 1=1
        """

        # Добавляем фильтры
        if product_id:
            query_parts.append(f" AND ph.product_id = ${param_count}")
            params.append(product_id)
            param_count += 1

        if store_id:
            query_parts.append(f" AND p.store_id = ${param_count}")
            params.append(store_id)
            param_count += 1

        if start_date:
            query_parts.append(f" AND ph.created_at >= ${param_count}")
            params.append(start_date)
            param_count += 1

        if end_date:
            query_parts.append(f" AND ph.created_at <= ${param_count}")
            params.append(end_date)
            param_count += 1

        # Собираем полный запрос
        full_query = base_query + " ".join(query_parts) + " ORDER BY ph.created_at DESC"

        # Выполняем запрос
        async with pool.acquire() as connection:
            rows = await connection.fetch(full_query, *params)

        # Формируем статистику
        statistics = {
            'total_loss': 0,
            'total_price_decreases': 0,
            'average_decrease': 0,
            'max_single_decrease': 0,
            'products_affected': set(),
            'history': []
        }

        for row in rows:
            if row['price_decrease'] > 0:
                statistics['total_loss'] += row['price_decrease']
                statistics['total_price_decreases'] += 1
                statistics['max_single_decrease'] = max(
                    statistics['max_single_decrease'], 
                    row['price_decrease']
                )
                statistics['products_affected'].add(row['kaspi_sku'])
            
            statistics['history'].append({
                'sku': row['kaspi_sku'],
                'name': row['name'],
                'date': row['created_at'].isoformat(),
                'price_decrease': row['price_decrease'],
                'cumulative_loss': row['cumulative_loss'],
                'reason': row['change_reason']
            })

        if statistics['total_price_decreases'] > 0:
            statistics['average_decrease'] = (
                statistics['total_loss'] / statistics['total_price_decreases']
            )

        statistics['products_affected'] = len(statistics['products_affected'])

        return {
            'success': True,
            'data': statistics
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
