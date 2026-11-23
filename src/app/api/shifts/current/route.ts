import { sql } from "@/lib/db";
import { route } from "@/lib/api";
import { requireUser, can } from "@/lib/auth";
import { stockSettings } from "@/lib/stock";
import { personalEnabled } from "@/lib/hours";
import { shiftSummary } from "@/lib/shifts";

// Turno abierto del usuario actual (con resumen) + turnos abiertos de otros
export const GET = route(async () => {
  const user = await requireUser();
  const [s] = await sql`SELECT id FROM shifts WHERE user_id = ${user.id} AND status = 'abierto'`;
  // ¿Falta el control de stock de este turno?
  let stock_check: { required: boolean; mode: string } = { required: false, mode: "no" };
  if (s && can(user, "stock.contar", "stock.gestionar")) {
    const st = await stockSettings();
    if (st.enabled && st.control !== "no") {
      const [done] = await sql`SELECT 1 FROM stock_counts WHERE shift_id = ${s.id} LIMIT 1`;
      const [items] = await sql`SELECT count(*)::int AS n FROM stock_items WHERE active AND count_on_shift`;
      stock_check = { required: !done && items.n > 0, mode: st.control };
    }
  }
  // Fichada de entrada abierta (para ofrecer fichar al abrir/cerrar el turno)
  let hours = { enabled: false, clocked_in: false };
  if (can(user, "horas.fichar") && (await personalEnabled())) {
    const [open] = await sql`SELECT 1 FROM time_entries WHERE user_id = ${user.id} AND clock_out IS NULL`;
    hours = { enabled: true, clocked_in: !!open };
  }
  return { shift: s ? await shiftSummary(s.id) : null, stock_check, hours };
});
