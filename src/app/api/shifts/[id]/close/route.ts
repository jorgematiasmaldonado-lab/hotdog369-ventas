import { sql } from "@/lib/db";
import { route, body, num, str, id, ApiError } from "@/lib/api";
import { requireUser, can } from "@/lib/auth";
import { shiftSummary } from "@/lib/shifts";
import { audit } from "@/lib/audit";

// Cerrar turno con arqueo
export const POST = route(async (req, { params }) => {
  const user = await requireUser("turnos.operar");
  const shiftId = id(await params);
  const b = await body(req);
  const counted = num(b.counted_cash, "efectivo contado", { min: 0 })!;
  const notes = str(b.notes, "observaciones", { required: false, max: 1000 });
  return sql.begin(async (tx) => {
    const [s] = await tx`SELECT * FROM shifts WHERE id = ${shiftId} FOR UPDATE`;
    if (!s) throw new ApiError(404, "El turno no existe.");
    if (s.status !== "abierto") throw new ApiError(409, "El turno ya está cerrado.");
    if (s.user_id !== user.id && !can(user, "ventas.editar")) throw new ApiError(403, "Solo podés cerrar tu propio turno.");
    const sum = (await shiftSummary(shiftId, tx))!;
    const diff = counted - sum.expected_cash;
    await tx`UPDATE shifts SET status = 'cerrado', closed_at = now(), expected_cash = ${sum.expected_cash},
      counted_cash = ${counted}, difference = ${diff}, notes = ${notes} WHERE id = ${shiftId}`;
    await audit(tx, user.id, "cerrar", "turno", shiftId, undefined,
      { expected_cash: sum.expected_cash, counted_cash: counted, difference: diff }, notes);
    return { expected_cash: sum.expected_cash, counted_cash: counted, difference: diff };
  });
});
