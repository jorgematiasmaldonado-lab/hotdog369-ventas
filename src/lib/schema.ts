import { sql } from "./db";

/** Última migración que esta versión de la app necesita en la base. */
export const REQUIRED_MIGRATION = "003_stock_horas.sql";

let cache: { ok: boolean; at: number } | null = null;

/** ¿La base tiene aplicada la última migración? (se consulta como mucho una vez por minuto) */
export async function schemaOk(): Promise<boolean> {
  if (cache && Date.now() - cache.at < 60_000) return cache.ok;
  let ok = false;
  try {
    const [r] = await sql`SELECT 1 AS x FROM schema_migrations WHERE name = ${REQUIRED_MIGRATION}`;
    ok = !!r;
  } catch {
    ok = false;
  }
  cache = { ok, at: Date.now() };
  return ok;
}
