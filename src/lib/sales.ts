import { sql, type Tx } from "./db";
import { ApiError } from "./api";
import { audit } from "./audit";
import type { SessionUser } from "./auth";
import { applySaleStock, revertSaleStock } from "./stock";

export type SaleInput = {
  id: string;
  shift_id?: number | null;
  created_at?: string | null; // solo para ventas cargadas sin conexión
  offline?: boolean;
  items: { product_id: number; qty: number; unit_price?: number }[];
  payments: { payment_method_id: number; amount: number }[];
  cash_received?: number | null;
  customer_id?: number | null;
  new_customer?: { name: string; phone?: string | null } | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Valida items/pagos contra la base y devuelve líneas con precio del servidor. */
async function buildLines(tx: Tx, items: SaleInput["items"], payments: SaleInput["payments"], allowPriceOverride: boolean) {
  if (!Array.isArray(items) || items.length === 0) throw new ApiError(400, "La venta no tiene productos.");
  if (!Array.isArray(payments) || payments.length === 0) throw new ApiError(400, "Falta el medio de pago.");
  if (items.length > 100 || payments.length > 10) throw new ApiError(400, "Venta demasiado grande.");

  const ids = [...new Set(items.map((i) => Number(i.product_id)))];
  const prods = await tx`SELECT p.id, p.name, p.price, c.name AS category_name FROM products p
    JOIN categories c ON c.id = p.category_id WHERE p.id IN ${tx(ids)}`;
  const map = new Map(prods.map((p) => [p.id, p]));

  const lines = items.map((i) => {
    const p = map.get(Number(i.product_id));
    const qty = Number(i.qty);
    if (!p) throw new ApiError(400, "Producto inexistente en la venta.");
    if (!Number.isInteger(qty) || qty <= 0 || qty > 999) throw new ApiError(400, "Cantidad inválida.");
    let unit = p.price as number;
    if (allowPriceOverride && i.unit_price !== undefined) {
      const u = Number(i.unit_price);
      if (!Number.isFinite(u) || u < 0) throw new ApiError(400, "Precio inválido.");
      unit = u;
    }
    return { product_id: p.id, product_name: p.name, category_name: p.category_name, unit_price: unit, qty, subtotal: unit * qty };
  });
  const total = lines.reduce((a, l) => a + l.subtotal, 0);

  const pmIds = [...new Set(payments.map((p) => Number(p.payment_method_id)))];
  const pms = await tx`SELECT id, name, kind FROM payment_methods WHERE id IN ${tx(pmIds)}`;
  const pmMap = new Map(pms.map((p) => [p.id, p]));
  const pays = payments.map((p) => {
    const pm = pmMap.get(Number(p.payment_method_id));
    const amount = Number(p.amount);
    if (!pm) throw new ApiError(400, "Medio de pago inválido.");
    if (!Number.isFinite(amount) || amount <= 0) throw new ApiError(400, "Monto de pago inválido.");
    return { payment_method_id: pm.id, kind: pm.kind as string, name: pm.name as string, amount };
  });
  return { lines, total, pays };
}

async function resolveCustomer(tx: Tx, input: SaleInput) {
  if (input.customer_id) {
    const [c] = await tx`SELECT id FROM customers WHERE id = ${Number(input.customer_id)} AND active`;
    if (!c) throw new ApiError(400, "Cliente inexistente.");
    return c.id as number;
  }
  if (input.new_customer?.name?.trim()) {
    const [c] = await tx`INSERT INTO customers (name, phone) VALUES (${input.new_customer.name.trim().slice(0, 120)},
      ${input.new_customer.phone?.trim().slice(0, 40) || null}) RETURNING id`;
    return c.id as number;
  }
  return null;
}

export async function createSale(user: SessionUser, input: SaleInput) {
  if (!input?.id || !UUID.test(input.id)) throw new ApiError(400, "Identificador de venta inválido.");

  return sql.begin(async (tx) => {
    // Idempotencia: si la venta ya llegó (reintento sin conexión), devolverla
    const [existing] = await tx`SELECT id, number FROM sales WHERE id = ${input.id}`;
    if (existing) return { id: existing.id, number: existing.number, duplicated: true };

    // Turno: el abierto del usuario, o el indicado si es suyo (ventas sin conexión)
    let shiftId: number | null = null;
    if (input.shift_id) {
      const [s] = await tx`SELECT id FROM shifts WHERE id = ${Number(input.shift_id)} AND user_id = ${user.id}`;
      shiftId = s?.id ?? null;
    }
    if (!shiftId) {
      const [s] = await tx`SELECT id FROM shifts WHERE user_id = ${user.id} AND status = 'abierto'`;
      shiftId = s?.id ?? null;
    }
    if (!shiftId) throw new ApiError(409, "Tenés que abrir el turno antes de vender.");

    const { lines, total, pays } = await buildLines(tx, input.items, input.payments, false);
    const paid = pays.reduce((a, p) => a + p.amount, 0);
    let adjustNote: string | null = null;
    if (Math.abs(paid - total) > 0.009) {
      // Venta sin conexión con un precio que cambió mientras tanto: se ajusta el pago mayor y se deja registro
      if (input.offline) {
        const target = [...pays].filter((p) => p.kind !== "fiado").sort((a, b) => b.amount - a.amount)[0] ?? pays[0];
        target.amount += total - paid;
        if (target.amount <= 0) throw new ApiError(409, "Los montos no coinciden con el total.");
        adjustNote = `Venta sin conexión: el total cambió de ${paid} a ${total} por actualización de precios.`;
      } else {
        throw new ApiError(400, `Los pagos (${paid}) no coinciden con el total (${total}).`);
      }
    }

    const fiado = pays.filter((p) => p.kind === "fiado").reduce((a, p) => a + p.amount, 0);
    const customerId = await resolveCustomer(tx, input);
    if (fiado > 0 && !customerId) throw new ApiError(400, "Para fiar hay que indicar el cliente.");

    const cashPart = pays.filter((p) => p.kind === "efectivo").reduce((a, p) => a + p.amount, 0);
    let cashReceived: number | null = null;
    let change: number | null = null;
    if (cashPart > 0 && input.cash_received != null && input.cash_received !== ("" as never)) {
      cashReceived = Number(input.cash_received);
      if (!Number.isFinite(cashReceived) || cashReceived < cashPart) throw new ApiError(400, "El efectivo recibido no alcanza.");
      change = cashReceived - cashPart;
    }

    let createdAt = new Date();
    if (input.offline && input.created_at) {
      const d = new Date(input.created_at);
      // se acepta la hora del dispositivo si es razonable (hasta 3 días atrás, no futura)
      if (!isNaN(+d) && d <= new Date(Date.now() + 60000) && d > new Date(Date.now() - 3 * 86400000)) createdAt = d;
    }

    const [sale] = await tx`
      INSERT INTO sales (id, branch_id, shift_id, user_id, customer_id, created_at, total, cash_received, change_given, offline)
      VALUES (${input.id}, ${user.branch_id}, ${shiftId}, ${user.id}, ${customerId}, ${createdAt}, ${total},
              ${cashReceived}, ${change}, ${!!input.offline})
      RETURNING id, number`;
    for (const l of lines) {
      await tx`INSERT INTO sale_items (sale_id, product_id, product_name, category_name, unit_price, qty, subtotal)
        VALUES (${sale.id}, ${l.product_id}, ${l.product_name}, ${l.category_name}, ${l.unit_price}, ${l.qty}, ${l.subtotal})`;
    }
    for (const p of pays) {
      await tx`INSERT INTO sale_payments (sale_id, payment_method_id, amount) VALUES (${sale.id}, ${p.payment_method_id}, ${p.amount})`;
    }
    if (fiado > 0) {
      await tx`INSERT INTO customer_movements (customer_id, sale_id, shift_id, type, amount, user_id, notes, created_at)
        VALUES (${customerId}, ${sale.id}, ${shiftId}, 'cargo', ${fiado}, ${user.id}, ${"Venta #" + sale.number}, ${createdAt})`;
    }
    const low_stock = await applySaleStock(tx, sale.id, lines, -1, "venta", user.id);
    if (adjustNote) await audit(tx, user.id, "ajuste_precio", "venta", sale.id, { pagado: paid }, { total }, adjustNote);
    return { id: sale.id, number: sale.number, total, change, low_stock };
  });
}

export async function voidSale(user: SessionUser, saleId: string, reason: string) {
  if (!UUID.test(saleId)) throw new ApiError(400, "Venta inválida.");
  return sql.begin(async (tx) => {
    const [s] = await tx`SELECT s.*, sh.status AS shift_status FROM sales s LEFT JOIN shifts sh ON sh.id = s.shift_id
      WHERE s.id = ${saleId} FOR UPDATE OF s`;
    if (!s) throw new ApiError(404, "La venta no existe.");
    if (s.status === "anulada") throw new ApiError(409, "La venta ya estaba anulada.");
    const isAdmin = user.permissions.includes("ventas.editar");
    if (!isAdmin) {
      if (!user.permissions.includes("ventas.anular")) throw new ApiError(403, "No tenés permiso para anular.");
      if (s.user_id !== user.id || s.shift_status !== "abierto")
        throw new ApiError(403, "Solo podés anular tus ventas del turno abierto. Pedile al administrador.");
    }
    await tx`UPDATE sales SET status = 'anulada', void_reason = ${reason}, voided_by = ${user.id}, voided_at = now() WHERE id = ${saleId}`;
    // revertir el fiado si lo hubo
    const [cargo] = await tx`SELECT COALESCE(sum(amount),0) AS amount FROM customer_movements WHERE sale_id = ${saleId} AND type = 'cargo'`;
    const [rev] = await tx`SELECT COALESCE(sum(amount),0) AS amount FROM customer_movements WHERE sale_id = ${saleId} AND type = 'anulacion'`;
    if (s.customer_id && cargo.amount - rev.amount > 0) {
      await tx`INSERT INTO customer_movements (customer_id, sale_id, shift_id, type, amount, user_id, notes)
        VALUES (${s.customer_id}, ${saleId}, ${s.shift_id}, 'anulacion', ${cargo.amount - rev.amount}, ${user.id}, ${"Anulación venta #" + s.number})`;
    }
    await revertSaleStock(tx, saleId, "anulacion", user.id);
    await audit(tx, user.id, "anular", "venta", saleId, { status: "confirmada", total: s.total }, { status: "anulada" }, reason);
    return { ok: true };
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getSale(saleId: string, db: Tx = sql): Promise<Record<string, any> | null> {
  if (!UUID.test(saleId)) return null;
  const [s] = await db`
    SELECT s.*, u.name AS user_name, vu.name AS voided_by_name, eu.name AS edited_by_name, c.name AS customer_name
    FROM sales s JOIN users u ON u.id = s.user_id LEFT JOIN users vu ON vu.id = s.voided_by
    LEFT JOIN users eu ON eu.id = s.edited_by LEFT JOIN customers c ON c.id = s.customer_id
    WHERE s.id = ${saleId}`;
  if (!s) return null;
  const items = await db`SELECT product_id, product_name, category_name, unit_price, qty, subtotal FROM sale_items WHERE sale_id = ${saleId} ORDER BY id`;
  const payments = await db`SELECT sp.payment_method_id, pm.name, pm.kind, sp.amount FROM sale_payments sp
    JOIN payment_methods pm ON pm.id = sp.payment_method_id WHERE sp.sale_id = ${saleId} ORDER BY sp.id`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { ...(s as Record<string, any>), items, payments };
}

/** Edición completa de una venta por el administrador (queda en auditoría). */
export async function editSale(user: SessionUser, saleId: string, input: Pick<SaleInput, "items" | "payments" | "customer_id">, reason: string) {
  return sql.begin(async (tx) => {
    const before = await getSale(saleId, tx);
    if (!before) throw new ApiError(404, "La venta no existe.");
    if (before.status === "anulada") throw new ApiError(409, "No se puede editar una venta anulada.");
    const { lines, total, pays } = await buildLines(tx, input.items, input.payments, true);
    const paid = pays.reduce((a, p) => a + p.amount, 0);
    if (Math.abs(paid - total) > 0.009) throw new ApiError(400, `Los pagos (${paid}) no coinciden con el total (${total}).`);
    const fiado = pays.filter((p) => p.kind === "fiado").reduce((a, p) => a + p.amount, 0);
    const customerId = input.customer_id ? Number(input.customer_id) : fiado > 0 ? before.customer_id : null;
    if (fiado > 0 && !customerId) throw new ApiError(400, "Para fiar hay que indicar el cliente.");

    await revertSaleStock(tx, saleId, "edicion", user.id);
    await tx`DELETE FROM sale_items WHERE sale_id = ${saleId}`;
    await tx`DELETE FROM sale_payments WHERE sale_id = ${saleId}`;
    for (const l of lines)
      await tx`INSERT INTO sale_items (sale_id, product_id, product_name, category_name, unit_price, qty, subtotal)
        VALUES (${saleId}, ${l.product_id}, ${l.product_name}, ${l.category_name}, ${l.unit_price}, ${l.qty}, ${l.subtotal})`;
    for (const p of pays)
      await tx`INSERT INTO sale_payments (sale_id, payment_method_id, amount) VALUES (${saleId}, ${p.payment_method_id}, ${p.amount})`;
    const low_stock = await applySaleStock(tx, saleId, lines, -1, "edicion", user.id);
    const cashPart = pays.filter((p) => p.kind === "efectivo").reduce((a, p) => a + p.amount, 0);
    const cashReceived = before.cash_received != null && before.cash_received >= cashPart && cashPart > 0 ? before.cash_received : null;
    await tx`UPDATE sales SET total = ${total}, customer_id = ${customerId}, edited_at = now(), edited_by = ${user.id},
      cash_received = ${cashReceived}, change_given = ${cashReceived != null ? cashReceived - cashPart : null} WHERE id = ${saleId}`;

    // Ajustar la cuenta corriente del cliente según el nuevo monto fiado
    const prevCustomer = before.customer_id as number | null;
    const [prev] = await tx`SELECT COALESCE(sum(CASE WHEN type='cargo' THEN amount WHEN type='anulacion' THEN -amount ELSE 0 END),0) AS net
      FROM customer_movements WHERE sale_id = ${saleId}`;
    if (prevCustomer && prev.net > 0 && (prevCustomer !== customerId || prev.net !== fiado)) {
      await tx`INSERT INTO customer_movements (customer_id, sale_id, shift_id, type, amount, user_id, notes)
        VALUES (${prevCustomer}, ${saleId}, ${before.shift_id}, 'anulacion', ${prev.net}, ${user.id}, ${"Edición venta #" + before.number})`;
    }
    if (fiado > 0 && (prevCustomer !== customerId || prev.net !== fiado || !prevCustomer)) {
      await tx`INSERT INTO customer_movements (customer_id, sale_id, shift_id, type, amount, user_id, notes)
        VALUES (${customerId}, ${saleId}, ${before.shift_id}, 'cargo', ${fiado}, ${user.id}, ${"Edición venta #" + before.number})`;
    }
    const after = await getSale(saleId, tx);
    const slim = (s: NonNullable<typeof before> | null) => ({ total: s!.total, items: s!.items, payments: s!.payments, customer_id: s!.customer_id });
    await audit(tx, user.id, "editar", "venta", saleId, slim(before), slim(after), reason);
    return { ...after, low_stock };
  });
}
