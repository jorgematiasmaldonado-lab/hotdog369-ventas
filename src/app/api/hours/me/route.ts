import { sql, TZ } from "@/lib/db";
import { route } from "@/lib/api";
import { requireUser, requireModule } from "@/lib/auth";
import { localDate, quincenaOf } from "@/lib/dates";
import { schemaOk } from "@/lib/schema";

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
  // Quincena actual: horas fichadas y cuánto lleva ganado
  const q = quincenaOf(today);
  let rate: number | null = null, qHours = 0, qAmount: number | null = null;
  if (await schemaOk()) {
    const [r] = await sql`SELECT u.hourly_rate,
        COALESCE(sum(extract(epoch FROM (COALESCE(t.clock_out, now()) - t.clock_in)) / 3600), 0) AS hours,
        COALESCE(sum(extract(epoch FROM (COALESCE(t.clock_out, now()) - t.clock_in)) / 3600 * COALESCE(t.hourly_rate, u.hourly_rate, 0)), 0) AS amount
      FROM users u LEFT JOIN time_entries t ON t.user_id = u.id AND (t.clock_in AT TIME ZONE ${TZ})::date BETWEEN ${q.from}::date AND ${q.to}::date
      WHERE u.id = ${user.id} GROUP BY u.hourly_rate`;
    rate = r.hourly_rate == null ? null : Number(r.hourly_rate);
    qHours = Number(r.hours);
    qAmount = Math.round(Number(r.amount) * 100) / 100;
  } else {
    const [r] = await sql`SELECT COALESCE(sum(extract(epoch FROM (COALESCE(clock_out, now()) - clock_in))), 0) / 3600 AS hours
      FROM time_entries WHERE user_id = ${user.id} AND (clock_in AT TIME ZONE ${TZ})::date BETWEEN ${q.from}::date AND ${q.to}::date`;
    qHours = Number(r.hours);
  }
  return { open: open ?? null, entries, week: tot.week, month: tot.month, off, quincena: { ...q, hours: qHours, amount: qAmount }, hourly_rate: rate };
});
