// Neon agrega "channel_binding" a la URL; el driver lo enviaría como parámetro
// del servidor y PostgreSQL lo rechaza. Se quita (la conexión sigue cifrada con sslmode).
export function dbUrl(raw = process.env.DATABASE_URL) {
  try {
    const u = new URL(raw);
    u.searchParams.delete("channel_binding");
    return u.toString();
  } catch {
    return raw;
  }
}
