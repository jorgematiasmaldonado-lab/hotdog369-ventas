import { sql, TZ } from "@/lib/db";
import { route } from "@/lib/api";
import { requireUser, requireModule } from "@/lib/auth";
import { localDate } from "@/lib/dates";

// Mi asistencia: fichada abierta, últimas fichadas, horas de la semana/mes y francos
export const GET = route(async () => {
  const user = await requireUser("horas.fichar", "horas.ver", "horas.gestionar");
  await requireModule("personal");
  const today = localDate();
  const [open] = await sql`SELECT * FROM time_entries WHERE user_id = ${user.id} AND clock_out IS NULL`;
  const entries = await sql`SELECT id, clock_in, clock_out, source, notes,
      extract(epoch FROM (COALESCE(clock_out, now()) - clock_in)) / 3600 AS hours
    FROM time_entries WHERE user_id = ${user.id} AND clock_in > now() - interval '35 days' ORDER BY clock_in DESC`;
  const [tot] = await sql`SELECT
      COALESCE(sum(extract(epoch FROM (COALESCE(clock_out, now()) - clock_in))) FILTER (
        WHERE (clock_in AT TIME ZONE ${TZ})::date >= date_trunc('week', ${today}::date)), 0) / 3600 AS week,
      COALESCE(sum(extract(epoch FROM (COALESCE(clock_out, now()) - clock_in))) FILTER (
        WHERE (clock_in AT TIME ZONE ${TZ})::date >= date_trunc('month', ${today}::date)), 0) / 3600 AS month
    FROM time_entries WHERE user_id = ${user.id}`;
  const off = await sql`SELECT id, date::text AS date, type, notes FROM time_off
    WHERE user_id = ${user.id} AND date >= ${today}::date - 35 ORDER BY date DESC`;
  return { open: open ?? null, entries, week: tot.week, month: tot.month, off };
});
