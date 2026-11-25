-- =====================================================================
-- HOT DOG 369 · Actualización: caja inicial del administrador, cierre a ciegas,
-- control de stock por paquetes (Paty, Alemana y pan) y valor hora del personal.
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

INSERT INTO schema_migrations (name) VALUES ('005_caja_horas.sql') ON CONFLICT (name) DO NOTHING;

COMMIT;

SELECT 'Actualización aplicada' AS resultado, (SELECT count(*) FROM schema_migrations) AS migraciones;
