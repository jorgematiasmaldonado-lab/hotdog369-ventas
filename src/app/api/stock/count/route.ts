import { sql } from "@/lib/db";
import { route, body, str, ApiError } from "@/lib/api";
import { requireUser, requireModule } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { moveStock } from "@/lib/stock";
import { parseQty } from "@/lib/stock-input";

// Artículos a contar (sin mostrar la cantidad esperada: conteo "a ciegas")
export const GET = route(async () => {
  await requireUser("stock.contar", "stock.gestionar");
  await requireModule("stock");
  return sql`SELECT id, name, unit FROM stock_items WHERE active AND count_on_shift ORDER BY sort, name`;
});

// Guarda el control: compara con lo esperado, registra diferencias y deja el stock en lo contado
export const POST = route(async (req) => {
  const user = await requireUser("stock.contar", "stock.gestionar");
  await requireModule("stock");
  const b = await body(req);
  const lines = Array.isArray(b.lines) ? (b.lines as { stock_item_id: number; counted: number }[]) : [];
  if (!lines.length) throw new ApiError(400, "No hay artículos contados.");
  const notes = str(b.notes, "observaciones", { required: false, max: 500 });
  return sql.begin(async (tx) => {
    const [shift] = await tx`SELECT id FROM shifts WHERE user_id = ${user.id} AND status = 'abierto'`;
    const [cnt] = await tx`INSERT INTO stock_counts (shift_id, user_id, notes) VALUES (${shift?.id ?? null}, ${user.id}, ${notes}) RETURNING id`;
    const result: { name: string; unit: string; expected: number; counted: number; difference: number }[] = [];
    for (const l of lines) {
      const counted = parseQty(l.counted, "cantidad contada", true);
      if (counted < 0) throw new ApiError(400, "Las cantidades contadas no pueden ser negativas.");
      const [it] = await tx`SELECT id, name, unit, quantity FROM stock_items WHERE id = ${Number(l.stock_item_id)} FOR UPDATE`;
      if (!it) continue;
      const diff = Math.round((counted - it.quantity) * 1000) / 1000;
      await tx`INSERT INTO stock_count_lines (count_id, stock_item_id, expected, counted, difference)
        VALUES (${cnt.id}, ${it.id}, ${it.quantity}, ${counted}, ${diff})`;
      if (diff !== 0) await moveStock(tx, [{ stock_item_id: it.id, delta: diff }], { type: "control", user_id: user.id, count_id: cnt.id, notes: "Control al abrir turno" });
      result.push({ name: it.name, unit: it.unit, expected: it.quantity, counted, difference: diff });
    }
    const differences = result.filter((r) => r.difference !== 0).length;
    await tx`UPDATE stock_counts SET items_count = ${result.length}, differences = ${differences} WHERE id = ${cnt.id}`;
    await audit(tx, user.id, "control", "stock", cnt.id, undefined, { articulos: result.length, diferencias: differences }, notes);
    return { id: cnt.id, differences, lines: result };
  });
});
