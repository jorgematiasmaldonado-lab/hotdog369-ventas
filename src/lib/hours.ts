import { sql, type Tx } from "./db";
import { ApiError, str } from "./api";
import { audit } from "./audit";
import { schemaOk } from "./schema";

export const OFF_TYPES = ["franco", "vacaciones", "enfermedad", "falta", "licencia", "otro"] as const;

export async function personalEnabled(db: Tx = sql) {
  try {
    const [m] = await db`SELECT enabled FROM modules WHERE key = 'personal'`;
    return !!m?.enabled;
  } catch {
    return false;
  }
}

/** Fichar entrada. Devuelve null si ya estaba adentro. */
export async function clockIn(tx: Tx, userId: number, opts: { shiftId?: number | null; source?: "fichada" | "turno" } = {}) {
  const [open] = await tx`SELECT id FROM time_entries WHERE user_id = ${userId} AND clock_out IS NULL`;
  if (open) return null;
  // Se guarda el valor hora vigente: si después cambia, las horas ya trabajadas no se recalculan
  const [e] = (await schemaOk())
    ? await tx`INSERT INTO time_entries (user_id, clock_in, shift_id, source, created_by, hourly_rate)
        VALUES (${userId}, now(), ${opts.shiftId ?? null}, ${opts.source ?? "fichada"}, ${userId}, (SELECT hourly_rate FROM users WHERE id = ${userId})) RETURNING *`
    : await tx`INSERT INTO time_entries (user_id, clock_in, shift_id, source, created_by)
        VALUES (${userId}, now(), ${opts.shiftId ?? null}, ${opts.source ?? "fichada"}, ${userId}) RETURNING *`;
  await audit(tx, userId, "entrada", "horas", e.id);
  return e;
}

/** Fichar salida. Devuelve null si no estaba adentro. */
export async function clockOut(tx: Tx, userId: number) {
  const [e] = await tx`UPDATE time_entries SET clock_out = GREATEST(now(), clock_in + interval '1 minute')
    WHERE user_id = ${userId} AND clock_out IS NULL RETURNING *`;
  if (e) await audit(tx, userId, "salida", "horas", e.id);
  return e ?? null;
}

export function parseDateTime(v: unknown, field: string, required = true): Date | null {
  const s = str(v, field, { required, max: 40 });
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new ApiError(400, `"${field}" no es una fecha y hora válida`);
  if (d.getTime() > Date.now() + 5 * 60000) throw new ApiError(400, `"${field}" no puede ser una fecha futura`);
  return d;
}

/** Valor hora opcional (vacío = sin valor) */
export function parseRate(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 10_000_000) throw new ApiError(400, "El valor hora no es válido.");
  return Math.round(n * 100) / 100;
}
