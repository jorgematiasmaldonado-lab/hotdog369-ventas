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
