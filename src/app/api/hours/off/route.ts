import { sql } from "@/lib/db";
import { route, body, num, str, ApiError } from "@/lib/api";
import { requireUser, requireModule } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { OFF_TYPES } from "@/lib/hours";

// Cargar franco / vacaciones / enfermedad / falta / licencia (uno o varios días)
export const POST = route(async (req) => {
  const me = await requireUser("horas.gestionar");
  await requireModule("personal");
  const b = await body(req);
  const userId = num(b.user_id, "empleado", { int: true })!;
  const type = str(b.type, "tipo", { max: 20 })!;
  if (!(OFF_TYPES as readonly string[]).includes(type)) throw new ApiError(400, "Tipo inválido.");
  const from = str(b.from ?? b.date, "fecha", { max: 10 })!;
  const to = str(b.to ?? from, "hasta", { max: 10 })!;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || to < from) throw new ApiError(400, "Fechas inválidas.");
  const notes = str(b.notes, "nota", { required: false, max: 300 });
  const rows = await sql`INSERT INTO time_off (user_id, date, type, notes, created_by)
    SELECT ${userId}, d::date, ${type}, ${notes}, ${me.id} FROM generate_series(${from}::date, ${to}::date, interval '1 day') d
    WHERE (${to}::date - ${from}::date) <= 62
    ON CONFLICT (user_id, date) DO UPDATE SET type = EXCLUDED.type, notes = EXCLUDED.notes RETURNING id`;
  if (!rows.length) throw new ApiError(400, "El período es demasiado largo (máx. 2 meses).");
  await audit(sql, me.id, "crear", "ausencia", userId, undefined, { type, from, to, dias: rows.length });
  return { days: rows.length };
});
