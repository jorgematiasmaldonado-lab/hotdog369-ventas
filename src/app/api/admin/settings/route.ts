import { sql } from "@/lib/db";
import { route, body, ApiError } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";

const ALLOWED: Record<string, (v: unknown) => boolean> = {
  business_name: (v) => typeof v === "string" && v.trim().length > 0 && v.length <= 80,
  fiado_alert_days: (v) => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 365,
  ticket_footer: (v) => typeof v === "string" && v.length <= 200,
  stock_control_on_open: (v) => v === "obligatorio" || v === "opcional" || v === "no",
  backup_reminder_days: (v) => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 30,
};

export const PUT = route(async (req) => {
  const me = await requireUser("config.gestionar");
  const b = await body(req);
  for (const [k, v] of Object.entries(b)) {
    if (!ALLOWED[k]) throw new ApiError(400, `Configuración desconocida: ${k}`);
    if (!ALLOWED[k](v)) throw new ApiError(400, `Valor inválido para ${k}`);
  }
  for (const [k, v] of Object.entries(b)) {
    const [before] = await sql`SELECT value FROM settings WHERE key = ${k}`;
    await sql`INSERT INTO settings (key, value) VALUES (${k}, ${sql.json(v as never)}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
    await audit(sql, me.id, "editar", "configuracion", k, before?.value, v);
  }
  return { ok: true };
});
