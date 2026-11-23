import { sql } from "@/lib/db";
import { route, id } from "@/lib/api";
import { requireUser } from "@/lib/auth";

export const GET = route(async (_req, { params }) => {
  await requireUser("productos.gestionar", "reportes.ver");
  return sql`SELECT h.old_price, h.new_price, h.changed_at, u.name AS user_name FROM product_price_history h
    LEFT JOIN users u ON u.id = h.changed_by WHERE h.product_id = ${id(await params)} ORDER BY h.changed_at DESC`;
});
