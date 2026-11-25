import { sql } from "@/lib/db";
import { route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { schemaOk } from "@/lib/schema";

export const GET = route(async () => {
  const user = await requireUser();
  const modules = await sql`SELECT key, name, enabled FROM modules ORDER BY sort`;
  const settings = Object.fromEntries((await sql`SELECT key, value FROM settings WHERE key NOT IN ('vapid_keys', 'cron_secret')`).map((r) => [r.key, r.value]));
  return { user, modules: Object.fromEntries(modules.map((m) => [m.key, m.enabled])), settings, schema_ok: await schemaOk() };
});
