import { sql } from "@/lib/db";
import { route, body, num, str, ApiError } from "@/lib/api";
import { requireUser, requireModule } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { parseDateTime } from "@/lib/hours";

// Carga manual de una fichada (por ejemplo, si alguien se olvidó de fichar)
export const POST = route(async (req) => {
  const me = await requireUser("horas.gestionar");
  await requireModule("personal");
  const b = await body(req);
  const userId = num(b.user_id, "empleado", { int: true })!;
  const cin = parseDateTime(b.clock_in, "entrada")!;
  const cout = parseDateTime(b.clock_out, "salida", false);
  if (cout && cout <= cin) throw new ApiError(400, "La salida tiene que ser posterior a la entrada.");
  if (!cout) {
    const [open] = await sql`SELECT 1 FROM time_entries WHERE user_id = ${userId} AND clock_out IS NULL`;
    if (open) throw new ApiError(409, "Ese empleado ya tiene una entrada abierta.");
  }
  const [e] = await sql`INSERT INTO time_entries (user_id, clock_in, clock_out, source, notes, created_by)
    VALUES (${userId}, ${cin}, ${cout}, 'manual', ${str(b.notes, "nota", { required: false, max: 300 })}, ${me.id}) RETURNING *`;
  await audit(sql, me.id, "crear", "horas", e.id, undefined, e);
  return e;
});
