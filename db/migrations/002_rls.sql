-- Seguridad para Supabase (y cualquier Postgres): activa Row Level Security en todas
-- las tablas del esquema public, sin políticas. Así la Data API de Supabase (roles anon /
-- authenticated) no puede leer ni modificar nada. La app se conecta como dueña de las
-- tablas, que no está alcanzada por RLS, por lo que sigue funcionando igual.
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;
