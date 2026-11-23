import { sql } from "@/lib/db";
import { route, body, str } from "@/lib/api";
import { requireUser, requireModule } from "@/lib/auth";
import { audit } from "@/lib/audit";

// Clientes con saldo (fiados)
export const GET = route(async (req) => {
  await requireUser("fiados.ver", "fiados.gestionar", "ventas.crear");
  await requireModule("fiados");
  const q = new URL(req.url).searchParams.get("q")?.trim();
  return sql`
    SELECT c.id, c.name, c.phone, c.notes, c.active,
      COALESCE(sum(CASE WHEN m.type IN ('cargo') THEN m.amount WHEN m.type IN ('pago','anulacion','ajuste') THEN -m.amount END), 0) AS balance,
      min(m.created_at) FILTER (WHERE m.type = 'cargo') AS first_debt_at,
      max(m.created_at) AS last_movement_at
    FROM customers c LEFT JOIN customer_movements m ON m.customer_id = c.id
    WHERE c.active ${q ? sql`AND c.name ILIKE ${"%" + q + "%"}` : sql``}
    GROUP BY c.id ORDER BY balance DESC, c.name LIMIT 500`;
});

export const POST = route(async (req) => {
  const user = await requireUser("fiados.gestionar");
  await requireModule("fiados");
  const b = await body(req);
  const [c] = await sql`INSERT INTO customers (name, phone, notes) VALUES (${str(b.name, "nombre", { max: 120 })},
    ${str(b.phone, "teléfono", { required: false, max: 40 })}, ${str(b.notes, "notas", { required: false })}) RETURNING *`;
  await audit(sql, user.id, "crear", "cliente", c.id, undefined, c);
  return c;
});
