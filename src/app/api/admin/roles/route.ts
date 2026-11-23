import { sql } from "@/lib/db";
import { route, body } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { parseRole } from "@/lib/roles";

export const GET = route(async () => {
  await requireUser("usuarios.gestionar");
  return sql`SELECT r.*, (SELECT count(*)::int FROM users WHERE role_id = r.id) AS users FROM roles r ORDER BY r.id`;
});

export const POST = route(async (req) => {
  const me = await requireUser("usuarios.gestionar");
  const r = parseRole(await body(req), null);
  const key = r.name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").slice(0, 30) + "_" + Date.now().toString(36);
  const [row] = await sql`INSERT INTO roles (key, name, description, permissions) VALUES (${key}, ${r.name}, ${r.description}, ${r.permissions}) RETURNING *`;
  await audit(sql, me.id, "crear", "rol", row.id, undefined, row);
  return row;
});
