import { sql } from "@/lib/db";
import { route, body, id, ApiError } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { parseExpense } from "@/lib/expenses";

export const GET = route(async (_req, { params }) => {
  await requireUser("gastos.ver", "gastos.gestionar");
  const [e] = await sql`SELECT *, date::text AS date FROM expenses WHERE id = ${id(await params)} AND deleted_at IS NULL`;
  if (!e) throw new ApiError(404, "El gasto no existe.");
  return e;
});

export const PUT = route(async (req, { params }) => {
  const user = await requireUser("gastos.gestionar");
  const eid = id(await params);
  const b = await body(req);
  const [before] = await sql`SELECT *, date::text AS date FROM expenses WHERE id = ${eid} AND deleted_at IS NULL`;
  if (!before) throw new ApiError(404, "El gasto no existe.");
  const e = parseExpense({ ...b, receipt_image: b.receipt_image === undefined ? before.receipt_image : b.receipt_image });
  await sql`UPDATE expenses SET date = ${e.date}, supplier = ${e.supplier}, category_id = ${e.category_id}, amount = ${e.amount},
    payment_method_id = ${e.payment_method_id}, notes = ${e.notes}, receipt_image = ${e.receipt_image} WHERE id = ${eid}`;
  const strip = (x: Record<string, unknown>) => ({ ...x, receipt_image: x.receipt_image ? "(imagen)" : null });
  await audit(sql, user.id, "editar", "gasto", eid, strip(before), strip(e));
  return { ok: true };
});

export const DELETE = route(async (_req, { params }) => {
  const user = await requireUser("gastos.gestionar");
  const eid = id(await params);
  const [e] = await sql`UPDATE expenses SET deleted_at = now() WHERE id = ${eid} AND deleted_at IS NULL RETURNING id, amount, date::text AS date, supplier`;
  if (!e) throw new ApiError(404, "El gasto no existe.");
  await audit(sql, user.id, "eliminar", "gasto", eid, e);
  return { ok: true };
});
