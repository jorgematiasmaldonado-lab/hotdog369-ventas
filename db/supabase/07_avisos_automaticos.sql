-- =====================================================================
-- HOT DOG 369 · Avisos automáticos: "el turno todavía no se abrió"
-- Ejecutar DESPUÉS de 06_actualizacion_caja_horas.sql.
-- Cómo usar: Supabase → SQL Editor → New query → pegar TODO → Run.
-- Programa un control cada 10 minutos: Supabase llama a la app y, si un turno
-- no se abrió a tiempo, la app avisa al celular del dueño y del administrador.
-- Se puede ejecutar más de una vez (reemplaza el control anterior).
-- Si la app cambia de dirección, cambiar la URL de abajo y volver a ejecutar.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.settings WHERE key = 'cron_secret') THEN
    RAISE EXCEPTION 'Primero hay que ejecutar 06_actualizacion_caja_horas.sql';
  END IF;
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'hotdog369-turnos';
END $$;

SELECT cron.schedule('hotdog369-turnos', '*/10 * * * *', $job$
  SELECT net.http_post(
    url     := 'https://hotdog369-ventas-six.vercel.app/api/cron/turnos',
    headers := jsonb_build_object('Content-Type', 'application/json',
               'x-cron-secret', (SELECT value #>> '{}' FROM public.settings WHERE key = 'cron_secret')),
    body    := '{}'::jsonb
  );
$job$);

SELECT 'Avisos automáticos programados cada 10 minutos' AS resultado;
