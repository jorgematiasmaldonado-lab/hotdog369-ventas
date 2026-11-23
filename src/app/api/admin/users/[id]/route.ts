import { sql } from "@/lib/db";
import { route, body, id, ApiError } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { parseUser } from "@/lib/users";

export const PUT = route(async (req, { params }) => {
  const me = await requireUser("usuarios.gestionar");
  const uid = id(await params);
  const u = parseUser(await body(req), false);
  const [before] = await sql`SELECT id, name, username, role_id, active FROM users WHERE id = ${uid}`;
  if (!before) throw new ApiError(404, "El usuario no existe.");
  if (uid === me.id && (!u.active || u.role_id !== before.role_id))
    throw new ApiError(400, "No podés desactivarte ni cambiarte el rol a vos mismo.");
  // Si cambia el PIN, el rol o se desactiva, se cierran sus sesiones abiertas
  const bump = !!u.pin_hash || !u.active || u.role_id !== before.role_id;
  const [row] = await sql`UPDATE users SET name = ${u.name}, username = ${u.username}, role_id = ${u.role_id}, active = ${u.active},
    pin_hash = COALESCE(${u.pin_hash ?? null}, pin_hash), failed_attempts = 0, locked_until = NULL,
    session_version = session_version + ${bump ? 1 : 0}
    WHERE id = ${uid} RETURNING id, name, username, role_id, active`;
  await audit(sql, me.id, "editar", "usuario", uid, before, { ...row, pin: u.pin_hash ? "(cambiado)" : undefined });
  return row;
});
