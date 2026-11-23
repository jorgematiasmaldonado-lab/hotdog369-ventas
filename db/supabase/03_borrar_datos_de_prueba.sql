-- =====================================================================
-- HOT DOG 369 · Borrar datos de prueba (ventas, turnos, fiados, gastos)
-- Cómo usar: Supabase → SQL Editor → New query → pegar TODO → Run.
--
-- BORRA: ventas y sus pagos, anulaciones, turnos y arqueos, clientes y
--        fiados, gastos, movimientos de caja y el registro de auditoría.
--        La numeración vuelve a empezar (la próxima venta es la #1).
-- CONSERVA: productos y precios, categorías, medios de pago, usuarios,
--        roles y PIN, tipos de turno, motivos de anulación, módulos y
--        configuración.
--
-- ¡NO SE PUEDE DESHACER! Ejecutar solo antes de empezar a usar la app
-- en serio. Antes de usarla, cerrar la sesión en todos los equipos.
-- =====================================================================
BEGIN;

TRUNCATE TABLE
  sale_items,
  sale_payments,
  customer_movements,
  cash_movements,
  sales,
  shifts,
  customers,
  expenses,
  audit_log
RESTART IDENTITY;

COMMIT;

-- Resumen: todo en 0 menos lo que se conserva
SELECT
  (SELECT count(*) FROM sales)     AS ventas,
  (SELECT count(*) FROM shifts)    AS turnos,
  (SELECT count(*) FROM customers) AS clientes,
  (SELECT count(*) FROM expenses)  AS gastos,
  (SELECT count(*) FROM products)  AS productos_conservados,
  (SELECT count(*) FROM users)     AS usuarios_conservados;
