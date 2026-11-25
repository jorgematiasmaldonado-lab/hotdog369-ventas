import { sql } from "@/lib/db";
import { route, body } from "@/lib/api";
import { requireUser, requireModule } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { moveStock } from "@/lib/stock";
import { schemaOk } from "@/lib/schema";
import { parseStockItem, parseQty } from "@/lib/stock-input";

// Artículos de stock con su estado y los productos que los usan
export const GET = route(async (req) => {
  // El empleado que solo cuenta no ve cantidades (el control es "a ciegas")
  await requireUser("stock.ver", "stock.gestionar");
  await requireModule("stock");
  const all = new URL(req.url).searchParams.get("all") === "1";
  return sql`
    SELECT si.*, (si.quantity <= si.min_quantity) AS low,
      (SELECT json_agg(json_build_object('product_id', p.id, 'name', p.name, 'qty', pc.qty) ORDER BY p.name)
         FROM product_components pc JOIN products p ON p.id = pc.product_id WHERE pc.stock_item_id = si.id) AS used_by,
      (SELECT max(created_at) FROM stock_movements m WHERE m.stock_item_id = si.id AND m.type = 'ingreso') AS last_in,
      (SELECT COALESCE(-sum(qty), 0) FROM stock_movements m WHERE m.stock_item_id = si.id AND m.type IN ('venta','anulacion','edicion')
         AND m.created_at > now() - interval '7 days') AS sold_7d
    FROM stock_items si
    WHERE ${all ? sql`TRUE` : sql`si.active`}
    ORDER BY si.active DESC, (si.quantity <= si.min_quantity) DESC, si.sort, si.name`;
});

// Crear artículo (opcional: cantidad inicial y producto que lo descuenta)
export const POST = route(async (req) => {
  const user = await requireUser("stock.gestionar");
  await requireModule("stock");
  const b = await body(req);
  const it = parseStockItem(b, await schemaOk());
  const initial = b.quantity !== undefined && b.quantity !== "" ? parseQty(b.quantity, "cantidad inicial", true) : 0;
  const link = Array.isArray(b.link_products) ? (b.link_products as { product_id: number; qty: number }[]) : [];
  return sql.begin(async (tx) => {
    const [row] = await tx`INSERT INTO stock_items ${tx(it)} RETURNING *`;
    if (initial) await moveStock(tx, [{ stock_item_id: row.id, delta: initial }], { type: "ajuste", user_id: user.id, notes: "Stock inicial" });
    for (const l of link) {
      const q = parseQty(l.qty ?? 1, "cantidad por producto");
      await tx`INSERT INTO product_components (product_id, stock_item_id, qty) VALUES (${Number(l.product_id)}, ${row.id}, ${q})
        ON CONFLICT (product_id, stock_item_id) DO UPDATE SET qty = EXCLUDED.qty`;
    }
    await audit(tx, user.id, "crear", "stock", row.id, undefined, { ...it, cantidad_inicial: initial });
    return row;
  });
});
