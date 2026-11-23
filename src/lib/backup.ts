import "server-only";
import { gzipSync, gunzipSync } from "node:zlib";
import { sql, type Tx } from "./db";
import { ApiError } from "./api";

// Orden: primero las tablas "padre", después las que dependen de ellas.
export const BACKUP_TABLES = [
  "branches", "roles", "users", "shift_types", "categories", "products", "combo_items", "product_price_history",
  "payment_methods", "customers", "void_reasons", "shifts", "sales", "sale_items", "sale_payments", "customer_movements",
  "expense_categories", "expenses", "cash_movements", "modules", "settings",
  "stock_items", "product_components", "stock_counts", "stock_count_lines", "stock_movements",
  "time_entries", "time_off", "audit_log",
];

type TableDump = { columns: string[]; rows: unknown[][] };
export type Backup = { app: "hotdog369"; format: 1; created_at: string; tables: Record<string, TableDump> };

async function existingTables(db: Tx) {
  const rows = await db`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;
  return new Set(rows.map((r) => r.tablename as string));
}

export async function createBackup(): Promise<{ file: Buffer; counts: Record<string, number>; created_at: string }> {
  const exists = await existingTables(sql);
  const tables: Record<string, TableDump> = {};
  const counts: Record<string, number> = {};
  for (const t of BACKUP_TABLES) {
    if (!exists.has(t)) continue;
    const cols = (await sql`SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ${t} ORDER BY ordinal_position`).map((r) => r.column_name as string);
    const rows = await sql.unsafe(`SELECT * FROM public."${t}"`);
    tables[t] = { columns: cols, rows: rows.map((r) => cols.map((c) => (r as Record<string, unknown>)[c])) };
    counts[t] = rows.length;
  }
  const created_at = new Date().toISOString();
  const data: Backup = { app: "hotdog369", format: 1, created_at, tables };
  return { file: gzipSync(Buffer.from(JSON.stringify(data)), { level: 9 }), counts, created_at };
}

export function readBackup(buf: Buffer): Backup {
  let data: Backup;
  try {
    const raw = buf[0] === 0x1f && buf[1] === 0x8b ? gunzipSync(buf) : buf;
    data = JSON.parse(raw.toString("utf8"));
  } catch {
    throw new ApiError(400, "El archivo no es un respaldo válido.");
  }
  if (data?.app !== "hotdog369" || !data.tables || typeof data.tables !== "object")
    throw new ApiError(400, "El archivo no es un respaldo de HOT DOG 369.");
  return data;
}

/** Reemplaza TODOS los datos por los del respaldo (en una sola transacción). */
export async function restoreBackup(data: Backup) {
  return sql.begin(async (tx) => {
    const exists = await existingTables(tx);
    const targets = BACKUP_TABLES.filter((t) => exists.has(t));
    await tx.unsafe(`TRUNCATE TABLE ${targets.map((t) => `public."${t}"`).join(", ")} RESTART IDENTITY CASCADE`);
    const counts: Record<string, number> = {};
    for (const t of targets) {
      const dump = data.tables[t];
      if (!dump?.rows?.length) { counts[t] = 0; continue; }
      const valid = new Set((await tx`SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = ${t}`).map((r) => r.column_name as string));
      const jsonCols = new Set((await tx`SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = ${t} AND data_type IN ('json','jsonb')`).map((r) => r.column_name as string));
      const cols = dump.columns.filter((c) => valid.has(c));
      const idx = cols.map((c) => dump.columns.indexOf(c));
      const chunk = Math.max(1, Math.floor(30000 / Math.max(1, cols.length)));
      for (let i = 0; i < dump.rows.length; i += chunk) {
        const objs = dump.rows.slice(i, i + chunk).map((row) =>
          Object.fromEntries(cols.map((c, k) => {
            const v = row[idx[k]];
            return [c, jsonCols.has(c) && v !== null && v !== undefined ? tx.json(v as never) : v];
          })));
        await tx`INSERT INTO ${tx(t)} ${tx(objs as never, cols)}`;
      }
      counts[t] = dump.rows.length;
    }
    // Las numeraciones (ids, n° de venta) siguen desde el último valor restaurado
    const seqs = await tx`SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND column_default LIKE 'nextval(%'`;
    for (const s of seqs) {
      if (!targets.includes(s.table_name)) continue;
      await tx.unsafe(`SELECT setval(pg_get_serial_sequence('public."${s.table_name}"', '${s.column_name}'),
        COALESCE((SELECT max("${s.column_name}") FROM public."${s.table_name}"), 1),
        (SELECT max("${s.column_name}") FROM public."${s.table_name}") IS NOT NULL)`);
    }
    return counts;
  });
}
