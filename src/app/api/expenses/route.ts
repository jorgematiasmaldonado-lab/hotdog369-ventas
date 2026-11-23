import { sql, TZ } from "@/lib/db";
import { route, body } from "@/lib/api";
import { parseExpense } from "@/lib/expenses";
import { requireUser, requireModule } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { resolveRange } from "@/lib/dates";

export const GET = route(async (req) => {
  await requireUser("gastos.ver", "gastos.gestionar");
  await requireModule("gastos");
  const u = new URL(req.url);
  const { from, to } = resolveRange(u.searchParams.get("range") ?? "mes", u.searchParams.get("from"), u.searchParams.get("to"));
  const rows = await sql`
    SELECT e.id, e.date::text AS date, e.supplier, e.category_id, ec.name AS category_name, e.amount, e.payment_method_id,
           pm.name AS payment_method, e.notes, (e.receipt_image IS NOT NULL) AS has_receipt, u.name AS user_name, e.created_at
    FROM expenses e LEFT JOIN expense_categories ec ON ec.id = e.category_id
    LEFT JOIN payment_methods pm ON pm.id = e.payment_method_id LEFT JOIN users u ON u.id = e.user_id
    WHERE e.deleted_at IS NULL AND e.date BETWEEN ${from}::date AND ${to}::date
    ORDER BY e.date DESC, e.id DESC`;
  const byCategory = await sql`
    SELECT COALESCE(ec.name, 'Sin categoría') AS name, sum(e.amount) AS amount
    FROM expenses e LEFT JOIN expense_categories ec ON ec.id = e.category_id
    WHERE e.deleted_at IS NULL AND e.date BETWEEN ${from}::date AND ${to}::date GROUP BY 1 ORDER BY 2 DESC`;
  void TZ;
  return { from, to, expenses: rows, byCategory, total: rows.reduce((a, r) => a + r.amount, 0) };
});

export const POST = route(async (req) => {
  const user = await requireUser("gastos.gestionar");
  await requireModule("gastos");
  const e = parseExpense(await body(req));
  const [row] = await sql`INSERT INTO expenses (branch_id, date, supplier, category_id, amount, payment_method_id, notes, receipt_image, user_id)
    VALUES (${user.branch_id}, ${e.date}, ${e.supplier}, ${e.category_id}, ${e.amount}, ${e.payment_method_id}, ${e.notes}, ${e.receipt_image}, ${user.id})
    RETURNING id`;
  await audit(sql, user.id, "crear", "gasto", row.id, undefined, { ...e, receipt_image: e.receipt_image ? "(imagen)" : null });
  return row;
});
