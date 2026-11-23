import { sql } from "@/lib/db";
import { route, body, num, ApiError } from "@/lib/api";
import { requireUser, can } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { resolveRange } from "@/lib/dates";
import { TZ } from "@/lib/db";

// Listado de turnos (todos para admin/dueño, propios para empleados)
export const GET = route(async (req) => {
  const user = await requireUser("turnos.operar", "turnos.ver_todos");
  const u = new URL(req.url);
  const { from, to } = resolveRange(u.searchParams.get("range") ?? "mes", u.searchParams.get("from"), u.searchParams.get("to"));
  const all = can(user, "turnos.ver_todos");
  return sql`
    SELECT s.id, s.status, s.opened_at, s.closed_at, s.opening_cash, s.expected_cash, s.counted_cash, s.difference, s.notes,
           u.name AS user_name, st.name AS shift_type_name,
           (SELECT COALESCE(sum(total),0) FROM sales WHERE shift_id = s.id AND status = 'confirmada') AS sales_total,
           (SELECT count(*)::int FROM sales WHERE shift_id = s.id AND status = 'confirmada') AS sales_count
    FROM shifts s JOIN users u ON u.id = s.user_id LEFT JOIN shift_types st ON st.id = s.shift_type_id
    WHERE (s.opened_at AT TIME ZONE ${TZ})::date BETWEEN ${from}::date AND ${to}::date
      ${all ? sql`` : sql`AND s.user_id = ${user.id}`}
    ORDER BY s.opened_at DESC LIMIT 300`;
});

// Abrir turno
export const POST = route(async (req) => {
  const user = await requireUser("turnos.operar");
  const b = await body(req);
  const opening = num(b.opening_cash ?? 0, "monto inicial", { min: 0 })!;
  const typeId = num(b.shift_type_id, "turno", { required: false, int: true });
  return sql.begin(async (tx) => {
    const [open] = await tx`SELECT id FROM shifts WHERE user_id = ${user.id} AND status = 'abierto'`;
    if (open) throw new ApiError(409, "Ya tenés un turno abierto.");
    const [s] = await tx`INSERT INTO shifts (branch_id, user_id, shift_type_id, opening_cash)
      VALUES (${user.branch_id}, ${user.id}, ${typeId}, ${opening}) RETURNING *`;
    await audit(tx, user.id, "abrir", "turno", s.id, undefined, { opening_cash: opening, shift_type_id: typeId });
    return s;
  });
});
