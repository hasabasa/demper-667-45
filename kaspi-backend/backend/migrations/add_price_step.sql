-- Добавляем поле price_step в таблицу products
ALTER TABLE products
ADD COLUMN price_step INTEGER DEFAULT 1;

COMMENT ON COLUMN products.price_step IS 'Шаг изменения цены в тенге';

-- Добавляем индекс для оптимизации запросов
CREATE INDEX idx_products_price_step ON products(price_step);
