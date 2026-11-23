import postgres from "postgres";

declare global {
  // eslint-disable-next-line no-var
  var __hd369_sql: postgres.Sql | undefined;
}

function create() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta la variable DATABASE_URL");
  // Neon agrega "channel_binding", que PostgreSQL rechaza como parámetro de conexión.
  // Supabase: el Transaction pooler (puerto 6543) deja colgadas las consultas simultáneas
  // sobre una misma conexión; el Session pooler (mismo host, puerto 5432) se comporta como un
  // PostgreSQL normal. Se usa el modo sesión salvo que DB_SUPABASE_TRANSACTION=si.
  let clean = url;
  try {
    const u = new URL(url);
    u.searchParams.delete("channel_binding");
    if (u.hostname.endsWith(".pooler.supabase.com") && u.port === "6543" && process.env.DB_SUPABASE_TRANSACTION !== "si") u.port = "5432";
    clean = u.toString();
  } catch {}
  return postgres(clean, {
    prepare: false, // compatible con poolers (Supabase / Neon)
    // En servidores serverless (Vercel) conviene 1 conexión por instancia: las consultas en
    // paralelo se encolan en ella y no se agotan las conexiones del plan gratuito de Supabase.
    max: Number(process.env.DB_MAX_CONNECTIONS) || (process.env.NODE_ENV === "production" ? 1 : 10),
    idle_timeout: 20,
    connect_timeout: 10,
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
