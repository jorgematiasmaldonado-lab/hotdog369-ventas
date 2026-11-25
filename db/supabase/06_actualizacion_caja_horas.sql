-- =====================================================================
-- HOT DOG 369 · Actualización: caja inicial del administrador, cierre a ciegas,
-- control de stock por paquetes (Paty, Alemana y pan), valor hora del personal,
-- horario de cada turno, aviso de apertura tarde y recargo por medio de pago (QR, débito, crédito).
-- Para una base que YA está funcionando (después de 05_actualizacion_avisos.sql).
-- Cómo usar: Supabase → SQL Editor → New query → pegar TODO → Run.
-- No borra ventas ni datos. Se puede ejecutar más de una vez.
-- Nota: deja en el control al abrir turno SOLO Salchicha Paty, Salchicha Alemana
-- y Pan de pancho (si no existen, los crea con stock 0).
-- =====================================================================

BEGIN;

-- HOT DOG 369 · Conteo por paquetes, caja inicial del administrador, cierre a ciegas y valor hora.
-- Idempotente: se puede ejecutar más de una vez.

-- ---------- Stock: unidades por paquete y detalle del conteo ----------
ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS units_per_pack int CHECK (units_per_pack IS NULL OR units_per_pack > 0);
ALTER TABLE stock_count_lines ADD COLUMN IF NOT EXISTS packs numeric(12,3);
ALTER TABLE stock_count_lines ADD COLUMN IF NOT EXISTS loose numeric(12,3);
ALTER TABLE stock_count_lines ADD COLUMN IF NOT EXISTS units_per_pack int;

-- Artículos del control al abrir turno (se crean solo si no existen)
INSERT INTO stock_items (name, unit, units_per_pack, count_on_shift, sort)
  SELECT 'Salchicha Paty', 'u', 18, true, 1 WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE lower(name) = 'salchicha paty');
INSERT INTO stock_items (name, unit, units_per_pack, count_on_shift, sort)
  SELECT 'Salchicha Alemana', 'u', 4, true, 2 WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE lower(name) = 'salchicha alemana');
INSERT INTO stock_items (name, unit, units_per_pack, count_on_shift, sort)
  SELECT 'Pan de pancho', 'u', NULL, true, 3 WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE lower(name) = 'pan de pancho');
-- Solo esos tres se cuentan al abrir el turno (el administrador lo puede cambiar)
UPDATE stock_items SET count_on_shift = (lower(name) IN ('salchicha paty', 'salchicha alemana', 'pan de pancho'));

-- ---------- Turnos: caja inicial del administrador y cierre a ciegas ----------
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS opening_pending boolean NOT NULL DEFAULT false;   -- el admin todavía no cargó la caja inicial
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS opening_confirmed boolean;                        -- el empleado confirmó el monto
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS opening_note text;                                -- observación del empleado al abrir
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS declared jsonb;                                   -- lo que declaró el empleado por medio de pago
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS expected jsonb;                                   -- lo que debería haber por medio de pago
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS declared_total numeric(12,2);
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS expected_total numeric(12,2);

-- ---------- Horas: valor hora ----------
ALTER TABLE users ADD COLUMN IF NOT EXISTS hourly_rate numeric(12,2) CHECK (hourly_rate IS NULL OR hourly_rate >= 0);
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS hourly_rate numeric(12,2);                  -- valor vigente al fichar

-- HOT DOG 369 · Horario de cada turno, aviso de apertura tarde y aviso de turno sin abrir.
-- Idempotente: se puede ejecutar más de una vez.

-- Horario de inicio y días en que se abre cada turno (0 = domingo … 6 = sábado)
ALTER TABLE shift_types ADD COLUMN IF NOT EXISTS start_time time;
ALTER TABLE shift_types ADD COLUMN IF NOT EXISTS days text NOT NULL DEFAULT '0123456';

-- Apertura tarde: minutos de demora, hora en que dijo haber llegado y motivo
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS late_minutes int;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS arrived_at timestamptz;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS late_reason text;

-- Avisos de "turno sin abrir" ya enviados (uno por turno y día)
CREATE TABLE IF NOT EXISTS shift_alerts (
  shift_type_id int NOT NULL REFERENCES shift_types(id) ON DELETE CASCADE,
  day           date NOT NULL,
  sent_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (shift_type_id, day)
);
ALTER TABLE shift_alerts ENABLE ROW LEVEL SECURITY;

-- Configuración: tolerancia para abrir tarde, minutos para avisar y clave del control automático
INSERT INTO settings (key, value) VALUES ('late_tolerance_min', '15') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('unopened_alert_min', '30') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value)
  VALUES ('cron_secret', to_jsonb(md5(random()::text || clock_timestamp()::text) || md5(random()::text)))
  ON CONFLICT (key) DO NOTHING;

-- HOT DOG 369 · Recargo por medio de pago (comisión de QR, débito, crédito).
-- El monto del pago (amount) es la parte del precio; el recargo se guarda aparte.
-- Idempotente: se puede ejecutar más de una vez.
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS surcharge_pct numeric(5,2) NOT NULL DEFAULT 0
  CHECK (surcharge_pct >= 0 AND surcharge_pct < 50);
ALTER TABLE sale_payments ADD COLUMN IF NOT EXISTS surcharge numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS surcharge_total numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE customer_movements ADD COLUMN IF NOT EXISTS surcharge numeric(12,2) NOT NULL DEFAULT 0;

INSERT INTO schema_migrations (name) VALUES ('005_caja_horas.sql') ON CONFLICT (name) DO NOTHING;
INSERT INTO schema_migrations (name) VALUES ('006_horarios.sql') ON CONFLICT (name) DO NOTHING;
INSERT INTO schema_migrations (name) VALUES ('007_recargos.sql') ON CONFLICT (name) DO NOTHING;

COMMIT;

SELECT 'Actualización aplicada' AS resultado, (SELECT count(*) FROM schema_migrations) AS migraciones;
