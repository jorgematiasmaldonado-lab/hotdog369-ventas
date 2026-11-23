import { sql, TZ } from "@/lib/db";
import { route, body, str, num, ApiError } from "@/lib/api";
import { requireUser, requireModule } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { resolveRange } from "@/lib/dates";

export const GET = route(async (req) => {
  await requireUser("caja.gestionar", "turnos.ver_todos");
  await requireModule("caja");
  const u = new URL(req.url);
  const { from, to } = resolveRange(u.searchParams.get("range") ?? "mes", u.searchParams.get("from"), u.searchParams.get("to"));
  return sql`
    SELECT cm.*, u.name AS user_name, su.name AS shift_user_name
    FROM cash_movements cm LEFT JOIN users u ON u.id = cm.user_id
    LEFT JOIN shifts s ON s.id = cm.shift_id LEFT JOIN users su ON su.id = s.user_id
    WHERE (cm.created_at AT TIME ZONE ${TZ})::date BETWEEN ${from}::date AND ${to}::date
    ORDER BY cm.created_at DESC`;
});

export const POST = route(async (req) => {
  const user = await requireUser("caja.gestionar");
  await requireModule("caja");
  const b = await body(req);
  const type = b.type === "ingreso" || b.type === "retiro" ? b.type : null;
  if (!type) throw new ApiError(400, "Tipo inválido.");
  const amount = num(b.amount, "monto", { min: 1 })!;
  const reason = str(b.reason, "motivo", { max: 300 })!;
  let shiftId = num(b.shift_id, "turno", { required: false, int: true });
  if (!shiftId) {
    const [s] = await sql`SELECT id FROM shifts WHERE user_id = ${user.id} AND status = 'abierto'`;
    shiftId = s?.id ?? null;
  } else {
    const [s] = await sql`SELECT status FROM shifts WHERE id = ${shiftId}`;
    if (!s || s.status !== "abierto") throw new ApiError(400, "El turno indicado no está abierto.");
  }
  const [m] = await sql`INSERT INTO cash_movements (branch_id, shift_id, type, amount, reason, user_id)
    VALUES (${user.branch_id}, ${shiftId}, ${type}, ${amount}, ${reason}, ${user.id}) RETURNING *`;
  await audit(sql, user.id, "crear", "movimiento_caja", m.id, undefined, m);
  return m;
});
