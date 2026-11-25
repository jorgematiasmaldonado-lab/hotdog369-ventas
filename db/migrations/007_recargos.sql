-- HOT DOG 369 · Recargo por medio de pago (comisión de QR, débito, crédito).
-- El monto del pago (amount) es la parte del precio; el recargo se guarda aparte.
-- Idempotente: se puede ejecutar más de una vez.
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS surcharge_pct numeric(5,2) NOT NULL DEFAULT 0
  CHECK (surcharge_pct >= 0 AND surcharge_pct < 50);
ALTER TABLE sale_payments ADD COLUMN IF NOT EXISTS surcharge numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS surcharge_total numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE customer_movements ADD COLUMN IF NOT EXISTS surcharge numeric(12,2) NOT NULL DEFAULT 0;
