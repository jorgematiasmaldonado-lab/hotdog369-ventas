import { sql } from "@/lib/db";
import { route, body, num, id, ApiError } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { shiftSummary } from "@/lib/shifts";
import { schemaOk } from "@/lib/schema";

// El administrador carga (o corrige) la caja inicial de un turno; si ya cerró, se recalcula el arqueo
export const PUT = route(async (req, { params }) => {
  const user = await requireUser("caja.gestionar");
  if (!(await schemaOk())) throw new ApiError(409, "Falta actualizar la base de datos.");
  const shiftId = id(await params);
  const amount = num((await body(req)).opening_cash, "caja inicial", { min: 0 })!;
  return sql.begin(async (tx) => {
    const [s] = await tx`SELECT * FROM shifts WHERE id = ${shiftId} FOR UPDATE`;
    if (!s) throw new ApiError(404, "El turno no existe.");
    await tx`UPDATE shifts SET opening_cash = ${amount}, opening_pending = false WHERE id = ${shiftId}`;
    if (s.status === "cerrado") {
      const sum = (await shiftSummary(shiftId, tx))!;
      const declared = (s.declared ?? {}) as Record<string, number>;
      const cashDeclared = sum.expected.filter((m) => m.kind === "efectivo").reduce((a, m) => a + Number(declared[m.id] ?? 0), 0);
      const counted = s.declared ? cashDeclared : s.counted_cash;
      await tx`UPDATE shifts SET expected_cash = ${sum.expected_cash}, difference = ${counted === null ? null : counted - sum.expected_cash},
        expected = ${tx.json(Object.fromEntries(sum.expected.map((m) => [m.id, m.amount])))}, expected_total = ${sum.expected_total}
        WHERE id = ${shiftId}`;
    }
    await audit(tx, user.id, "caja_inicial", "turno", shiftId, { opening_cash: s.opening_cash, pendiente: s.opening_pending }, { opening_cash: amount });
    return { ok: true };
  });
});
