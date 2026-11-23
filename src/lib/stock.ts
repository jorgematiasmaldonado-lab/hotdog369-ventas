import { sql, type Tx } from "./db";

async function stockEnabled(tx: Tx) {
  try {
    const [m] = await tx`SELECT enabled FROM modules WHERE key = 'stock'`;
    return !!m?.enabled;
  } catch {
    return false; // base sin la migración de stock
  }
}

/** Mueve stock de varios artículos y deja registro. delta con signo (+ entra, − sale). */
export async function moveStock(
  tx: Tx,
  moves: { stock_item_id: number; delta: number }[],
  info: { type: string; user_id: number | null; sale_id?: string | null; count_id?: number | null; unit_cost?: number | null; supplier?: string | null; notes?: string | null },
) {
  for (const m of moves) {
    if (!m.delta) continue;
    const [it] = await tx`UPDATE stock_items SET quantity = quantity + ${m.delta} WHERE id = ${m.stock_item_id} RETURNING quantity`;
    if (!it) continue;
    await tx`INSERT INTO stock_movements (stock_item_id, type, qty, balance_after, sale_id, count_id, unit_cost, supplier, notes, user_id)
      VALUES (${m.stock_item_id}, ${info.type}, ${m.delta}, ${it.quantity}, ${info.sale_id ?? null}, ${info.count_id ?? null},
              ${info.unit_cost ?? null}, ${info.supplier ?? null}, ${info.notes ?? null}, ${info.user_id})`;
  }
}

/** Descuenta (o repone) el stock de los productos de una venta según sus recetas. */
export async function applySaleStock(
  tx: Tx, saleId: string, lines: { product_id: number | null; qty: number }[], sign: 1 | -1, type: "venta" | "edicion", userId: number,
) {
  if (!(await stockEnabled(tx))) return;
  const ids = [...new Set(lines.map((l) => l.product_id).filter((x): x is number => !!x))];
  if (!ids.length) return;
  const comps = await tx`SELECT pc.product_id, pc.stock_item_id, pc.qty FROM product_components pc
    JOIN stock_items si ON si.id = pc.stock_item_id WHERE si.active AND pc.product_id IN ${tx(ids)}`;
  const acc = new Map<number, number>();
  for (const l of lines) for (const c of comps.filter((c) => c.product_id === l.product_id))
    acc.set(c.stock_item_id, (acc.get(c.stock_item_id) ?? 0) + sign * c.qty * l.qty);
  await moveStock(tx, [...acc].map(([stock_item_id, delta]) => ({ stock_item_id, delta })), { type, user_id: userId, sale_id: saleId });
}

/** Devuelve al stock todo lo que una venta descontó (al anular o antes de editarla). */
export async function revertSaleStock(tx: Tx, saleId: string, type: "anulacion" | "edicion", userId: number) {
  if (!(await stockEnabled(tx))) return;
  const net = await tx`SELECT stock_item_id, sum(qty) AS qty FROM stock_movements WHERE sale_id = ${saleId} GROUP BY stock_item_id`;
  await moveStock(tx, net.filter((n) => n.qty !== 0).map((n) => ({ stock_item_id: n.stock_item_id, delta: -n.qty })), { type, user_id: userId, sale_id: saleId });
}

export async function stockSettings(db: Tx = sql) {
  try {
    const [m] = await db`SELECT enabled FROM modules WHERE key = 'stock'`;
    const [s] = await db`SELECT value FROM settings WHERE key = 'stock_control_on_open'`;
    const mode = (s?.value as string) ?? "obligatorio";
    return { enabled: !!m?.enabled, control: (["obligatorio", "opcional", "no"].includes(mode) ? mode : "obligatorio") as "obligatorio" | "opcional" | "no" };
  } catch {
    return { enabled: false, control: "no" as const };
  }
}
