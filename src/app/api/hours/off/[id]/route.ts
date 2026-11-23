import { sql } from "@/lib/db";
import { route, id, ApiError } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";

export const DELETE = route(async (_req, { params }) => {
  const me = await requireUser("horas.gestionar");
  const oid = id(await params);
  const [o] = await sql`DELETE FROM time_off WHERE id = ${oid} RETURNING *`;
  if (!o) throw new ApiError(404, "No existe.");
  await audit(sql, me.id, "eliminar", "ausencia", oid, o);
  return { ok: true };
});
