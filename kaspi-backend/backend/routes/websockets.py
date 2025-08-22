# routes/websockets.py
import asyncio
import json
import logging
from datetime import datetime
from typing import Dict, Set
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from pydantic import BaseModel
import uuid

from db import create_pool
from utils import validate_store_id

router = APIRouter(prefix="/ws", tags=["websockets"])
logger = logging.getLogger(__name__)

# Активные WebSocket соединения: store_id -> set of websockets
active_connections: Dict[str, Set[WebSocket]] = {}

# Менеджер соединений
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, store_id: str):
        await websocket.accept()
        
        if store_id not in self.active_connections:
            self.active_connections[store_id] = set()
        
        self.active_connections[store_id].add(websocket)
        logger.info(f"WebSocket connected for store {store_id}. Total connections: {len(self.active_connections[store_id])}")

    def disconnect(self, websocket: WebSocket, store_id: str):
        if store_id in self.active_connections:
            self.active_connections[store_id].discard(websocket)
            if not self.active_connections[store_id]:
                del self.active_connections[store_id]
        logger.info(f"WebSocket disconnected for store {store_id}")

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        try:
            await websocket.send_text(json.dumps(message))
        except Exception as e:
            logger.error(f"Error sending personal message: {e}")

    async def broadcast_to_store(self, message: dict, store_id: str):
        if store_id not in self.active_connections:
            return
        
        disconnected = set()
        for connection in self.active_connections[store_id].copy():
            try:
                await connection.send_text(json.dumps(message))
            except Exception as e:
                logger.error(f"Error broadcasting to store {store_id}: {e}")
                disconnected.add(connection)
        
        # Удаляем разорванные соединения
        for connection in disconnected:
            self.active_connections[store_id].discard(connection)

manager = ConnectionManager()

# Модели для WebSocket сообщений
class DemperStatusMessage(BaseModel):
    type: str = "demper_status"
    store_id: str
    status: str  # active, inactive, error, starting, stopping
    products_active: int = 0
    products_processed: int = 0
    last_update: str
    uptime_seconds: int = 0

class PriceUpdateMessage(BaseModel):
    type: str = "price_update"
    store_id: str
    product_id: str
    product_name: str
    old_price: float
    new_price: float
    competitor_price: float
    min_profit: float
    timestamp: str
    success: bool = True

class DemperErrorMessage(BaseModel):
    type: str = "demper_error"
    store_id: str
    error_message: str
    product_id: str = None
    timestamp: str

@router.websocket("/demper/{store_id}")
async def websocket_demper_endpoint(websocket: WebSocket, store_id: str):
    """
    WebSocket endpoint для real-time обновлений демпера
    """
    try:
        # Проверяем существование магазина
        if not await validate_store_id(store_id):
            await websocket.close(code=4004, reason="Store not found")
            return

        await manager.connect(websocket, store_id)
        
        # Отправляем приветственное сообщение
        welcome_message = {
            "type": "connection_established",
            "store_id": store_id,
            "timestamp": datetime.now().isoformat(),
            "message": f"WebSocket подключен для магазина {store_id}"
        }
        await manager.send_personal_message(welcome_message, websocket)

        # Отправляем текущий статус демпера
        current_status = await get_demper_status(store_id)
        await manager.send_personal_message(current_status.dict(), websocket)

        try:
            while True:
                # Ожидаем сообщения от клиента (если нужно)
                data = await websocket.receive_text()
                message = json.loads(data)
                
                # Обрабатываем команды от клиента
                if message.get("type") == "ping":
                    pong_message = {
                        "type": "pong",
                        "timestamp": datetime.now().isoformat()
                    }
                    await manager.send_personal_message(pong_message, websocket)
                
                elif message.get("type") == "get_status":
                    current_status = await get_demper_status(store_id)
                    await manager.send_personal_message(current_status.dict(), websocket)
                    
        except WebSocketDisconnect:
            pass
        except Exception as e:
            logger.error(f"Error in WebSocket connection for store {store_id}: {e}")
            error_message = {
                "type": "error",
                "message": "Internal server error",
                "timestamp": datetime.now().isoformat()
            }
            await manager.send_personal_message(error_message, websocket)
    
    finally:
        manager.disconnect(websocket, store_id)

async def get_demper_status(store_id: str) -> DemperStatusMessage:
    """
    Получает текущий статус демпера для магазина
    """
    try:
        pool = await create_pool()
        async with pool.acquire() as conn:
            # Получаем статистику активных продуктов
            products_stats = await conn.fetchrow(
                """
                SELECT 
                    COUNT(*) as total_products,
                    COUNT(CASE WHEN bot_active = TRUE THEN 1 END) as active_products
                FROM products 
                WHERE store_id = $1
                """,
                store_id
            )
            
            # Проверяем, запущен ли демпер (можно добавить таблицу demper_sessions)
            # Пока используем простую логику
            is_active = products_stats['active_products'] > 0
            
            return DemperStatusMessage(
                store_id=store_id,
                status="active" if is_active else "inactive",
                products_active=products_stats['active_products'] or 0,
                products_processed=0,  # TODO: добавить счетчик обработанных
                last_update=datetime.now().isoformat(),
                uptime_seconds=0  # TODO: добавить время работы
            )
    
    except Exception as e:
        logger.error(f"Error getting demper status for store {store_id}: {e}")
        return DemperStatusMessage(
            store_id=store_id,
            status="error",
            last_update=datetime.now().isoformat()
        )

# Функции для отправки уведомлений (используются в демпере)
async def notify_price_update(
    store_id: str,
    product_id: str,
    product_name: str,
    old_price: float,
    new_price: float,
    competitor_price: float,
    min_profit: float,
    success: bool = True
):
    """
    Отправляет уведомление об обновлении цены всем подключенным клиентам магазина
    """
    message = PriceUpdateMessage(
        store_id=store_id,
        product_id=product_id,
        product_name=product_name,
        old_price=old_price,
        new_price=new_price,
        competitor_price=competitor_price,
        min_profit=min_profit,
        timestamp=datetime.now().isoformat(),
        success=success
    )
    
    await manager.broadcast_to_store(message.dict(), store_id)
    logger.info(f"Price update notification sent for store {store_id}, product {product_id}")

async def notify_demper_status_change(store_id: str, status: str, **kwargs):
    """
    Отправляет уведомление об изменении статуса демпера
    """
    current_status = await get_demper_status(store_id)
    current_status.status = status
    
    # Обновляем дополнительные поля если переданы
    for key, value in kwargs.items():
        if hasattr(current_status, key):
            setattr(current_status, key, value)
    
    current_status.last_update = datetime.now().isoformat()
    
    await manager.broadcast_to_store(current_status.dict(), store_id)
    logger.info(f"Demper status change notification sent for store {store_id}: {status}")

async def notify_demper_error(store_id: str, error_message: str, product_id: str = None):
    """
    Отправляет уведомление об ошибке в демпере
    """
    message = DemperErrorMessage(
        store_id=store_id,
        error_message=error_message,
        product_id=product_id,
        timestamp=datetime.now().isoformat()
    )
    
    await manager.broadcast_to_store(message.dict(), store_id)
    logger.error(f"Demper error notification sent for store {store_id}: {error_message}")

# HTTP endpoints для управления демпером
@router.get("/demper/{store_id}/status")
async def get_demper_status_http(store_id: str):
    """
    HTTP endpoint для получения статуса демпера
    """
    if not await validate_store_id(store_id):
        raise HTTPException(status_code=404, detail="Store not found")
    
    status = await get_demper_status(store_id)
    return {"success": True, "data": status.dict()}

@router.post("/demper/{store_id}/start")
async def start_demper(store_id: str):
    """
    HTTP endpoint для запуска демпера
    """
    if not await validate_store_id(store_id):
        raise HTTPException(status_code=404, detail="Store not found")
    
    # TODO: Реализовать логику запуска демпера
    await notify_demper_status_change(store_id, "starting")
    
    return {"success": True, "message": "Демпер запускается"}

@router.post("/demper/{store_id}/stop")
async def stop_demper(store_id: str):
    """
    HTTP endpoint для остановки демпера
    """
    if not await validate_store_id(store_id):
        raise HTTPException(status_code=404, detail="Store not found")
    
    # TODO: Реализовать логику остановки демпера
    await notify_demper_status_change(store_id, "stopping")
    
    return {"success": True, "message": "Демпер останавливается"}

@router.get("/demper/{store_id}/connections")
async def get_active_connections(store_id: str):
    """
    Получить количество активных WebSocket соединений для магазина (для отладки)
    """
    if not await validate_store_id(store_id):
        raise HTTPException(status_code=404, detail="Store not found")
    
    connections_count = len(manager.active_connections.get(store_id, set()))
    
    return {
        "success": True,
        "store_id": store_id,
        "active_connections": connections_count
    }
