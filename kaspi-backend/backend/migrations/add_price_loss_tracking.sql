-- Добавляем поля для отслеживания потерь от демпинга
ALTER TABLE price_history
ADD COLUMN price_decrease INTEGER DEFAULT 0,
ADD COLUMN cumulative_loss INTEGER DEFAULT 0,
ADD COLUMN change_reason VARCHAR(50);

-- Добавляем индексы для оптимизации запросов
CREATE INDEX idx_price_history_decrease ON price_history(price_decrease);
CREATE INDEX idx_price_history_loss ON price_history(cumulative_loss);

COMMENT ON COLUMN price_history.price_decrease IS 'Размер снижения цены в текущей операции';
COMMENT ON COLUMN price_history.cumulative_loss IS 'Накопленные потери от демпинга';
COMMENT ON COLUMN price_history.change_reason IS 'Причина изменения цены';
