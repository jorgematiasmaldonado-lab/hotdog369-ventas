import { sql } from "@/lib/db";
import { route, body, ApiError } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";

export const PUT = route(async (req, { params }) => {
  const me = await requireUser("config.gestionar");
  const { key } = await params;
  const b = await body(req);
  const [before] = await sql`SELECT * FROM modules WHERE key = ${key}`;
  if (!before) throw new ApiError(404, "Módulo inexistente.");
  if (!before.available) throw new ApiError(400, "Este módulo todavía no está disponible.");
  const enabled = typeof b.enabled === "boolean" ? b.enabled : before.enabled;
  const [row] = await sql`UPDATE modules SET enabled = ${enabled} WHERE key = ${key} RETURNING *`;
  await audit(sql, me.id, enabled ? "activar" : "desactivar", "modulo", key, before, row);
  return row;
});
