import { sql, TZ } from "@/lib/db";
import { route, body, num, ApiError } from "@/lib/api";
import { requireUser, requireModule } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { parseRate } from "@/lib/hours";
import { schemaOk } from "@/lib/schema";

// El administrador define el valor hora de un empleado (se aplica a las fichadas nuevas)
export const PUT = route(async (req) => {
  const me = await requireUser("horas.gestionar");
  await requireModule("personal");
  if (!(await schemaOk())) throw new ApiError(409, "Falta actualizar la base de datos.");
  const b = await body(req);
  const userId = num(b.user_id, "empleado", { int: true })!;
  const rate = parseRate(b.hourly_rate);
  const [before] = await sql`SELECT hourly_rate FROM users WHERE id = ${userId}`;
  if (!before) throw new ApiError(404, "El empleado no existe.");
  await sql`UPDATE users SET hourly_rate = ${rate} WHERE id = ${userId}`;
  // Opcional: aplicar también a las fichadas del período que todavía no tienen valor
  let updated = 0;
  if (b.apply_from && /^\d{4}-\d{2}-\d{2}$/.test(String(b.apply_from))) {
    const r = await sql`UPDATE time_entries SET hourly_rate = ${rate}
      WHERE user_id = ${userId} AND hourly_rate IS NULL AND (clock_in AT TIME ZONE ${TZ})::date >= ${String(b.apply_from)}::date`;
    updated = r.count;
  }
  await audit(sql, me.id, "valor_hora", "usuario", userId, { hourly_rate: before.hourly_rate }, { hourly_rate: rate, fichadas_actualizadas: updated });
  return { hourly_rate: rate, updated };
});
