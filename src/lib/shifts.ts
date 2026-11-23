import { sql, type Tx } from "./db";

export async function shiftSummary(shiftId: number, db: Tx = sql) {
  const [shift] = await db`
    SELECT s.*, u.name AS user_name, st.name AS shift_type_name
    FROM shifts s JOIN users u ON u.id = s.user_id LEFT JOIN shift_types st ON st.id = s.shift_type_id
    WHERE s.id = ${shiftId}`;
  if (!shift) return null;

  const [totals] = await db`
    SELECT count(*) FILTER (WHERE status = 'confirmada')::int AS sales_count,
           COALESCE(sum(total) FILTER (WHERE status = 'confirmada'), 0) AS sales_total,
           count(*) FILTER (WHERE status = 'anulada')::int AS voided_count,
           COALESCE(sum(total) FILTER (WHERE status = 'anulada'), 0) AS voided_total
    FROM sales WHERE shift_id = ${shiftId}`;

  const byMethod = await db`
    SELECT pm.id, pm.name, pm.kind, pm.color, COALESCE(sum(sp.amount), 0) AS amount
    FROM sale_payments sp JOIN sales s ON s.id = sp.sale_id JOIN payment_methods pm ON pm.id = sp.payment_method_id
    WHERE s.shift_id = ${shiftId} AND s.status = 'confirmada'
    GROUP BY pm.id ORDER BY pm.sort`;

  const collections = await db`
    SELECT pm.id, pm.name, pm.kind, COALESCE(sum(cm.amount), 0) AS amount
    FROM customer_movements cm JOIN payment_methods pm ON pm.id = cm.payment_method_id
    WHERE cm.shift_id = ${shiftId} AND cm.type = 'pago'
    GROUP BY pm.id ORDER BY pm.sort`;

  const [cash] = await db`
    SELECT COALESCE(sum(amount) FILTER (WHERE type = 'ingreso'), 0) AS ingresos,
           COALESCE(sum(amount) FILTER (WHERE type = 'retiro'), 0) AS retiros
    FROM cash_movements WHERE shift_id = ${shiftId}`;

  const items = await db`
    SELECT si.product_name, si.category_name, sum(si.qty)::int AS qty, sum(si.subtotal) AS amount
    FROM sale_items si JOIN sales s ON s.id = si.sale_id
    WHERE s.shift_id = ${shiftId} AND s.status = 'confirmada'
    GROUP BY si.product_name, si.category_name ORDER BY si.category_name, qty DESC`;

  const cashSales = byMethod.filter((m) => m.kind === "efectivo").reduce((a, m) => a + m.amount, 0);
  const cashCollections = collections.filter((m) => m.kind === "efectivo").reduce((a, m) => a + m.amount, 0);
  const expected_cash = shift.opening_cash + cashSales + cashCollections + cash.ingresos - cash.retiros;

  return { shift, totals, byMethod, collections, cash, items, cashSales, cashCollections, expected_cash };
}
