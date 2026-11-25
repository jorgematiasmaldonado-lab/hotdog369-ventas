import { sql, type Tx } from "./db";
import { schemaOk } from "./schema";

export async function shiftSummary(shiftId: number, db: Tx = sql) {
  const [shift] = await db`
    SELECT s.*, u.name AS user_name, st.name AS shift_type_name
    FROM shifts s JOIN users u ON u.id = s.user_id LEFT JOIN shift_types st ON st.id = s.shift_type_id
    WHERE s.id = ${shiftId}`;
  if (!shift) return null;
  const v2 = await schemaOk();
  const spS = v2 ? db`sp.surcharge` : db`0`;
  const cmS = v2 ? db`cm.surcharge` : db`0`;

  const [totals] = await db`
    SELECT count(*) FILTER (WHERE status = 'confirmada')::int AS sales_count,
           COALESCE(sum(total) FILTER (WHERE status = 'confirmada'), 0) AS sales_total,
           count(*) FILTER (WHERE status = 'anulada')::int AS voided_count,
           COALESCE(sum(total) FILTER (WHERE status = 'anulada'), 0) AS voided_total,
           ${v2 ? db`COALESCE(sum(surcharge_total) FILTER (WHERE status = 'confirmada'), 0)` : db`0`}::numeric AS surcharge_total
    FROM sales WHERE shift_id = ${shiftId}`;

  const byMethod = await db`
    SELECT pm.id, pm.name, pm.kind, pm.color, COALESCE(sum(sp.amount), 0) AS amount, COALESCE(sum(${spS}), 0)::numeric AS surcharge
    FROM sale_payments sp JOIN sales s ON s.id = sp.sale_id JOIN payment_methods pm ON pm.id = sp.payment_method_id
    WHERE s.shift_id = ${shiftId} AND s.status = 'confirmada'
    GROUP BY pm.id ORDER BY pm.sort`;

  const collections = await db`
    SELECT pm.id, pm.name, pm.kind, COALESCE(sum(cm.amount), 0) AS amount, COALESCE(sum(${cmS}), 0)::numeric AS surcharge
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

  // Lo que entró en efectivo incluye el recargo si el efectivo tuviera uno
  const cashSales = byMethod.filter((m) => m.kind === "efectivo").reduce((a, m) => a + m.amount + Number(m.surcharge), 0);
  const cashCollections = collections.filter((m) => m.kind === "efectivo").reduce((a, m) => a + m.amount + Number(m.surcharge), 0);
  const expected_cash = shift.opening_cash + cashSales + cashCollections + cash.ingresos - cash.retiros;

  // Lo que debería haber por cada medio de pago (el fiado no entra: no es dinero recibido)
  const methods = await db`SELECT id, name, kind FROM payment_methods WHERE kind <> 'fiado' ORDER BY sort, name`;
  const firstCash = methods.find((m) => m.kind === "efectivo")?.id;
  const expected = methods
    .map((m) => {
      // Lo cobrado con ese medio, recargo incluido (es lo que realmente entró)
      const sales = byMethod.filter((x) => x.id === m.id).reduce((a, x) => a + x.amount + Number(x.surcharge), 0);
      const coll = collections.filter((x) => x.id === m.id).reduce((a, x) => a + x.amount + Number(x.surcharge), 0);
      const base = m.id === firstCash ? shift.opening_cash + cash.ingresos - cash.retiros : 0;
      return { id: m.id as number, name: m.name as string, kind: m.kind as string, amount: Math.round((base + sales + coll) * 100) / 100 };
    });
  const expected_total = expected.reduce((a, m) => a + m.amount, 0);

  return { shift, totals, byMethod, collections, cash, items, cashSales, cashCollections, expected_cash, expected, expected_total, methods };
}

export type ShiftSummary = NonNullable<Awaited<ReturnType<typeof shiftSummary>>>;

/** Versión para el empleado: sin montos esperados ni totales (cierre a ciegas). */
export function blindSummary(s: ShiftSummary) {
  const sh = s.shift;
  return {
    blind: true,
    shift: {
      id: sh.id, status: sh.status, opened_at: sh.opened_at, closed_at: sh.closed_at, user_id: sh.user_id, user_name: sh.user_name,
      shift_type_name: sh.shift_type_name, opening_cash: sh.opening_cash, opening_pending: !!sh.opening_pending,
    },
    totals: { sales_count: s.totals.sales_count, voided_count: s.totals.voided_count },
    items: s.items.map((i) => ({ product_name: i.product_name, category_name: i.category_name, qty: i.qty })),
    methods: s.methods.map((m) => ({ id: m.id, name: m.name, kind: m.kind })),
  };
}
