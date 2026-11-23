import { after } from "next/server";
import { notifyLowStock } from "@/lib/push";
import { sql, TZ } from "@/lib/db";
import { route, body, ApiError } from "@/lib/api";
import { requireUser, can } from "@/lib/auth";
import { createSale, type SaleInput } from "@/lib/sales";
import { resolveRange } from "@/lib/dates";

export const POST = route(async (req) => {
  const user = await requireUser("ventas.crear");
  const input = await body<SaleInput>(req);
  if ((input.customer_id || input.new_customer) && !can(user, "fiados.gestionar"))
    throw new ApiError(403, "No tenés permiso para registrar fiados.");
  const res = await createSale(user, input);
  if ("low_stock" in res && res.low_stock?.length) after(() => notifyLowStock(res.low_stock));
  return res;
});

// Listado de ventas. Empleados: solo su turno abierto. Admin/dueño: filtros por fecha, estado, usuario, medio de pago.
export const GET = route(async (req) => {
  const user = await requireUser("ventas.crear", "ventas.ver_todas");
  const u = new URL(req.url);
  const all = can(user, "ventas.ver_todas");
  const status = u.searchParams.get("status");
  const userId = Number(u.searchParams.get("user_id")) || null;
  const pm = Number(u.searchParams.get("payment_method_id")) || null;
  const q = u.searchParams.get("q")?.trim();
  const limit = Math.min(Number(u.searchParams.get("limit")) || 100, 500);

  let where = sql`TRUE`;
  if (!all || u.searchParams.get("scope") === "turno") {
    const [s] = await sql`SELECT id FROM shifts WHERE user_id = ${user.id} AND status = 'abierto'`;
    if (!s) return { sales: [], summary: null };
    where = sql`s.shift_id = ${s.id}`;
  } else {
    const shiftId = Number(u.searchParams.get("shift_id")) || null;
    if (shiftId) where = sql`s.shift_id = ${shiftId}`;
    else {
      const { from, to } = resolveRange(u.searchParams.get("range") ?? "hoy", u.searchParams.get("from"), u.searchParams.get("to"));
      where = sql`(s.created_at AT TIME ZONE ${TZ})::date BETWEEN ${from}::date AND ${to}::date`;
    }
  }

  const rows = await sql`
    SELECT s.id, s.number, s.created_at, s.total, s.status, s.void_reason, s.voided_at, s.edited_at, s.offline,
           s.cash_received, s.change_given,
           u.name AS user_name, vu.name AS voided_by_name, c.name AS customer_name,
           (SELECT json_agg(json_build_object('name', si.product_name, 'qty', si.qty, 'subtotal', si.subtotal) ORDER BY si.id)
              FROM sale_items si WHERE si.sale_id = s.id) AS items,
           (SELECT json_agg(json_build_object('name', pm.name, 'kind', pm.kind, 'amount', sp.amount) ORDER BY sp.id)
              FROM sale_payments sp JOIN payment_methods pm ON pm.id = sp.payment_method_id WHERE sp.sale_id = s.id) AS payments
    FROM sales s JOIN users u ON u.id = s.user_id LEFT JOIN users vu ON vu.id = s.voided_by LEFT JOIN customers c ON c.id = s.customer_id
    WHERE ${where}
      ${status === "anulada" || status === "confirmada" ? sql`AND s.status = ${status}` : sql``}
      ${userId ? sql`AND s.user_id = ${userId}` : sql``}
      ${pm ? sql`AND EXISTS (SELECT 1 FROM sale_payments x WHERE x.sale_id = s.id AND x.payment_method_id = ${pm})` : sql``}
      ${q ? sql`AND (s.number::text = ${q} OR EXISTS (SELECT 1 FROM sale_items x WHERE x.sale_id = s.id AND x.product_name ILIKE ${"%" + q + "%"}) OR c.name ILIKE ${"%" + q + "%"})` : sql``}
    ORDER BY s.created_at DESC LIMIT ${limit}`;
  return { sales: rows };
});
