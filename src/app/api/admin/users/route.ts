import { sql } from "@/lib/db";
import { route, body } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { parseUser } from "@/lib/users";

export const GET = route(async () => {
  await requireUser("usuarios.gestionar");
  const users = await sql`SELECT u.id, u.name, u.username, u.role_id, r.name AS role_name, u.active, u.created_at,
    (u.locked_until > now()) AS locked FROM users u JOIN roles r ON r.id = u.role_id ORDER BY u.active DESC, u.name`;
  const roles = await sql`SELECT id, key, name FROM roles ORDER BY id`;
  return { users, roles };
});

export const POST = route(async (req) => {
  const user = await requireUser("usuarios.gestionar");
  const u = parseUser(await body(req), true);
  const [row] = await sql`INSERT INTO users (name, username, pin_hash, role_id, active, branch_id)
    VALUES (${u.name}, ${u.username}, ${u.pin_hash!}, ${u.role_id}, ${u.active}, ${user.branch_id}) RETURNING id, name, username, role_id, active`;
  await audit(sql, user.id, "crear", "usuario", row.id, undefined, row);
  return row;
});
