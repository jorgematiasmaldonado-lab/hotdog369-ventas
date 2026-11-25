import { sql, TZ } from "./db";
import { addDays, daysBetween, localDate } from "./dates";
import { schemaOk } from "./schema";

const inRange = (from: string, to: string, col = sql`s.created_at`) =>
  sql`(${col} AT TIME ZONE ${TZ})::date BETWEEN ${from}::date AND ${to}::date`;

async function kpis(from: string, to: string, until?: Date) {
  const cap = until ? sql`AND s.created_at <= ${until}` : sql``;
  const v2 = await schemaOk();
  const [t] = await sql`
    SELECT count(*) FILTER (WHERE status='confirmada')::int AS count,
           COALESCE(sum(total) FILTER (WHERE status='confirmada'),0) AS total,
           count(*) FILTER (WHERE status='anulada')::int AS voided_count,
           COALESCE(sum(total) FILTER (WHERE status='anulada'),0) AS voided_total,
           ${v2 ? sql`COALESCE(sum(surcharge_total) FILTER (WHERE status='confirmada'),0)` : sql`0`}::numeric AS surcharge
    FROM sales s WHERE ${inRange(from, to)} ${cap}`;
  const methods = await sql`
    SELECT pm.id, pm.name, pm.kind, pm.color, COALESCE(sum(sp.amount),0) AS amount, count(DISTINCT s.id)::int AS count,
      COALESCE(sum(${v2 ? sql`sp.surcharge` : sql`0`}),0)::numeric AS surcharge
    FROM sale_payments sp JOIN sales s ON s.id = sp.sale_id JOIN payment_methods pm ON pm.id = sp.payment_method_id
    WHERE s.status='confirmada' AND ${inRange(from, to)} ${cap}
    GROUP BY pm.id ORDER BY amount DESC`;
  const byKind = (k: string) => methods.filter((m) => m.kind === k).reduce((a, m) => a + m.amount, 0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const base = t as Record<string, any>;
  return {
    ...base,
    total: t.total as number,
    count: t.count as number,
    avg_ticket: t.count ? t.total / t.count : 0,
    efectivo: byKind("efectivo"),
    transferencia: byKind("transferencia"),
    otros: byKind("otro"),
    fiado: byKind("fiado"),
    methods,
  };
}

export async function dashboard(from: string, to: string) {
  const today = localDate();
  const len = daysBetween(from, to);
  const shift = len <= 7 ? 7 : len;
  const pFrom = addDays(from, -shift), pTo = addDays(to, -shift);
  const includesToday = to >= today;

  const [current, previous, hourly, daily, top, openShifts, [fiados], recent] = await Promise.all([
    kpis(from, to),
    kpis(pFrom, pTo, includesToday ? new Date(Date.now() - shift * 86400000) : undefined),
    sql`SELECT extract(hour FROM s.created_at AT TIME ZONE ${TZ})::int AS hour, count(*)::int AS count, sum(total) AS total
        FROM sales s WHERE s.status='confirmada' AND ${inRange(from, to)} GROUP BY 1 ORDER BY 1`,
    sql`SELECT (s.created_at AT TIME ZONE ${TZ})::date::text AS day, count(*)::int AS count, sum(total) AS total
        FROM sales s WHERE s.status='confirmada' AND ${inRange(from, to)} GROUP BY 1 ORDER BY 1`,
    sql`SELECT si.product_name AS name, sum(si.qty)::int AS qty, sum(si.subtotal) AS amount
        FROM sale_items si JOIN sales s ON s.id = si.sale_id
        WHERE s.status='confirmada' AND ${inRange(from, to)} GROUP BY 1 ORDER BY qty DESC, amount DESC LIMIT 5`,
    sql`SELECT sh.id, sh.opened_at, u.name AS user_name, st.name AS shift_type_name,
          (SELECT COALESCE(sum(total),0) FROM sales WHERE shift_id = sh.id AND status='confirmada') AS total,
          (SELECT count(*)::int FROM sales WHERE shift_id = sh.id AND status='confirmada') AS count
        FROM shifts sh JOIN users u ON u.id = sh.user_id LEFT JOIN shift_types st ON st.id = sh.shift_type_id
        WHERE sh.status='abierto' ORDER BY sh.opened_at`,
    sql`SELECT COALESCE(sum(CASE WHEN type='cargo' THEN amount ELSE -amount END),0) AS pending FROM customer_movements`,
    sql`SELECT s.id, s.number, s.created_at, s.total, s.status, u.name AS user_name,
          (SELECT string_agg(pm.name, ' + ') FROM sale_payments sp JOIN payment_methods pm ON pm.id = sp.payment_method_id WHERE sp.sale_id = s.id) AS methods,
          (SELECT string_agg(si.qty || '× ' || si.product_name, ', ') FROM sale_items si WHERE si.sale_id = s.id) AS detail
        FROM sales s JOIN users u ON u.id = s.user_id WHERE ${inRange(from, to)} ORDER BY s.created_at DESC LIMIT 8`,
  ]);
  return { from, to, prevFrom: pFrom, prevTo: pTo, current, previous, hourly, daily, top, openShifts, fiadoPending: fiados.pending, recent };
}

export async function reports(from: string, to: string) {
  const [summary, daily, dailyMethods, heat, products, categories, byUser, shifts, voids, expensesDaily, expensesCat, fiadoCustomers, fiadoDaily] =
    await Promise.all([
      kpis(from, to),
      sql`SELECT (s.created_at AT TIME ZONE ${TZ})::date::text AS day, count(*)::int AS count, sum(total) AS total
          FROM sales s WHERE s.status='confirmada' AND ${inRange(from, to)} GROUP BY 1 ORDER BY 1`,
      sql`SELECT (s.created_at AT TIME ZONE ${TZ})::date::text AS day, pm.name, pm.kind, sum(sp.amount) AS amount
          FROM sale_payments sp JOIN sales s ON s.id = sp.sale_id JOIN payment_methods pm ON pm.id = sp.payment_method_id
          WHERE s.status='confirmada' AND ${inRange(from, to)} GROUP BY 1, pm.id ORDER BY 1, pm.sort`,
      sql`SELECT extract(dow FROM s.created_at AT TIME ZONE ${TZ})::int AS dow, extract(hour FROM s.created_at AT TIME ZONE ${TZ})::int AS hour,
            count(*)::int AS count, sum(total) AS total
          FROM sales s WHERE s.status='confirmada' AND ${inRange(from, to)} GROUP BY 1, 2`,
      sql`SELECT si.product_name AS name, si.category_name AS category, sum(si.qty)::int AS qty, sum(si.subtotal) AS amount
          FROM sale_items si JOIN sales s ON s.id = si.sale_id
          WHERE s.status='confirmada' AND ${inRange(from, to)} GROUP BY 1, 2 ORDER BY qty DESC`,
      sql`SELECT COALESCE(si.category_name,'Sin categoría') AS name, sum(si.qty)::int AS qty, sum(si.subtotal) AS amount
          FROM sale_items si JOIN sales s ON s.id = si.sale_id
          WHERE s.status='confirmada' AND ${inRange(from, to)} GROUP BY 1 ORDER BY amount DESC`,
      sql`SELECT u.name, count(*) FILTER (WHERE s.status='confirmada')::int AS count,
            COALESCE(sum(s.total) FILTER (WHERE s.status='confirmada'),0) AS total,
            count(*) FILTER (WHERE s.status='anulada')::int AS voided_count,
            COALESCE(sum(s.total) FILTER (WHERE s.status='anulada'),0) AS voided_total
          FROM sales s JOIN users u ON u.id = s.user_id WHERE ${inRange(from, to)} GROUP BY u.id ORDER BY total DESC`,
      sql`SELECT sh.id, sh.status, sh.opened_at, sh.closed_at, sh.opening_cash, sh.expected_cash, sh.counted_cash, sh.difference, sh.notes,
            u.name AS user_name, st.name AS shift_type_name,
            (SELECT COALESCE(sum(total),0) FROM sales WHERE shift_id = sh.id AND status='confirmada') AS total,
            (SELECT count(*)::int FROM sales WHERE shift_id = sh.id AND status='confirmada') AS count
          FROM shifts sh JOIN users u ON u.id = sh.user_id LEFT JOIN shift_types st ON st.id = sh.shift_type_id
          WHERE ${inRange(from, to, sql`sh.opened_at`)} ORDER BY sh.opened_at DESC`,
      sql`SELECT s.id, s.number, s.created_at, s.voided_at, s.total, s.void_reason, u.name AS user_name, vu.name AS voided_by_name
          FROM sales s JOIN users u ON u.id = s.user_id LEFT JOIN users vu ON vu.id = s.voided_by
          WHERE s.status='anulada' AND ${inRange(from, to)} ORDER BY s.created_at DESC`,
      sql`SELECT date::text AS day, sum(amount) AS amount FROM expenses
          WHERE deleted_at IS NULL AND date BETWEEN ${from}::date AND ${to}::date GROUP BY 1 ORDER BY 1`,
      sql`SELECT COALESCE(ec.name,'Sin categoría') AS name, sum(e.amount) AS amount FROM expenses e
          LEFT JOIN expense_categories ec ON ec.id = e.category_id
          WHERE e.deleted_at IS NULL AND e.date BETWEEN ${from}::date AND ${to}::date GROUP BY 1 ORDER BY 2 DESC`,
      sql`SELECT c.id, c.name, c.phone,
            sum(CASE WHEN m.type='cargo' THEN m.amount ELSE -m.amount END) AS balance,
            min(m.created_at) FILTER (WHERE m.type='cargo') AS first_debt_at
          FROM customers c JOIN customer_movements m ON m.customer_id = c.id
          GROUP BY c.id HAVING sum(CASE WHEN m.type='cargo' THEN m.amount ELSE -m.amount END) > 0 ORDER BY balance DESC`,
      sql`SELECT d::date::text AS day,
            (SELECT COALESCE(sum(CASE WHEN type='cargo' THEN amount ELSE -amount END),0) FROM customer_movements
             WHERE (created_at AT TIME ZONE ${TZ})::date <= d::date) AS balance
          FROM generate_series(${from}::date, ${to}::date, interval '1 day') d`,
    ]);

  // Rankings de días y horarios
  const dowAgg = Array.from({ length: 7 }, (_, dow) => {
    const cells = heat.filter((h) => h.dow === dow);
    return { dow, count: cells.reduce((a, c) => a + c.count, 0), total: cells.reduce((a, c) => a + c.total, 0) };
  });
  const hourAgg = Array.from({ length: 24 }, (_, hour) => {
    const cells = heat.filter((h) => h.hour === hour);
    return { hour, count: cells.reduce((a, c) => a + c.count, 0), total: cells.reduce((a, c) => a + c.total, 0) };
  }).filter((h) => h.count > 0);

  const expensesTotal = expensesCat.reduce((a, e) => a + e.amount, 0);
  return {
    from, to, summary, daily, dailyMethods, heat, dowAgg, hourAgg, products, categories, byUser, shifts, voids,
    expenses: { daily: expensesDaily, byCategory: expensesCat, total: expensesTotal },
    result: { sales: summary.total, expenses: expensesTotal, net: summary.total - expensesTotal },
    fiados: { customers: fiadoCustomers, daily: fiadoDaily, total: fiadoCustomers.reduce((a, c) => a + c.balance, 0) },
  };
}
