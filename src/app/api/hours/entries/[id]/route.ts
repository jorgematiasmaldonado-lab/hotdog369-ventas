import { sql } from "@/lib/db";
import { route, body, id, str, ApiError } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { parseDateTime } from "@/lib/hours";

export const PUT = route(async (req, { params }) => {
  const me = await requireUser("horas.gestionar");
  const eid = id(await params);
  const b = await body(req);
  const [before] = await sql`SELECT * FROM time_entries WHERE id = ${eid}`;
  if (!before) throw new ApiError(404, "La fichada no existe.");
  const cin = parseDateTime(b.clock_in, "entrada")!;
  const cout = parseDateTime(b.clock_out, "salida", false);
  if (cout && cout <= cin) throw new ApiError(400, "La salida tiene que ser posterior a la entrada.");
  const [e] = await sql`UPDATE time_entries SET clock_in = ${cin}, clock_out = ${cout}, edited_by = ${me.id},
    notes = ${str(b.notes, "nota", { required: false, max: 300 })} WHERE id = ${eid} RETURNING *`;
  await audit(sql, me.id, "editar", "horas", eid, before, e);
  return e;
});

export const DELETE = route(async (_req, { params }) => {
  const me = await requireUser("horas.gestionar");
  const eid = id(await params);
  const [e] = await sql`DELETE FROM time_entries WHERE id = ${eid} RETURNING *`;
  if (!e) throw new ApiError(404, "La fichada no existe.");
  await audit(sql, me.id, "eliminar", "horas", eid, e);
  return { ok: true };
});
