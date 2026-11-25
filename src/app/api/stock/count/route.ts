import { after } from "next/server";
import { notifyLowStock, type LowItem } from "@/lib/push";
import { sql } from "@/lib/db";
import { route, body, str, ApiError } from "@/lib/api";
import { requireUser, requireModule, can } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { moveStock } from "@/lib/stock";
import { parseQty } from "@/lib/stock-input";
import { schemaOk } from "@/lib/schema";

// Artículos a contar (sin mostrar la cantidad esperada: conteo "a ciegas")
export const GET = route(async () => {
  await requireUser("stock.contar", "stock.gestionar");
  await requireModule("stock");
  const packs = await schemaOk();
  return sql`SELECT id, name, unit, ${packs ? sql`units_per_pack` : sql`NULL::int AS units_per_pack`}
    FROM stock_items WHERE active AND count_on_shift ORDER BY sort, name`;
});

// Guarda el control: compara con lo esperado, registra diferencias y deja el stock en lo contado
export const POST = route(async (req) => {
  const user = await requireUser("stock.contar", "stock.gestionar");
  await requireModule("stock");
  const b = await body(req);
  // Cada línea trae "counted", o "packs" + "loose" para los artículos que se cuentan por paquete
  const lines = Array.isArray(b.lines) ? (b.lines as { stock_item_id: number; counted?: number; packs?: number; loose?: number }[]) : [];
  const withPacks = await schemaOk();
  if (!lines.length) throw new ApiError(400, "No hay artículos contados.");
  const notes = str(b.notes, "observaciones", { required: false, max: 500 });
  const low: LowItem[] = [];
  const res = await sql.begin(async (tx) => {
    const [shift] = await tx`SELECT id FROM shifts WHERE user_id = ${user.id} AND status = 'abierto'`;
    const [cnt] = await tx`INSERT INTO stock_counts (shift_id, user_id, notes) VALUES (${shift?.id ?? null}, ${user.id}, ${notes}) RETURNING id`;
    const result: { name: string; unit: string; expected: number; counted: number; difference: number; packs: number | null; loose: number | null; units_per_pack: number | null }[] = [];
    for (const l of lines) {
      const [it] = await tx`SELECT id, name, unit, quantity, ${withPacks ? tx`units_per_pack` : tx`NULL::int AS units_per_pack`}
        FROM stock_items WHERE id = ${Number(l.stock_item_id)} FOR UPDATE`;
      if (!it) continue;
      // Por paquete: total = paquetes cerrados × unidades por paquete + sueltas
      let packs: number | null = null, loose: number | null = null, counted: number;
      if (it.units_per_pack && (l.packs !== undefined || l.loose !== undefined)) {
        packs = parseQty(l.packs ?? 0, `paquetes de ${it.name}`, true);
        loose = parseQty(l.loose ?? 0, `sueltas de ${it.name}`, true);
        if (packs < 0 || loose < 0 || !Number.isInteger(packs)) throw new ApiError(400, `Revisá los paquetes y sueltas de ${it.name}.`);
        counted = packs * it.units_per_pack + loose;
      } else {
        counted = parseQty(l.counted, "cantidad contada", true);
      }
      if (counted < 0) throw new ApiError(400, "Las cantidades contadas no pueden ser negativas.");
      const diff = Math.round((counted - it.quantity) * 1000) / 1000;
      if (withPacks)
        await tx`INSERT INTO stock_count_lines (count_id, stock_item_id, expected, counted, difference, packs, loose, units_per_pack)
          VALUES (${cnt.id}, ${it.id}, ${it.quantity}, ${counted}, ${diff}, ${packs}, ${loose}, ${packs === null ? null : it.units_per_pack})`;
      else
        await tx`INSERT INTO stock_count_lines (count_id, stock_item_id, expected, counted, difference)
          VALUES (${cnt.id}, ${it.id}, ${it.quantity}, ${counted}, ${diff})`;
      if (diff !== 0) low.push(...await moveStock(tx, [{ stock_item_id: it.id, delta: diff }], { type: "control", user_id: user.id, count_id: cnt.id, notes: "Control al abrir turno" }));
      result.push({ name: it.name, unit: it.unit, expected: it.quantity, counted, difference: diff, packs, loose, units_per_pack: packs === null ? null : it.units_per_pack });
    }
    const differences = result.filter((r) => r.difference !== 0).length;
    await tx`UPDATE stock_counts SET items_count = ${result.length}, differences = ${differences} WHERE id = ${cnt.id}`;
    await audit(tx, user.id, "control", "stock", cnt.id, undefined, { articulos: result.length, diferencias: differences }, notes);
    return { id: cnt.id, differences, lines: result };
  });
  if (low.length) after(() => notifyLowStock(low));
  // El empleado que solo cuenta no recibe lo esperado ni las diferencias (control a ciegas)
  if (!can(user, "stock.ver", "stock.gestionar")) return { id: res.id, differences: res.differences, lines: [] };
  return res;
});
