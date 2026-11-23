// Se ejecuta en cada publicación en Vercel: prepara la base y compila la app.
// - Migraciones: crea/actualiza las tablas (solo aplica las nuevas).
// - Datos iniciales: solo si la base está vacía.
// - Datos de demostración: solo si CARGAR_DEMO=si y todavía no hay ventas.
import { execSync } from "node:child_process";
import postgres from "postgres";
import { dbUrl } from "./db-url.mjs";

const run = (cmd) => execSync(cmd, { stdio: "inherit" });

if (!process.env.DATABASE_URL) {
  console.error("Falta la variable DATABASE_URL en Vercel (Settings → Environment Variables).");
  process.exit(1);
}
run("node scripts/migrate.mjs");
run("node scripts/seed.mjs");
if ((process.env.CARGAR_DEMO ?? "").toLowerCase() === "si") {
  const sql = postgres(dbUrl(), { prepare: false, onnotice: () => {} });
  const [{ n }] = await sql`SELECT count(*)::int AS n FROM sales`;
  await sql.end();
  if (n === 0) run("node scripts/demo-data.mjs --si");
  else console.log("Datos de demostración: ya hay ventas, no se cargan.");
}
run("npx next build");
