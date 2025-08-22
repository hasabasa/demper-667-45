# routes/whatsapp.py
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import aiohttp
import asyncio
import logging
from datetime import datetime
import json

from db import create_pool

router = APIRouter(prefix="/whatsapp", tags=["whatsapp"])
logger = logging.getLogger(__name__)

# WAHA Configuration
WAHA_URL = "http://localhost:3000"  # Default, can be overridden by env
WAHA_API_KEY = None  # Optional API key for WAHA

# Pydantic models
class WhatsAppSession(BaseModel):
    name: str = Field(..., description="Session name (phone number format: 7XXXXXXXXXX)")
    store_id: str = Field(..., description="Associated store ID")

class WhatsAppMessage(BaseModel):
    session: str = Field(..., description="Session name")
    chatId: str = Field(..., description="Phone number with @c.us suffix")
    text: str = Field(..., description="Message text")

class BulkMessage(BaseModel):
    session: str = Field(..., description="Session name")
    phone_numbers: List[str] = Field(..., description="List of phone numbers")
    message_template: str = Field(..., description="Message template with variables")
    variables: Dict[str, Any] = Field(default_factory=dict, description="Variables for template")

class MessageTemplate(BaseModel):
    id: str
    name: str
    content: str
    variables: List[str]
    category: str  # sales, alerts, reports, etc.

# Default message templates
DEFAULT_TEMPLATES = [
    {
        "id": "daily_sales_summary",
        "name": "Ежедневная сводка продаж",
        "content": """📊 *Сводка продаж за {date}*

💰 Выручка: *{revenue} ₸*
📦 Заказов: *{orders_count}*
📈 Средний чек: *{avg_check} ₸*

{top_products}

🏪 Магазин: {store_name}
⏰ Отчет сформирован: {timestamp}""",
        "variables": ["date", "revenue", "orders_count", "avg_check", "top_products", "store_name", "timestamp"],
        "category": "sales"
    },
    {
        "id": "new_order_alert",
        "name": "Уведомление о новом заказе",
        "content": """🎉 *Новый заказ!*

💰 Сумма: *{order_amount} ₸*
📱 Товар: {product_name}
🏪 Магазин: {store_name}

⏰ {timestamp}""",
        "variables": ["order_amount", "product_name", "store_name", "timestamp"],
        "category": "alerts"
    },
    {
        "id": "price_bot_alert",
        "name": "Алерт бота цен",
        "content": """🤖 *Демпер обновил цену*

📦 Товар: {product_name}
💰 Была: {old_price} ₸ → Стала: *{new_price} ₸*
📉 Конкурент: {competitor_price} ₸

🏪 {store_name}
⏰ {timestamp}""",
        "variables": ["product_name", "old_price", "new_price", "competitor_price", "store_name", "timestamp"],
        "category": "alerts"
    },
    {
        "id": "weekly_report",
        "name": "Еженедельный отчет",
        "content": """📈 *Еженедельный отчет {week_dates}*

💰 Общая выручка: *{total_revenue} ₸*
📦 Всего заказов: *{total_orders}*
📊 Рост к прошлой неделе: {growth_percent}%

🏆 *Топ товары:*
{top_products}

📈 *Динамика по дням:*
{daily_stats}

🏪 Магазин: {store_name}""",
        "variables": ["week_dates", "total_revenue", "total_orders", "growth_percent", "top_products", "daily_stats", "store_name"],
        "category": "reports"
    }
]

class WhatsAppService:
    def __init__(self, waha_url: str = WAHA_URL, api_key: Optional[str] = WAHA_API_KEY):
        self.waha_url = waha_url
        self.api_key = api_key
        self.session = None
    
    async def get_session(self) -> aiohttp.ClientSession:
        if self.session is None or self.session.closed:
            headers = {}
            if self.api_key:
                headers["X-Api-Key"] = self.api_key
            self.session = aiohttp.ClientSession(headers=headers)
        return self.session
    
    async def close(self):
        if self.session and not self.session.closed:
            await self.session.close()
    
    async def create_session(self, session_name: str) -> Dict[str, Any]:
        """Create a new WhatsApp session"""
        session = await self.get_session()
        
        try:
            async with session.post(
                f"{self.waha_url}/api/sessions",
                json={"name": session_name}
            ) as response:
                if response.status == 201:
                    return await response.json()
                else:
                    error_text = await response.text()
                    raise HTTPException(
                        status_code=response.status,
                        detail=f"Failed to create session: {error_text}"
                    )
        except aiohttp.ClientError as e:
            raise HTTPException(status_code=500, detail=f"WAHA connection error: {str(e)}")
    
    async def get_session_status(self, session_name: str) -> Dict[str, Any]:
        """Get session status and QR code if needed"""
        session = await self.get_session()
        
        try:
            async with session.get(
                f"{self.waha_url}/api/sessions/{session_name}"
            ) as response:
                if response.status == 200:
                    return await response.json()
                else:
                    return {"status": "NOT_FOUND"}
        except aiohttp.ClientError as e:
            logger.error(f"Error getting session status: {e}")
            return {"status": "ERROR", "error": str(e)}
    
    async def send_message(self, session_name: str, chat_id: str, text: str) -> Dict[str, Any]:
        """Send a text message"""
        session = await self.get_session()
        
        message_data = {
            "chatId": chat_id,
            "text": text,
            "session": session_name
        }
        
        try:
            async with session.post(
                f"{self.waha_url}/api/sendText",
                json=message_data
            ) as response:
                if response.status == 201:
                    return await response.json()
                else:
                    error_text = await response.text()
                    raise HTTPException(
                        status_code=response.status,
                        detail=f"Failed to send message: {error_text}"
                    )
        except aiohttp.ClientError as e:
            raise HTTPException(status_code=500, detail=f"WAHA connection error: {str(e)}")
    
    async def get_sessions(self) -> List[Dict[str, Any]]:
        """Get all active sessions"""
        session = await self.get_session()
        
        try:
            async with session.get(f"{self.waha_url}/api/sessions") as response:
                if response.status == 200:
                    return await response.json()
                else:
                    return []
        except aiohttp.ClientError as e:
            logger.error(f"Error getting sessions: {e}")
            return []

# Global service instance
whatsapp_service = WhatsAppService()

# Helper functions
def format_phone_number(phone: str) -> str:
    """Format phone number for WhatsApp (add @c.us suffix)"""
    # Remove any non-digit characters
    clean_phone = ''.join(filter(str.isdigit, phone))
    
    # Ensure it starts with country code (7 for Kazakhstan)
    if not clean_phone.startswith('7') and len(clean_phone) == 10:
        clean_phone = '7' + clean_phone
    
    return clean_phone + '@c.us'

def format_template_message(template: str, variables: Dict[str, Any]) -> str:
    """Format message template with variables"""
    try:
        return template.format(**variables)
    except KeyError as e:
        logger.warning(f"Missing variable in template: {e}")
        return template
    except Exception as e:
        logger.error(f"Error formatting template: {e}")
        return template

# API Endpoints
@router.post("/sessions")
async def create_whatsapp_session(session_data: WhatsAppSession):
    """Create a new WhatsApp session"""
    try:
        # Create session in WAHA
        result = await whatsapp_service.create_session(session_data.name)
        
        # Store session info in database
        pool = await create_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO whatsapp_sessions (name, store_id, status, created_at)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (name) DO UPDATE SET
                    store_id = $2,
                    status = $3,
                    updated_at = $4
                """,
                session_data.name,
                session_data.store_id,
                "STARTING",
                datetime.now()
            )
        
        return {
            "success": True,
            "session": result,
            "message": f"Session {session_data.name} created successfully"
        }
    
    except Exception as e:
        logger.error(f"Error creating WhatsApp session: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/sessions/{session_name}/status")
async def get_session_status(session_name: str):
    """Get session status and QR code"""
    try:
        status = await whatsapp_service.get_session_status(session_name)
        return {
            "success": True,
            "status": status
        }
    except Exception as e:
        logger.error(f"Error getting session status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/sessions")
async def get_all_sessions():
    """Get all WhatsApp sessions"""
    try:
        # Get sessions from WAHA
        waha_sessions = await whatsapp_service.get_sessions()
        
        # Get session info from database
        pool = await create_pool()
        async with pool.acquire() as conn:
            db_sessions = await conn.fetch(
                "SELECT * FROM whatsapp_sessions ORDER BY created_at DESC"
            )
        
        # Combine data
        sessions = []
        for db_session in db_sessions:
            waha_session = next(
                (s for s in waha_sessions if s.get('name') == db_session['name']), 
                {}
            )
            
            sessions.append({
                "name": db_session['name'],
                "store_id": db_session['store_id'],
                "status": waha_session.get('status', db_session['status']),
                "created_at": db_session['created_at'].isoformat(),
                "updated_at": db_session['updated_at'].isoformat() if db_session['updated_at'] else None
            })
        
        return {
            "success": True,
            "sessions": sessions
        }
    
    except Exception as e:
        logger.error(f"Error getting sessions: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/send-message")
async def send_whatsapp_message(message: WhatsAppMessage):
    """Send a single WhatsApp message"""
    try:
        # Format phone number
        chat_id = format_phone_number(message.chatId) if '@c.us' not in message.chatId else message.chatId
        
        # Send message via WAHA
        result = await whatsapp_service.send_message(message.session, chat_id, message.text)
        
        # Log message in database
        pool = await create_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO whatsapp_messages (session_name, chat_id, message_text, status, sent_at)
                VALUES ($1, $2, $3, $4, $5)
                """,
                message.session,
                chat_id,
                message.text,
                "SENT",
                datetime.now()
            )
        
        return {
            "success": True,
            "result": result,
            "message": "Message sent successfully"
        }
    
    except Exception as e:
        logger.error(f"Error sending WhatsApp message: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/send-bulk")
async def send_bulk_messages(bulk_message: BulkMessage, background_tasks: BackgroundTasks):
    """Send bulk WhatsApp messages"""
    try:
        # Validate session exists
        status = await whatsapp_service.get_session_status(bulk_message.session)
        if status.get("status") != "WORKING":
            raise HTTPException(
                status_code=400, 
                detail=f"Session {bulk_message.session} is not ready. Status: {status.get('status')}"
            )
        
        # Start bulk sending in background
        background_tasks.add_task(
            _send_bulk_messages_background,
            bulk_message.session,
            bulk_message.phone_numbers,
            bulk_message.message_template,
            bulk_message.variables
        )
        
        return {
            "success": True,
            "message": f"Bulk sending started for {len(bulk_message.phone_numbers)} recipients"
        }
    
    except Exception as e:
        logger.error(f"Error starting bulk send: {e}")
        raise HTTPException(status_code=500, detail=str(e))

async def _send_bulk_messages_background(
    session_name: str, 
    phone_numbers: List[str], 
    template: str, 
    variables: Dict[str, Any]
):
    """Background task for sending bulk messages"""
    pool = await create_pool()
    sent_count = 0
    failed_count = 0
    
    for phone in phone_numbers:
        try:
            # Format phone number
            chat_id = format_phone_number(phone)
            
            # Format message with variables
            message_text = format_template_message(template, variables)
            
            # Send message
            await whatsapp_service.send_message(session_name, chat_id, message_text)
            
            # Log success
            async with pool.acquire() as conn:
                await conn.execute(
                    """
                    INSERT INTO whatsapp_messages (session_name, chat_id, message_text, status, sent_at)
                    VALUES ($1, $2, $3, $4, $5)
                    """,
                    session_name,
                    chat_id,
                    message_text,
                    "SENT",
                    datetime.now()
                )
            
            sent_count += 1
            
            # Small delay to avoid rate limiting
            await asyncio.sleep(1)
            
        except Exception as e:
            logger.error(f"Failed to send message to {phone}: {e}")
            
            # Log failure
            async with pool.acquire() as conn:
                await conn.execute(
                    """
                    INSERT INTO whatsapp_messages (session_name, chat_id, message_text, status, error_message, sent_at)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    """,
                    session_name,
                    format_phone_number(phone),
                    format_template_message(template, variables),
                    "FAILED",
                    str(e),
                    datetime.now()
                )
            
            failed_count += 1
    
    logger.info(f"Bulk send completed: {sent_count} sent, {failed_count} failed")

@router.get("/templates")
async def get_message_templates():
    """Get all message templates"""
    try:
        pool = await create_pool()
        async with pool.acquire() as conn:
            templates = await conn.fetch(
                "SELECT * FROM whatsapp_templates ORDER BY category, name"
            )
        
        if not templates:
            # Return default templates if none in database
            return {
                "success": True,
                "templates": DEFAULT_TEMPLATES
            }
        
        return {
            "success": True,
            "templates": [dict(template) for template in templates]
        }
    
    except Exception as e:
        logger.error(f"Error getting templates: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/templates")
async def create_message_template(template: MessageTemplate):
    """Create a new message template"""
    try:
        pool = await create_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO whatsapp_templates (id, name, content, variables, category)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (id) DO UPDATE SET
                    name = $2,
                    content = $3,
                    variables = $4,
                    category = $5,
                    updated_at = NOW()
                """,
                template.id,
                template.name,
                template.content,
                json.dumps(template.variables),
                template.category
            )
        
        return {
            "success": True,
            "message": "Template created successfully"
        }
    
    except Exception as e:
        logger.error(f"Error creating template: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/messages/history")
async def get_message_history(
    session_name: Optional[str] = None,
    limit: int = 100,
    offset: int = 0
):
    """Get message history"""
    try:
        pool = await create_pool()
        async with pool.acquire() as conn:
            if session_name:
                messages = await conn.fetch(
                    """
                    SELECT * FROM whatsapp_messages 
                    WHERE session_name = $1 
                    ORDER BY sent_at DESC 
                    LIMIT $2 OFFSET $3
                    """,
                    session_name, limit, offset
                )
            else:
                messages = await conn.fetch(
                    """
                    SELECT * FROM whatsapp_messages 
                    ORDER BY sent_at DESC 
                    LIMIT $1 OFFSET $2
                    """,
                    limit, offset
                )
        
        return {
            "success": True,
            "messages": [dict(message) for message in messages]
        }
    
    except Exception as e:
        logger.error(f"Error getting message history: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Webhook endpoint for receiving messages from WAHA
@router.post("/webhook")
async def whatsapp_webhook(payload: Dict[str, Any]):
    """Webhook for receiving WhatsApp events from WAHA"""
    try:
        logger.info(f"Received WhatsApp webhook: {payload}")
        
        # Handle different event types
        event_type = payload.get("event")
        
        if event_type == "message":
            # Handle incoming message
            await _handle_incoming_message(payload)
        elif event_type == "session.status":
            # Handle session status change
            await _handle_session_status(payload)
        
        return {"success": True}
    
    except Exception as e:
        logger.error(f"Error processing webhook: {e}")
        return {"success": False, "error": str(e)}

async def _handle_incoming_message(payload: Dict[str, Any]):
    """Handle incoming WhatsApp message"""
    # Log incoming message
    pool = await create_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO whatsapp_incoming_messages (
                session_name, chat_id, message_text, message_type, received_at
            ) VALUES ($1, $2, $3, $4, $5)
            """,
            payload.get("session"),
            payload.get("payload", {}).get("from"),
            payload.get("payload", {}).get("body"),
            payload.get("payload", {}).get("type", "text"),
            datetime.now()
        )

async def _handle_session_status(payload: Dict[str, Any]):
    """Handle session status change"""
    session_name = payload.get("session")
    status = payload.get("payload", {}).get("status")
    
    if session_name and status:
        pool = await create_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                """
                UPDATE whatsapp_sessions 
                SET status = $1, updated_at = $2 
                WHERE name = $3
                """,
                status,
                datetime.now(),
                session_name
            )

# Cleanup
@router.on_event("shutdown")
async def shutdown_whatsapp_service():
    await whatsapp_service.close()
