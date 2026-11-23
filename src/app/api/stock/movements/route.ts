import { sql, TZ } from "@/lib/db";
import { route } from "@/lib/api";
import { requireUser, requireModule } from "@/lib/auth";
import { resolveRange } from "@/lib/dates";

// Movimientos de stock del período (sin las ventas una por una: se agrupan por día)
export const GET = route(async (req) => {
  await requireUser("stock.ver", "stock.gestionar");
  await requireModule("stock");
  const u = new URL(req.url);
  const { from, to } = resolveRange(u.searchParams.get("range") ?? "semana", u.searchParams.get("from"), u.searchParams.get("to"));
  const manual = await sql`SELECT m.id, m.created_at, m.type, m.qty, m.balance_after, m.unit_cost, m.supplier, m.notes,
      si.name AS item, si.unit, u.name AS user_name
    FROM stock_movements m JOIN stock_items si ON si.id = m.stock_item_id LEFT JOIN users u ON u.id = m.user_id
    WHERE m.type IN ('ingreso','ajuste','control') AND (m.created_at AT TIME ZONE ${TZ})::date BETWEEN ${from}::date AND ${to}::date
    ORDER BY m.created_at DESC LIMIT 300`;
  const sold = await sql`SELECT si.name AS item, si.unit, -sum(m.qty) AS qty
    FROM stock_movements m JOIN stock_items si ON si.id = m.stock_item_id
    WHERE m.type IN ('venta','anulacion','edicion') AND (m.created_at AT TIME ZONE ${TZ})::date BETWEEN ${from}::date AND ${to}::date
    GROUP BY si.id ORDER BY 3 DESC`;
  return { from, to, manual, sold };
});
