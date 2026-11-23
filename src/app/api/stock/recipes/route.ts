import { sql } from "@/lib/db";
import { route, body, num, ApiError } from "@/lib/api";
import { requireUser, requireModule } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { parseQty } from "@/lib/stock-input";

// Recetas: qué artículos descuenta cada producto
export const GET = route(async () => {
  await requireUser("stock.ver", "stock.gestionar");
  await requireModule("stock");
  return sql`SELECT p.id, p.name, c.name AS category, p.active,
      COALESCE((SELECT json_agg(json_build_object('stock_item_id', si.id, 'name', si.name, 'unit', si.unit, 'qty', pc.qty) ORDER BY si.name)
        FROM product_components pc JOIN stock_items si ON si.id = pc.stock_item_id WHERE pc.product_id = p.id), '[]') AS components
    FROM products p JOIN categories c ON c.id = p.category_id
    ORDER BY p.active DESC, c.sort, p.sort, p.name`;
});

export const PUT = route(async (req) => {
  const user = await requireUser("stock.gestionar");
  const b = await body(req);
  const pid = num(b.product_id, "producto", { int: true })!;
  const comps = Array.isArray(b.components) ? (b.components as { stock_item_id: number; qty: number }[]) : [];
  return sql.begin(async (tx) => {
    const [p] = await tx`SELECT id FROM products WHERE id = ${pid}`;
    if (!p) throw new ApiError(404, "El producto no existe.");
    const before = await tx`SELECT stock_item_id, qty FROM product_components WHERE product_id = ${pid}`;
    await tx`DELETE FROM product_components WHERE product_id = ${pid}`;
    const seen = new Set<number>();
    for (const c of comps) {
      const sid = num(c.stock_item_id, "artículo", { int: true })!;
      if (seen.has(sid)) continue; seen.add(sid);
      await tx`INSERT INTO product_components (product_id, stock_item_id, qty) VALUES (${pid}, ${sid}, ${parseQty(c.qty)})`;
    }
    await audit(tx, user.id, "receta", "products", pid, before, comps);
    return { ok: true };
  });
});
