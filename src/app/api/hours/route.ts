import { sql, TZ } from "@/lib/db";
import { route } from "@/lib/api";
import { requireUser, requireModule } from "@/lib/auth";
import { resolveRange } from "@/lib/dates";
import { schemaOk } from "@/lib/schema";

// Resumen de horas de todo el personal en un período
export const GET = route(async (req) => {
  await requireUser("horas.ver", "horas.gestionar");
  await requireModule("personal");
  const u = new URL(req.url);
  const { from, to } = resolveRange(u.searchParams.get("range") ?? "semana", u.searchParams.get("from"), u.searchParams.get("to"));
  const v2 = await schemaOk();
  const users = await sql`SELECT u.id, u.name, r.name AS role_name, ${v2 ? sql`u.hourly_rate` : sql`NULL::numeric AS hourly_rate`} FROM users u JOIN roles r ON r.id = u.role_id
    WHERE u.active AND ('horas.fichar' = ANY(r.permissions) OR EXISTS (SELECT 1 FROM time_entries t WHERE t.user_id = u.id))
    ORDER BY u.name`;
  // Valor hora de cada fichada: el guardado al fichar o, si no tiene, el actual del empleado
  const entries = await sql`SELECT t.id, t.user_id, t.clock_in, t.clock_out, t.source, t.notes, t.shift_id,
      ${v2 ? sql`COALESCE(t.hourly_rate, u.hourly_rate)` : sql`NULL::numeric`} AS hourly_rate,
      (t.clock_in AT TIME ZONE ${TZ})::date::text AS day,
      extract(epoch FROM (COALESCE(t.clock_out, now()) - t.clock_in)) / 3600 AS hours, eu.name AS edited_by_name
    FROM time_entries t JOIN users u ON u.id = t.user_id LEFT JOIN users eu ON eu.id = t.edited_by
    WHERE (t.clock_in AT TIME ZONE ${TZ})::date BETWEEN ${from}::date AND ${to}::date
    ORDER BY t.clock_in`;
  const off = await sql`SELECT o.id, o.user_id, o.date::text AS date, o.type, o.notes FROM time_off o
    WHERE o.date BETWEEN ${from}::date AND ${to}::date ORDER BY o.date`;
  const summary = users.map((us) => {
    const es = entries.filter((e) => e.user_id === us.id);
    const os = off.filter((o) => o.user_id === us.id);
    const count = (t: string) => os.filter((o) => o.type === t).length;
    return {
      user_id: us.id, name: us.name, role_name: us.role_name,
      hours: es.reduce((a, e) => a + Number(e.hours), 0),
      hourly_rate: us.hourly_rate == null ? null : Number(us.hourly_rate),
      // Solo se pagan las horas fichadas (francos y ausencias no suman)
      amount: Math.round(es.reduce((a, e) => a + Number(e.hours) * Number(e.hourly_rate ?? 0), 0) * 100) / 100,
      days_worked: new Set(es.map((e) => e.day)).size,
      open: es.some((e) => !e.clock_out),
      franco: count("franco"), vacaciones: count("vacaciones"), enfermedad: count("enfermedad"),
      falta: count("falta"), licencia: count("licencia"), otro: count("otro"),
    };
  });
  return { from, to, users, entries, off, summary, rates: v2 };
});
