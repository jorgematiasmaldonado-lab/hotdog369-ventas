import postgres from "postgres";

declare global {
  // eslint-disable-next-line no-var
  var __hd369_sql: postgres.Sql | undefined;
}

function create() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta la variable DATABASE_URL");
  // Neon agrega "channel_binding", que PostgreSQL rechaza como parámetro de conexión
  let clean = url;
  try { const u = new URL(url); u.searchParams.delete("channel_binding"); clean = u.toString(); } catch {}
  return postgres(clean, {
    prepare: false, // compatible con poolers (Supabase / Neon)
    max: process.env.NODE_ENV === "production" ? 5 : 10,
    idle_timeout: 20,
    onnotice: () => {},
    types: {
      // numeric → number (los montos son pesos, sin riesgo de precisión)
      numeric: { to: 1700, from: [1700], serialize: (x: number) => String(x), parse: (x: string) => Number(x) },
      bigint: { to: 20, from: [20], serialize: (x: number) => String(x), parse: (x: string) => Number(x) },
    },
  });
}

export const sql: postgres.Sql = globalThis.__hd369_sql ?? (globalThis.__hd369_sql = create());
export type Tx = postgres.TransactionSql | postgres.Sql;

export const TZ = "America/Argentina/Buenos_Aires";
