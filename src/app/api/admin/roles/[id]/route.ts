import { sql } from "@/lib/db";
import { route, body, id, ApiError } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { parseRole } from "@/lib/roles";

export const PUT = route(async (req, { params }) => {
  const me = await requireUser("usuarios.gestionar");
  const rid = id(await params);
  const [before] = await sql`SELECT * FROM roles WHERE id = ${rid}`;
  if (!before) throw new ApiError(404, "El rol no existe.");
  const r = parseRole(await body(req), before.key);
  const [row] = await sql`UPDATE roles SET name = ${r.name}, description = ${r.description}, permissions = ${r.permissions} WHERE id = ${rid} RETURNING *`;
  await audit(sql, me.id, "editar", "rol", rid, before, row);
  return row;
});

export const DELETE = route(async (_req, { params }) => {
  const me = await requireUser("usuarios.gestionar");
  const rid = id(await params);
  const [r] = await sql`SELECT *, (SELECT count(*)::int FROM users WHERE role_id = roles.id) AS users FROM roles WHERE id = ${rid}`;
  if (!r) throw new ApiError(404, "El rol no existe.");
  if (r.is_system) throw new ApiError(400, "Los roles base no se pueden eliminar.");
  if (r.users > 0) throw new ApiError(400, "Hay usuarios con este rol. Cambialos de rol primero.");
  await sql`DELETE FROM roles WHERE id = ${rid}`;
  await audit(sql, me.id, "eliminar", "rol", rid, r);
  return { ok: true };
});
