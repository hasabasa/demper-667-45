-- 005_create_whatsapp_tables.sql
-- WhatsApp tables for WAHA integration

-- WhatsApp sessions table
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL, -- Session name (phone number)
    store_id VARCHAR(100) NOT NULL,   -- Associated store ID
    status VARCHAR(20) DEFAULT 'STARTING', -- STARTING, SCAN_QR, WORKING, FAILED, STOPPED
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- WhatsApp message templates
CREATE TABLE IF NOT EXISTS whatsapp_templates (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    variables JSONB DEFAULT '[]', -- Array of variable names
    category VARCHAR(50) DEFAULT 'general', -- sales, alerts, reports, etc.
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Outgoing WhatsApp messages log
CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id SERIAL PRIMARY KEY,
    session_name VARCHAR(50) NOT NULL,
    chat_id VARCHAR(100) NOT NULL, -- Phone number with @c.us
    message_text TEXT NOT NULL,
    template_id VARCHAR(100), -- Reference to template used
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, SENT, DELIVERED, FAILED
    error_message TEXT,
    sent_at TIMESTAMP DEFAULT NOW(),
    delivered_at TIMESTAMP,
    
    FOREIGN KEY (session_name) REFERENCES whatsapp_sessions(name) ON DELETE CASCADE
);

-- Incoming WhatsApp messages log
CREATE TABLE IF NOT EXISTS whatsapp_incoming_messages (
    id SERIAL PRIMARY KEY,
    session_name VARCHAR(50) NOT NULL,
    chat_id VARCHAR(100) NOT NULL,
    message_text TEXT,
    message_type VARCHAR(50) DEFAULT 'text', -- text, image, document, etc.
    received_at TIMESTAMP DEFAULT NOW(),
    
    FOREIGN KEY (session_name) REFERENCES whatsapp_sessions(name) ON DELETE CASCADE
);

-- WhatsApp campaigns/broadcasts
CREATE TABLE IF NOT EXISTS whatsapp_campaigns (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    store_id VARCHAR(100) NOT NULL,
    session_name VARCHAR(50) NOT NULL,
    template_id VARCHAR(100) NOT NULL,
    template_variables JSONB DEFAULT '{}',
    recipient_list JSONB NOT NULL, -- Array of phone numbers
    status VARCHAR(20) DEFAULT 'DRAFT', -- DRAFT, RUNNING, COMPLETED, FAILED
    total_recipients INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    delivered_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    scheduled_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    
    FOREIGN KEY (session_name) REFERENCES whatsapp_sessions(name) ON DELETE CASCADE,
    FOREIGN KEY (template_id) REFERENCES whatsapp_templates(id) ON DELETE CASCADE
);

-- WhatsApp automation rules
CREATE TABLE IF NOT EXISTS whatsapp_automation_rules (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    store_id VARCHAR(100) NOT NULL,
    trigger_type VARCHAR(50) NOT NULL, -- new_order, price_change, daily_report, etc.
    trigger_conditions JSONB DEFAULT '{}',
    template_id VARCHAR(100) NOT NULL,
    template_variables JSONB DEFAULT '{}',
    recipient_phones JSONB DEFAULT '[]', -- Static recipient list
    is_active BOOLEAN DEFAULT true,
    last_triggered_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    FOREIGN KEY (template_id) REFERENCES whatsapp_templates(id) ON DELETE CASCADE
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_store_id ON whatsapp_sessions(store_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_status ON whatsapp_sessions(status);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_session ON whatsapp_messages(session_name);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_status ON whatsapp_messages(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_sent_at ON whatsapp_messages(sent_at);

CREATE INDEX IF NOT EXISTS idx_whatsapp_incoming_session ON whatsapp_incoming_messages(session_name);
CREATE INDEX IF NOT EXISTS idx_whatsapp_incoming_received_at ON whatsapp_incoming_messages(received_at);

CREATE INDEX IF NOT EXISTS idx_whatsapp_campaigns_store_id ON whatsapp_campaigns(store_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_campaigns_status ON whatsapp_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_campaigns_session ON whatsapp_campaigns(session_name);

CREATE INDEX IF NOT EXISTS idx_whatsapp_automation_store_id ON whatsapp_automation_rules(store_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_automation_trigger ON whatsapp_automation_rules(trigger_type);
CREATE INDEX IF NOT EXISTS idx_whatsapp_automation_active ON whatsapp_automation_rules(is_active);

-- Insert default message templates
INSERT INTO whatsapp_templates (id, name, content, variables, category) VALUES
(
    'daily_sales_summary',
    'Ежедневная сводка продаж',
    '📊 *Сводка продаж за {date}*

💰 Выручка: *{revenue} ₸*
📦 Заказов: *{orders_count}*
📈 Средний чек: *{avg_check} ₸*

{top_products}

🏪 Магазин: {store_name}
⏰ Отчет сформирован: {timestamp}',
    '["date", "revenue", "orders_count", "avg_check", "top_products", "store_name", "timestamp"]',
    'sales'
),
(
    'new_order_alert',
    'Уведомление о новом заказе',
    '🎉 *Новый заказ!*

💰 Сумма: *{order_amount} ₸*
📱 Товар: {product_name}
🏪 Магазин: {store_name}

⏰ {timestamp}',
    '["order_amount", "product_name", "store_name", "timestamp"]',
    'alerts'
),
(
    'price_bot_alert',
    'Алерт бота цен',
    '🤖 *Демпер обновил цену*

📦 Товар: {product_name}
💰 Была: {old_price} ₸ → Стала: *{new_price} ₸*
📉 Конкурент: {competitor_price} ₸

🏪 {store_name}
⏰ {timestamp}',
    '["product_name", "old_price", "new_price", "competitor_price", "store_name", "timestamp"]',
    'alerts'
),
(
    'weekly_report',
    'Еженедельный отчет',
    '📈 *Еженедельный отчет {week_dates}*

💰 Общая выручка: *{total_revenue} ₸*
📦 Всего заказов: *{total_orders}*
📊 Рост к прошлой неделе: {growth_percent}%

🏆 *Топ товары:*
{top_products}

📈 *Динамика по дням:*
{daily_stats}

🏪 Магазин: {store_name}',
    '["week_dates", "total_revenue", "total_orders", "growth_percent", "top_products", "daily_stats", "store_name"]',
    'reports'
) ON CONFLICT (id) DO NOTHING;
