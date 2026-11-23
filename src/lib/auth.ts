import "server-only";
import { cookies } from "next/headers";
import { sql } from "./db";
import { ApiError } from "./api";
import type { Permission } from "./permissions";
import { SESSION_COOKIE, verifyToken } from "./session-token";

export type SessionUser = {
  id: number;
  name: string;
  username: string;
  branch_id: number;
  role: { id: number; key: string; name: string };
  permissions: Permission[];
};

export async function getUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const tok = await verifyToken(jar.get(SESSION_COOKIE)?.value);
  if (!tok) return null;
  const [u] = await sql`
    SELECT u.id, u.name, u.username, u.active, u.session_version,
           COALESCE(u.branch_id, (SELECT min(id) FROM branches)) AS branch_id,
           r.id AS role_id, r.key AS role_key, r.name AS role_name, r.permissions
    FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ${tok.uid}`;
  if (!u || !u.active || u.session_version !== tok.sv) return null;
  return {
    id: u.id,
    name: u.name,
    username: u.username,
    branch_id: u.branch_id,
    role: { id: u.role_id, key: u.role_key, name: u.role_name },
    permissions: u.permissions,
  };
}

export function can(user: SessionUser | null, ...perms: Permission[]) {
  return !!user && perms.some((p) => user.permissions.includes(p));
}

/** Exige sesión y (si se indican) al menos uno de los permisos. */
export async function requireUser(...perms: Permission[]): Promise<SessionUser> {
  const user = await getUser();
  if (!user) throw new ApiError(401, "Sesión vencida. Volvé a ingresar.");
  if (perms.length && !can(user, ...perms)) throw new ApiError(403, "No tenés permiso para esta acción.");
  return user;
}

export async function requireModule(key: string) {
  const [m] = await sql`SELECT enabled FROM modules WHERE key = ${key}`;
  if (!m?.enabled) throw new ApiError(403, "Este módulo está desactivado.");
}
