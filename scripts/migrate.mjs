// Ejecuta las migraciones SQL de db/migrations en orden (una sola vez cada una).
import postgres from "postgres";
import { dbUrl } from "./db-url.mjs";
import { explainDbError } from "./db-error.mjs";
import { readdirSync, readFileSync } from "node:fs";
import { loadEnv } from "./env.mjs";

loadEnv();
try {
const sql = postgres(dbUrl(), { prepare: false, onnotice: () => {} });
await sql`CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`;
const done = new Set((await sql`SELECT name FROM schema_migrations`).map((r) => r.name));
const files = readdirSync("db/migrations").filter((f) => f.endsWith(".sql")).sort();
for (const f of files) {
  if (done.has(f)) continue;
  const body = readFileSync(`db/migrations/${f}`, "utf8");
  await sql.begin(async (tx) => {
    await tx.unsafe(body);
    await tx`INSERT INTO schema_migrations (name) VALUES (${f})`;
  });
  console.log("✔ aplicada", f);
}
// Tablas creadas después también quedan protegidas (idempotente)
await sql.unsafe(`DO $$ DECLARE t record; BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND NOT rowsecurity LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP; END $$;`);
console.log("Migraciones al día.");
await sql.end();
} catch (e) {
  explainDbError(e);
  process.exit(1);
}
