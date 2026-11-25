import { sql } from "@/lib/db";
import { route, body } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { parseUser } from "@/lib/users";
import { schemaOk } from "@/lib/schema";

export const GET = route(async () => {
  await requireUser("usuarios.gestionar");
  const rate = (await schemaOk()) ? sql`u.hourly_rate,` : sql`NULL::numeric AS hourly_rate,`;
  const users = await sql`SELECT u.id, u.name, u.username, u.role_id, r.name AS role_name, u.active, u.created_at, ${rate}
    (u.locked_until > now()) AS locked FROM users u JOIN roles r ON r.id = u.role_id ORDER BY u.active DESC, u.name`;
  const roles = await sql`SELECT id, key, name FROM roles ORDER BY id`;
  return { users, roles };
});

export const POST = route(async (req) => {
  const user = await requireUser("usuarios.gestionar");
  const u = parseUser(await body(req), true);
  const [row] = await sql`INSERT INTO users (name, username, pin_hash, role_id, active, branch_id)
    VALUES (${u.name}, ${u.username}, ${u.pin_hash!}, ${u.role_id}, ${u.active}, ${user.branch_id}) RETURNING id, name, username, role_id, active`;
  if (u.hourly_rate !== undefined && (await schemaOk())) await sql`UPDATE users SET hourly_rate = ${u.hourly_rate} WHERE id = ${row.id}`;
  await audit(sql, user.id, "crear", "usuario", row.id, undefined, { ...row, hourly_rate: u.hourly_rate });
  return row;
});
