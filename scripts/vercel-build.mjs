// Publicación en Vercel.
// Por defecto SOLO compila la app: la base se crea en Supabase con los archivos
// de db/supabase/ (SQL Editor). Si se define PREPARAR_BASE=si, además aplica las
// migraciones y los datos iniciales automáticamente (y CARGAR_DEMO=si, la demo).
import { execSync } from "node:child_process";

const run = (cmd) => {
  try { execSync(cmd, { stdio: "inherit" }); }
  catch { console.error(`\nFalló: ${cmd} (ver el mensaje de arriba)`); process.exit(1); }
};

if ((process.env.PREPARAR_BASE ?? "").toLowerCase() === "si") {
  if (!process.env.DATABASE_URL) { console.error("Falta DATABASE_URL."); process.exit(1); }
  run("node scripts/migrate.mjs");
  run("node scripts/seed.mjs");
  if ((process.env.CARGAR_DEMO ?? "").toLowerCase() === "si") {
    const { default: postgres } = await import("postgres");
    const { dbUrl } = await import("./db-url.mjs");
    const sql = postgres(dbUrl(), { prepare: false, onnotice: () => {} });
    const [{ n }] = await sql`SELECT count(*)::int AS n FROM sales`;
    await sql.end();
    if (n === 0) run("node scripts/demo-data.mjs --si");
  }
} else {
  console.log("Compilando la app (la base se administra desde Supabase → SQL Editor).");
}
run("npx next build");
