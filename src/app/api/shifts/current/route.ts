import { sql } from "@/lib/db";
import { route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { shiftSummary } from "@/lib/shifts";

// Turno abierto del usuario actual (con resumen) + turnos abiertos de otros
export const GET = route(async () => {
  const user = await requireUser();
  const [s] = await sql`SELECT id FROM shifts WHERE user_id = ${user.id} AND status = 'abierto'`;
  return { shift: s ? await shiftSummary(s.id) : null };
});
