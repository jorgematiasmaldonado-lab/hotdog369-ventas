import { sql } from "@/lib/db";
import { route } from "@/lib/api";
import { requireUser } from "@/lib/auth";

// Resumen liviano de stock bajo para el aviso del encabezado
export const GET = route(async () => {
  await requireUser("stock.ver", "stock.gestionar");
  try {
    const [m] = await sql`SELECT enabled FROM modules WHERE key = 'stock'`;
    if (!m?.enabled) return { count: 0, items: [] };
    const items = await sql`SELECT id, name, unit, quantity, min_quantity FROM stock_items
      WHERE active AND quantity <= min_quantity ORDER BY quantity - min_quantity, name LIMIT 20`;
    return { count: items.length, items };
  } catch {
    return { count: 0, items: [] };
  }
});
