-- =====================================================================
-- HOT DOG 369 · Borrar datos de prueba
-- Cómo usar: Supabase → SQL Editor → New query → pegar TODO → Run.
--
-- BORRA: ventas y sus pagos, anulaciones, turnos y arqueos, clientes y
--        fiados, gastos, movimientos de caja, el registro de auditoría,
--        los movimientos y controles de stock (el stock queda en 0) y
--        las fichadas, francos y ausencias del personal.
--        La numeración vuelve a empezar (la próxima venta es la #1).
-- CONSERVA: productos y precios, categorías, medios de pago, usuarios,
--        roles y PIN, tipos de turno, motivos de anulación, artículos de
--        stock y recetas, módulos y configuración.
--
-- ¡NO SE PUEDE DESHACER! Conviene descargar un respaldo antes.
-- Antes de usarla, cerrar la sesión en todos los equipos.
-- =====================================================================
DO $$
DECLARE
  tablas text[] := ARRAY['sale_items','sale_payments','customer_movements','cash_movements','sales','shifts',
                         'customers','expenses','audit_log'];
  extra  text[] := ARRAY['stock_movements','stock_count_lines','stock_counts','time_entries','time_off'];
  t text;
BEGIN
  -- Las tablas de stock y horas se incluyen solo si la base ya las tiene
  FOREACH t IN ARRAY extra LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN tablas := tablas || t; END IF;
  END LOOP;
  EXECUTE 'TRUNCATE TABLE ' || array_to_string(ARRAY(SELECT format('public.%I', x) FROM unnest(tablas) x), ', ') || ' RESTART IDENTITY';
  IF to_regclass('public.stock_items') IS NOT NULL THEN
    UPDATE stock_items SET quantity = 0;
  END IF;
END $$;

-- Resumen: todo en 0 menos lo que se conserva
SELECT
  (SELECT count(*) FROM sales)     AS ventas,
  (SELECT count(*) FROM shifts)    AS turnos,
  (SELECT count(*) FROM customers) AS clientes,
  (SELECT count(*) FROM expenses)  AS gastos,
  (SELECT count(*) FROM products)  AS productos_conservados,
  (SELECT count(*) FROM users)     AS usuarios_conservados;
