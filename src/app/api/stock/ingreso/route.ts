import { sql } from "@/lib/db";
import { route, body, str, num, ApiError, bool } from "@/lib/api";
import { requireUser, requireModule } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { moveStock } from "@/lib/stock";
import { parseQty } from "@/lib/stock-input";
import { localDate } from "@/lib/dates";

// Ingreso de mercadería con varios artículos a la vez (opcional: registrarlo también como gasto)
export const POST = route(async (req) => {
  const user = await requireUser("stock.gestionar");
  await requireModule("stock");
  const b = await body(req);
  const items = Array.isArray(b.items) ? (b.items as { stock_item_id: number; qty: number; unit_cost?: number | null }[]) : [];
  if (!items.length) throw new ApiError(400, "Agregá al menos un artículo.");
  const supplier = str(b.supplier, "proveedor", { required: false, max: 120 });
  const notes = str(b.notes, "nota", { required: false, max: 300 });
  return sql.begin(async (tx) => {
    let total = 0;
    for (const it of items) {
      const qty = parseQty(it.qty);
      if (qty < 0) throw new ApiError(400, "Las cantidades deben ser positivas.");
      const cost = num(it.unit_cost, "costo", { required: false, min: 0 });
      await moveStock(tx, [{ stock_item_id: Number(it.stock_item_id), delta: qty }], { type: "ingreso", user_id: user.id, unit_cost: cost, supplier, notes });
      if (cost !== null) { await tx`UPDATE stock_items SET cost = ${cost} WHERE id = ${Number(it.stock_item_id)}`; total += cost * qty; }
    }
    let expenseId: number | null = null;
    if (bool(b.create_expense) && total > 0) {
      const [cat] = await tx`SELECT id FROM expense_categories WHERE name ILIKE 'Mercader%' ORDER BY id LIMIT 1`;
      const [e] = await tx`INSERT INTO expenses (branch_id, date, supplier, category_id, amount, payment_method_id, notes, user_id)
        VALUES (${user.branch_id}, ${localDate()}, ${supplier}, ${cat?.id ?? null}, ${Math.round(total * 100) / 100},
                ${num(b.payment_method_id, "medio de pago", { required: false, int: true })}, ${notes ?? "Ingreso de mercadería (stock)"}, ${user.id})
        RETURNING id`;
      expenseId = e.id;
    }
    await audit(tx, user.id, "ingreso", "stock", null, undefined, { items: items.length, total, supplier, gasto: expenseId });
    return { ok: true, total, expense_id: expenseId };
  });
});
