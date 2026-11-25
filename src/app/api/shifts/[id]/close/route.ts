import { sql } from "@/lib/db";
import { route, body, num, str, id, ApiError } from "@/lib/api";
import { requireUser, can } from "@/lib/auth";
import { clockOut, personalEnabled } from "@/lib/hours";
import { shiftSummary } from "@/lib/shifts";
import { audit } from "@/lib/audit";
import { schemaOk } from "@/lib/schema";

// Cerrar turno "a ciegas": el empleado declara lo que hay por cada medio de pago, sin ver lo esperado.
// El administrador y el dueño comparan después lo declarado con lo que debería haber.
export const POST = route(async (req, { params }) => {
  const user = await requireUser("turnos.operar");
  const shiftId = id(await params);
  const b = await body(req);
  const notes = str(b.notes, "observaciones", { required: false, max: 1000 });
  const v2 = await schemaOk();
  const res = await sql.begin(async (tx) => {
    const [s] = await tx`SELECT * FROM shifts WHERE id = ${shiftId} FOR UPDATE`;
    if (!s) throw new ApiError(404, "El turno no existe.");
    if (s.status !== "abierto") throw new ApiError(409, "El turno ya está cerrado.");
    if (s.user_id !== user.id && !can(user, "ventas.editar")) throw new ApiError(403, "Solo podés cerrar tu propio turno.");
    const sum = (await shiftSummary(shiftId, tx))!;

    // Lo declarado: { <id medio de pago>: monto }. Compatibilidad: "counted_cash" = solo efectivo.
    const declared: Record<string, number> = {};
    const raw = (b.declared && typeof b.declared === "object" ? b.declared : {}) as Record<string, unknown>;
    for (const m of sum.expected) declared[m.id] = num(raw[m.id] ?? 0, `monto de ${m.name}`, { min: 0 })!;
    if (!b.declared && b.counted_cash !== undefined) {
      const cashId = sum.expected.find((m) => m.kind === "efectivo")?.id;
      if (cashId) declared[cashId] = num(b.counted_cash, "efectivo contado", { min: 0 })!;
    }
    const counted = sum.expected.filter((m) => m.kind === "efectivo").reduce((a, m) => a + declared[m.id], 0);
    const declaredTotal = Object.values(declared).reduce((a, v) => a + v, 0);
    const diff = counted - sum.expected_cash;

    if (v2)
      await tx`UPDATE shifts SET status = 'cerrado', closed_at = now(), expected_cash = ${sum.expected_cash},
        counted_cash = ${counted}, difference = ${diff}, notes = ${notes},
        declared = ${tx.json(declared)}, expected = ${tx.json(Object.fromEntries(sum.expected.map((m) => [m.id, m.amount])))},
        declared_total = ${declaredTotal}, expected_total = ${sum.expected_total}
        WHERE id = ${shiftId}`;
    else
      await tx`UPDATE shifts SET status = 'cerrado', closed_at = now(), expected_cash = ${sum.expected_cash},
        counted_cash = ${counted}, difference = ${diff}, notes = ${notes} WHERE id = ${shiftId}`;
    await audit(tx, user.id, "cerrar", "turno", shiftId, undefined,
      { declarado: declaredTotal, esperado: sum.expected_total, efectivo_contado: counted, efectivo_esperado: sum.expected_cash }, notes);
    if (b.clock_out === true && s.user_id === user.id && can(user, "horas.fichar") && (await personalEnabled(tx))) await clockOut(tx, user.id);
    return { expected_cash: sum.expected_cash, counted_cash: counted, difference: diff, declared_total: declaredTotal, expected_total: sum.expected_total };
  });
  // El empleado no recibe lo esperado ni las diferencias
  if (!can(user, "turnos.ver_todos")) return { ok: true, declared_total: res.declared_total };
  return res;
});
