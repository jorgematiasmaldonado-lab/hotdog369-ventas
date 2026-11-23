import { sql } from "@/lib/db";
import { route, body, ApiError } from "@/lib/api";
import { requireUser, requireModule } from "@/lib/auth";
import { audit } from "@/lib/audit";

// Crea un artículo por cada producto elegido (1 unidad por venta), p. ej. bebidas y snacks
export const POST = route(async (req) => {
  const user = await requireUser("stock.gestionar");
  await requireModule("stock");
  const b = await body(req);
  const ids = Array.isArray(b.product_ids) ? (b.product_ids as number[]).map(Number).filter(Number.isInteger) : [];
  if (!ids.length) throw new ApiError(400, "Elegí al menos un producto.");
  return sql.begin(async (tx) => {
    let created = 0;
    for (const pid of ids) {
      const [p] = await tx`SELECT id, name, sort FROM products WHERE id = ${pid}`;
      if (!p) continue;
      const [has] = await tx`SELECT 1 FROM product_components WHERE product_id = ${pid} LIMIT 1`;
      if (has) continue;
      const [it] = await tx`INSERT INTO stock_items (name, unit, sort) VALUES (${p.name}, 'u', ${p.sort}) RETURNING id`;
      await tx`INSERT INTO product_components (product_id, stock_item_id, qty) VALUES (${pid}, ${it.id}, 1)`;
      created++;
    }
    await audit(tx, user.id, "crear_desde_productos", "stock", null, undefined, { productos: ids.length, creados: created });
    return { created };
  });
});
