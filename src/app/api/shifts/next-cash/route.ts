import { sql } from "@/lib/db";
import { route, body, num } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { getNextOpeningCash } from "@/lib/opening";

// Caja inicial del próximo turno (la carga el administrador; el empleado la ve al abrir)
export const GET = route(async () => {
  await requireUser("turnos.operar", "turnos.ver_todos");
  return { amount: await getNextOpeningCash(sql) };
});

export const PUT = route(async (req) => {
  const user = await requireUser("caja.gestionar");
  const b = await body(req);
  const amount = b.amount === null || b.amount === "" ? null : num(b.amount, "caja inicial", { min: 0 })!;
  const before = await getNextOpeningCash(sql);
  if (amount === null) await sql`DELETE FROM settings WHERE key = 'next_opening_cash'`;
  else await sql`INSERT INTO settings (key, value) VALUES ('next_opening_cash', ${sql.json(amount)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
  await audit(sql, user.id, "caja_proximo_turno", "turno", null, { amount: before }, { amount });
  return { amount };
});
