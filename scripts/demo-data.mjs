// Genera ~30 días de ventas ficticias para mostrar la app. NO usar en producción.
// Uso: npm run db:demo -- --si
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { loadEnv } from "./env.mjs";

if (!process.argv.includes("--si")) {
  console.log("Este script carga ventas FICTICIAS. Para confirmar: npm run db:demo -- --si");
  process.exit(0);
}
loadEnv();
const sql = postgres(process.env.DATABASE_URL, { prepare: false, onnotice: () => {} });
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const products = await sql`SELECT p.id, p.name, p.price::int AS price, c.name AS cat FROM products p JOIN categories c ON c.id = p.category_id WHERE p.active`;
const pms = await sql`SELECT id, kind FROM payment_methods WHERE active`;
const users = await sql`SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE r.key IN ('empleado','admin')`;
const types = await sql`SELECT id, name FROM shift_types ORDER BY sort`;
const [branch] = await sql`SELECT min(id) AS id FROM branches`;
const cash = pms.find((p) => p.kind === "efectivo"), transfer = pms.find((p) => p.kind === "transferencia"), fiado = pms.find((p) => p.kind === "fiado");
const others = pms.filter((p) => p.kind === "otro");
const names = ["María Gómez", "Lucas Fernández", "Sofía Díaz", "Kiosco La Esquina", "Martín López"];
const customers = [];
for (const n of names) customers.push((await sql`INSERT INTO customers (name, phone) VALUES (${n}, ${"351" + rnd(1000000, 9999999)}) RETURNING id`)[0].id);

const hourWeight = { 8: 3, 9: 5, 10: 4, 11: 5, 12: 9, 13: 10, 14: 5, 15: 3, 16: 4, 17: 6, 18: 6, 19: 8, 20: 11, 21: 12, 22: 9, 23: 4 };
const dowFactor = [1.5, 0.8, 0.85, 0.9, 1.0, 1.4, 1.7];
let count = 0;
await sql.begin(async (tx) => {
  const arDate = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(d);
  for (let back = 30; back >= 0; back--) {
    const ymd = arDate(new Date(Date.now() - back * 86400000));
    const dow = new Date(ymd + "T12:00:00Z").getUTCDay();
    for (const [ti, [h0, h1]] of [[8, 15], [16, 23]].entries()) {
      const user = pick(users).id;
      const open = new Date(`${ymd}T${String(h0).padStart(2, "0")}:00:00-03:00`);
      const close = new Date(`${ymd}T${String(h1).padStart(2, "0")}:59:00-03:00`);
      const [sh] = await tx`INSERT INTO shifts (branch_id, user_id, shift_type_id, status, opened_at, closed_at, opening_cash)
        VALUES (${branch.id}, ${user}, ${types[ti === 0 ? 0 : 1].id}, 'cerrado', ${open}, ${close}, 10000) RETURNING id`;
      let cashIn = 0;
      for (let h = h0; h <= h1; h++) {
        const n = Math.round((hourWeight[h] ?? 2) * dowFactor[dow] * (0.6 + Math.random() * 0.8));
        for (let k = 0; k < n; k++) {
          const at = new Date(open.getTime() + (h - h0) * 3600000 + rnd(0, 3540) * 1000);
          if (at > new Date()) continue; // hoy: solo hasta la hora actual
          const pool = h < 12 ? products.filter((p) => p.cat === "Cafetería") : h < 16 ? products : products.filter((p) => p.cat === "Panchería" || Math.random() < 0.3);
          const items = Array.from({ length: rnd(1, 3) }, () => ({ p: pick(pool), q: Math.random() < 0.8 ? 1 : 2 }));
          const total = items.reduce((a, i) => a + i.p.price * i.q, 0);
          const r = Math.random();
          const voided = Math.random() < 0.02;
          let pays, customer = null;
          if (r < 0.45) pays = [[cash.id, total]];
          else if (r < 0.82) pays = [[transfer.id, total]];
          else if (r < 0.92) pays = [[pick(others).id, total]];
          else if (r < 0.97) { const c = Math.round(total / 2 / 100) * 100; pays = [[cash.id, c], [transfer.id, total - c]]; }
          else { pays = [[fiado.id, total]]; customer = pick(customers); }
          const id = randomUUID();
          await tx`INSERT INTO sales (id, branch_id, shift_id, user_id, customer_id, created_at, total, status, void_reason, voided_by, voided_at)
            VALUES (${id}, ${branch.id}, ${sh.id}, ${user}, ${customer}, ${at}, ${total}, ${voided ? "anulada" : "confirmada"},
              ${voided ? pick(["Error de carga", "Cliente se arrepintió", "Venta duplicada"]) : null}, ${voided ? user : null}, ${voided ? at : null})`;
          for (const i of items) await tx`INSERT INTO sale_items (sale_id, product_id, product_name, category_name, unit_price, qty, subtotal)
            VALUES (${id}, ${i.p.id}, ${i.p.name}, ${i.p.cat}, ${i.p.price}, ${i.q}, ${i.p.price * i.q})`;
          for (const [pm, amt] of pays) await tx`INSERT INTO sale_payments (sale_id, payment_method_id, amount) VALUES (${id}, ${pm}, ${amt})`;
          if (customer && !voided) await tx`INSERT INTO customer_movements (customer_id, sale_id, shift_id, type, amount, user_id, created_at) VALUES (${customer}, ${id}, ${sh.id}, 'cargo', ${total}, ${user}, ${at})`;
          if (!voided) cashIn += pays.filter(([pm]) => pm === cash.id).reduce((a, [, v]) => a + v, 0);
          count++;
        }
      }
      if (open > new Date()) { await tx`DELETE FROM shifts WHERE id = ${sh.id}`; continue; }
      if (close > new Date()) { await tx`UPDATE shifts SET status = 'abierto', closed_at = NULL WHERE id = ${sh.id}`; continue; } // turno en curso
      const expected = 10000 + cashIn;
      const diff = Math.random() < 0.7 ? 0 : pick([-500, -1000, 200, 500, -2000]);
      await tx`UPDATE shifts SET expected_cash = ${expected}, counted_cash = ${expected + diff}, difference = ${diff} WHERE id = ${sh.id}`;
    }
    if (back % 3 === 0) await tx`INSERT INTO expenses (branch_id, date, supplier, category_id, amount, payment_method_id, user_id)
      VALUES (${branch.id}, ${ymd}, ${pick(["Distribuidora Norte", "Panificadora Sol", "Coca-Cola FEMSA", "Fiambrería Don José"])},
        (SELECT id FROM expense_categories ORDER BY random() LIMIT 1), ${rnd(20, 120) * 1000}, ${cash.id}, ${users[0].id})`;
  }
  for (const c of customers.slice(0, 2)) await tx`INSERT INTO customer_movements (customer_id, type, amount, payment_method_id, user_id, created_at)
    SELECT ${c}, 'pago', LEAST(5000, COALESCE(sum(amount),0)), ${transfer.id}, ${users[0].id}, now() - interval '2 days' FROM customer_movements WHERE customer_id = ${c} HAVING sum(amount) > 0`;
});
console.log(`Cargadas ${count} ventas de demostración.`);
await sql.end();
