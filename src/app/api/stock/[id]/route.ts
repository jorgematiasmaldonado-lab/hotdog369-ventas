import { sql } from "@/lib/db";
import { route, body, id, ApiError } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { schemaOk } from "@/lib/schema";
import { parseStockItem } from "@/lib/stock-input";

export const PUT = route(async (req, { params }) => {
  const user = await requireUser("stock.gestionar");
  const sid = id(await params);
  const it = parseStockItem(await body(req), await schemaOk());
  const [before] = await sql`SELECT * FROM stock_items WHERE id = ${sid}`;
  if (!before) throw new ApiError(404, "El artículo no existe.");
  const [row] = await sql`UPDATE stock_items SET ${sql(it)} WHERE id = ${sid} RETURNING *`;
  await audit(sql, user.id, "editar", "stock", sid, before, row);
  return row;
});

// Si ya tuvo movimientos se desactiva (para conservar el historial); si no, se elimina
export const DELETE = route(async (_req, { params }) => {
  const user = await requireUser("stock.gestionar");
  const sid = id(await params);
  const [before] = await sql`SELECT * FROM stock_items WHERE id = ${sid}`;
  if (!before) throw new ApiError(404, "El artículo no existe.");
  const [{ n }] = await sql`SELECT count(*)::int AS n FROM stock_movements WHERE stock_item_id = ${sid}`;
  if (n > 0) {
    await sql`UPDATE stock_items SET active = false WHERE id = ${sid}`;
    await sql`DELETE FROM product_components WHERE stock_item_id = ${sid}`;
    await audit(sql, user.id, "desactivar", "stock", sid, before);
    return { deleted: false, deactivated: true };
  }
  await sql`DELETE FROM stock_items WHERE id = ${sid}`;
  await audit(sql, user.id, "eliminar", "stock", sid, before);
  return { deleted: true };
});
