import type { Tx } from "./db";

/** Caja inicial que el administrador dejó cargada para el próximo turno (null = no cargó). */
export async function getNextOpeningCash(db: Tx): Promise<number | null> {
  const [r] = await db`SELECT value FROM settings WHERE key = 'next_opening_cash'`;
  const v = r?.value;
  return typeof v === "number" && v >= 0 ? v : null;
}
