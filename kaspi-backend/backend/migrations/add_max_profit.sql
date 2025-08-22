-- Добавляем поле max_profit в таблицу products
ALTER TABLE products
ADD COLUMN max_profit INTEGER;

-- Добавляем индекс для оптимизации запросов
CREATE INDEX idx_products_max_profit ON products(max_profit);
