import { sql } from "@/lib/db";
import { route, body, num, str, ApiError } from "@/lib/api";
import { requireUser, can } from "@/lib/auth";
import { clockIn, personalEnabled } from "@/lib/hours";
import { schemaOk } from "@/lib/schema";
import { getNextOpeningCash } from "@/lib/opening";
import { audit } from "@/lib/audit";
import { resolveRange, minutesSinceStart, hhmmToMin, localClock } from "@/lib/dates";
import { TZ } from "@/lib/db";

// Listado de turnos (todos para admin/dueño, propios para empleados)
export const GET = route(async (req) => {
  const user = await requireUser("turnos.operar", "turnos.ver_todos");
  const u = new URL(req.url);
  const { from, to } = resolveRange(u.searchParams.get("range") ?? "mes", u.searchParams.get("from"), u.searchParams.get("to"));
  const all = can(user, "turnos.ver_todos");
  const extra = (await schemaOk()) ? sql`s.opening_pending, s.declared_total, s.expected_total, s.late_minutes, s.arrived_at, s.late_reason,` : sql``;
  const rows = await sql`
    SELECT s.id, s.status, s.opened_at, s.closed_at, s.opening_cash, s.expected_cash, s.counted_cash, s.difference, s.notes, ${extra}
           u.name AS user_name, st.name AS shift_type_name,
           (SELECT COALESCE(sum(total),0) FROM sales WHERE shift_id = s.id AND status = 'confirmada') AS sales_total,
           (SELECT count(*)::int FROM sales WHERE shift_id = s.id AND status = 'confirmada') AS sales_count
    FROM shifts s JOIN users u ON u.id = s.user_id LEFT JOIN shift_types st ON st.id = s.shift_type_id
    WHERE (s.opened_at AT TIME ZONE ${TZ})::date BETWEEN ${from}::date AND ${to}::date
      ${all ? sql`` : sql`AND s.user_id = ${user.id}`}
    ORDER BY s.opened_at DESC LIMIT 300`;
  if (all) return rows;
  return rows.map((r) => ({ id: r.id, status: r.status, opened_at: r.opened_at, closed_at: r.closed_at, user_name: r.user_name, shift_type_name: r.shift_type_name, sales_count: r.sales_count }));
});

// Abrir turno
export const POST = route(async (req) => {
  const user = await requireUser("turnos.operar");
  const b = await body(req);
  const typeId = num(b.shift_type_id, "turno", { required: false, int: true });
  const v2 = await schemaOk();
  const admin = can(user, "caja.gestionar");
  return sql.begin(async (tx) => {
    const [open] = await tx`SELECT id FROM shifts WHERE user_id = ${user.id} AND status = 'abierto'`;
    if (open) throw new ApiError(409, "Ya tenés un turno abierto.");
    // ¿Abre tarde? (más que la tolerancia después del horario del turno)
    let late: { minutes: number; arrived: Date; reason: string } | null = null;
    if (v2 && typeId) {
      const [t] = await tx`SELECT name, to_char(start_time, 'HH24:MI') AS start_time, days FROM shift_types WHERE id = ${typeId}`;
      const [tol] = await tx`SELECT value FROM settings WHERE key = 'late_tolerance_min'`;
      const since = minutesSinceStart(t?.start_time, t?.days);
      if (since && since.minutes > Number(tol?.value ?? 15)) {
        const reason = str(b.late_reason, "motivo", { required: false, max: 300 });
        const at = typeof b.arrived_time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(b.arrived_time) ? b.arrived_time : null;
        if (!at || !reason || reason.length < 3)
          throw new ApiError(400, `Estás abriendo el turno ${t.name} fuera de horario: indicá a qué hora llegaste y el motivo.`);
        // Hora de llegada de hoy (o de ayer si es mayor que la hora actual)
        const now = new Date();
        const back = (localClock(now).minutes - hhmmToMin(at) + 1440) % 1440;
        if (back > 12 * 60) throw new ApiError(400, "La hora de llegada no es válida.");
        late = { minutes: since.minutes, arrived: new Date(now.getTime() - back * 60000), reason };
      }
    }
    // La caja inicial la define el administrador: el empleado no la puede cambiar
    const next = v2 ? await getNextOpeningCash(tx) : null;
    let opening: number, pending = false;
    if (!v2 || admin) opening = num(b.opening_cash ?? next ?? 0, "monto inicial", { min: 0 })!;
    else if (next === null) { opening = 0; pending = true; }
    else opening = next;
    const [s] = v2
      ? await tx`INSERT INTO shifts (branch_id, user_id, shift_type_id, opening_cash, opening_pending, opening_confirmed, opening_note)
          VALUES (${user.branch_id}, ${user.id}, ${typeId}, ${opening}, ${pending}, ${pending ? null : b.opening_confirmed === true},
                  ${str(b.opening_note, "observación", { required: false, max: 300 })}) RETURNING *`
      : await tx`INSERT INTO shifts (branch_id, user_id, shift_type_id, opening_cash)
          VALUES (${user.branch_id}, ${user.id}, ${typeId}, ${opening}) RETURNING *`;
    if (late) await tx`UPDATE shifts SET late_minutes = ${late.minutes}, arrived_at = ${late.arrived}, late_reason = ${late.reason} WHERE id = ${s.id}`;
    // El monto cargado por el administrador se usa una sola vez
    if (v2 && next !== null) await tx`DELETE FROM settings WHERE key = 'next_opening_cash'`;
    await audit(tx, user.id, "abrir", "turno", s.id, undefined, { opening_cash: opening, pendiente: pending, shift_type_id: typeId, tarde_min: late?.minutes }, (b.opening_note as string) || null);
    if (b.clock_in === true && can(user, "horas.fichar") && (await personalEnabled(tx))) await clockIn(tx, user.id, { shiftId: s.id, source: "turno" });
    return s;
  });
});
