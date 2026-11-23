import { after } from "next/server";
import { notifyLowStock, type LowItem } from "@/lib/push";
import { sql } from "@/lib/db";
import { route, body, id, str, num, ApiError } from "@/lib/api";
import { requireUser, requireModule } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { moveStock } from "@/lib/stock";
import { parseQty } from "@/lib/stock-input";

export const GET = route(async (_req, { params }) => {
  await requireUser("stock.ver", "stock.gestionar");
  return sql`SELECT m.*, u.name AS user_name, s.number AS sale_number FROM stock_movements m
    LEFT JOIN users u ON u.id = m.user_id LEFT JOIN sales s ON s.id = m.sale_id
    WHERE m.stock_item_id = ${id(await params)} ORDER BY m.created_at DESC, m.id DESC LIMIT 200`;
});

// Ingreso (suma) o ajuste (deja el stock en una cantidad exacta, con motivo)
export const POST = route(async (req, { params }) => {
  const user = await requireUser("stock.gestionar");
  await requireModule("stock");
  const sid = id(await params);
  const b = await body(req);
  const low: LowItem[] = [];
  const res = await sql.begin(async (tx) => {
    const [it] = await tx`SELECT * FROM stock_items WHERE id = ${sid} FOR UPDATE`;
    if (!it) throw new ApiError(404, "El artículo no existe.");
    if (b.type === "ingreso") {
      const qty = parseQty(b.qty);
      if (qty < 0) throw new ApiError(400, "La cantidad del ingreso debe ser positiva.");
      const cost = num(b.unit_cost, "costo", { required: false, min: 0 });
      await moveStock(tx, [{ stock_item_id: sid, delta: qty }], { type: "ingreso", user_id: user.id, unit_cost: cost,
        supplier: str(b.supplier, "proveedor", { required: false, max: 120 }), notes: str(b.notes, "nota", { required: false, max: 300 }) });
      if (cost !== null) await tx`UPDATE stock_items SET cost = ${cost} WHERE id = ${sid}`;
    } else if (b.type === "ajuste") {
      const target = parseQty(b.new_quantity, "cantidad real", true);
      const notes = str(b.notes, "motivo del ajuste", { max: 300 })!;
      low.push(...await moveStock(tx, [{ stock_item_id: sid, delta: target - it.quantity }], { type: "ajuste", user_id: user.id, notes }));
    } else throw new ApiError(400, "Tipo de movimiento inválido.");
    const [now] = await tx`SELECT quantity FROM stock_items WHERE id = ${sid}`;
    await audit(tx, user.id, b.type as string, "stock", sid, { cantidad: it.quantity }, { cantidad: now.quantity }, (b.notes as string) ?? null);
    return now;
  });
  if (low.length) after(() => notifyLowStock(low));
  return res;
});
