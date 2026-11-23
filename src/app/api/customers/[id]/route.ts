import { sql } from "@/lib/db";
import { route, body, str, id, ApiError } from "@/lib/api";
import { requireUser, requireModule } from "@/lib/auth";
import { audit } from "@/lib/audit";

export const GET = route(async (_req, { params }) => {
  await requireUser("fiados.ver", "fiados.gestionar");
  await requireModule("fiados");
  const cid = id(await params);
  const [c] = await sql`SELECT * FROM customers WHERE id = ${cid}`;
  if (!c) throw new ApiError(404, "El cliente no existe.");
  const movements = await sql`
    SELECT m.id, m.type, m.amount, m.notes, m.created_at, m.sale_id, s.number AS sale_number, pm.name AS payment_method, u.name AS user_name,
      (SELECT string_agg(si.qty || '× ' || si.product_name, ', ') FROM sale_items si WHERE si.sale_id = m.sale_id) AS detail
    FROM customer_movements m LEFT JOIN sales s ON s.id = m.sale_id
    LEFT JOIN payment_methods pm ON pm.id = m.payment_method_id LEFT JOIN users u ON u.id = m.user_id
    WHERE m.customer_id = ${cid} ORDER BY m.created_at DESC, m.id DESC`;
  const balance = movements.reduce((a, m) => a + (m.type === "cargo" ? m.amount : -m.amount), 0);
  return { customer: c, movements, balance };
});

export const PUT = route(async (req, { params }) => {
  const user = await requireUser("fiados.gestionar");
  const cid = id(await params);
  const b = await body(req);
  const [before] = await sql`SELECT * FROM customers WHERE id = ${cid}`;
  if (!before) throw new ApiError(404, "El cliente no existe.");
  const [c] = await sql`UPDATE customers SET name = ${str(b.name, "nombre", { max: 120 })},
    phone = ${str(b.phone, "teléfono", { required: false, max: 40 })}, notes = ${str(b.notes, "notas", { required: false })}
    WHERE id = ${cid} RETURNING *`;
  await audit(sql, user.id, "editar", "cliente", cid, before, c);
  return c;
});
