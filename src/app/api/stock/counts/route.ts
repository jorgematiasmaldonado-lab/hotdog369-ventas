import { sql, TZ } from "@/lib/db";
import { route } from "@/lib/api";
import { requireUser, requireModule } from "@/lib/auth";
import { resolveRange } from "@/lib/dates";

export const GET = route(async (req) => {
  await requireUser("stock.ver", "stock.gestionar");
  await requireModule("stock");
  const u = new URL(req.url);
  const { from, to } = resolveRange(u.searchParams.get("range") ?? "semana", u.searchParams.get("from"), u.searchParams.get("to"));
  return sql`SELECT c.id, c.created_at, c.items_count, c.differences, c.notes, u.name AS user_name, st.name AS shift_type,
      (SELECT json_agg(json_build_object('name', si.name, 'unit', si.unit, 'expected', l.expected, 'counted', l.counted, 'difference', l.difference) ORDER BY abs(l.difference) DESC, si.name)
         FROM stock_count_lines l JOIN stock_items si ON si.id = l.stock_item_id WHERE l.count_id = c.id) AS lines
    FROM stock_counts c LEFT JOIN users u ON u.id = c.user_id LEFT JOIN shifts s ON s.id = c.shift_id LEFT JOIN shift_types st ON st.id = s.shift_type_id
    WHERE (c.created_at AT TIME ZONE ${TZ})::date BETWEEN ${from}::date AND ${to}::date
    ORDER BY c.created_at DESC LIMIT 200`;
});
