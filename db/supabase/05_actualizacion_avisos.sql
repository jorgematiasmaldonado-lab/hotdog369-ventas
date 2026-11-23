-- =====================================================================
-- HOT DOG 369 · Actualización: avisos de stock bajo en el celular
-- Para una base que YA está funcionando (después de 04_actualizacion_stock_horas.sql).
-- Cómo usar: Supabase → SQL Editor → New query → pegar TODO → Run.
-- No borra ni modifica datos. Se puede ejecutar más de una vez.
-- =====================================================================

BEGIN;

-- HOT DOG 369 · Notificaciones en el celular (Web Push) para avisos de stock bajo.
-- Idempotente.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          serial PRIMARY KEY,
  user_id     int NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint    text NOT NULL UNIQUE,
  p256dh      text NOT NULL,
  auth        text NOT NULL,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  last_ok_at  timestamptz
);
CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON push_subscriptions(user_id);

DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND NOT rowsecurity LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;

INSERT INTO schema_migrations (name) VALUES ('004_push.sql') ON CONFLICT (name) DO NOTHING;

COMMIT;

SELECT 'Actualización aplicada' AS resultado, (SELECT count(*) FROM schema_migrations) AS migraciones;
