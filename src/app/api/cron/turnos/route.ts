import { timingSafeEqual } from "node:crypto";
import { sql } from "@/lib/db";
import { route, ApiError } from "@/lib/api";
import { schemaOk } from "@/lib/schema";
import { minutesSinceStart, addDays } from "@/lib/dates";
import { sendPush } from "@/lib/push";

// Control automático (lo llama Supabase cada 10 minutos con la clave guardada en la base).
// Si pasó el tiempo configurado desde el horario de un turno y nadie lo abrió, avisa al celular
// del dueño y del administrador (una sola vez por turno y día).
async function run(req: Request) {
  if (!(await schemaOk())) throw new ApiError(409, "Falta actualizar la base de datos.");
  const [sec] = await sql`SELECT value FROM settings WHERE key = 'cron_secret'`;
  const expected = Buffer.from(String(sec?.value ?? ""));
  const got = Buffer.from(req.headers.get("x-cron-secret") ?? "");
  if (!sec || got.length !== expected.length || !timingSafeEqual(got, expected)) throw new ApiError(403, "Clave inválida.");

  await sql`INSERT INTO settings (key, value) VALUES ('cron_last_run', ${sql.json(new Date().toISOString())})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
  const [cfg] = await sql`SELECT value FROM settings WHERE key = 'unopened_alert_min'`;
  const wait = Number(cfg?.value ?? 30);
  const types = await sql`SELECT id, name, to_char(start_time, 'HH24:MI') AS start_time, days FROM shift_types WHERE active AND start_time IS NOT NULL`;
  const alerts: string[] = [];
  for (const t of types) {
    const since = minutesSinceStart(t.start_time, t.days);
    // Avisa una vez pasado el tiempo de espera, y no más de 3 horas después
    if (!since || since.minutes < wait || since.minutes > wait + 180) continue;
    const startAt = new Date(Date.now() - since.minutes * 60000);
    // ¿Se abrió ese turno (desde 3 h antes del horario)? ¿O sigue abierto alguno de ese tipo?
    const [opened] = await sql`SELECT 1 FROM shifts WHERE shift_type_id = ${t.id}
      AND (opened_at >= ${new Date(startAt.getTime() - 3 * 3600e3)} OR status = 'abierto') LIMIT 1`;
    if (opened) continue;
    const ins = await sql`INSERT INTO shift_alerts (shift_type_id, day) VALUES (${t.id}, ${since.day}) ON CONFLICT DO NOTHING RETURNING 1`;
    if (!ins.length) continue;
    const r = await sendPush({
      title: `⚠ El turno ${t.name} todavía no se abrió`,
      body: `Tenía que empezar a las ${t.start_time}. Ya pasaron ${since.minutes} minutos y nadie abrió el turno en la app.`,
      url: "/turnos", tag: `turno-${t.id}`,
    }, { perms: ["turnos.ver_todos"] });
    alerts.push(`${t.name} (${r.sent} equipos)`);
  }
  // Limpieza de avisos viejos
  await sql`DELETE FROM shift_alerts WHERE day < ${addDays(new Date().toISOString().slice(0, 10), -30)}::date`;
  return { ok: true, alerts };
}

export const POST = route(run);
export const GET = route(run);
