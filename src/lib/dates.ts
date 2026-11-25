// Utilidades de fechas en la zona horaria del negocio (Argentina)
export const TZ = "America/Argentina/Buenos_Aires";

/** Fecha local YYYY-MM-DD del instante dado (por defecto, ahora) */
export function localDate(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export function addDays(date: string, n: number): string {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Día de la semana (0=domingo) de una fecha YYYY-MM-DD */
export function weekday(date: string): number {
  return new Date(date + "T12:00:00Z").getUTCDay();
}

export type RangeKey = "hoy" | "ayer" | "semana" | "mes" | "q1" | "q2" | "quincena" | "quincena_anterior" | "personalizado";

/** Último día del mes de la fecha dada */
export function monthEnd(date: string): string {
  const d = new Date(date.slice(0, 8) + "01T12:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return d.toISOString().slice(0, 10);
}

/** Quincena que contiene la fecha: 1 al 15, o 16 a fin de mes */
export function quincenaOf(date: string): { from: string; to: string } {
  const m = date.slice(0, 8);
  return Number(date.slice(8)) <= 15 ? { from: m + "01", to: m + "15" } : { from: m + "16", to: monthEnd(date) };
}

/** Devuelve el rango [from, to] (fechas locales inclusivas) */
export function resolveRange(range: string | null, from?: string | null, to?: string | null): { from: string; to: string } {
  const today = localDate();
  switch (range) {
    case "ayer": {
      const y = addDays(today, -1);
      return { from: y, to: y };
    }
    case "semana": {
      const wd = weekday(today); // lunes como inicio de semana
      return { from: addDays(today, -((wd + 6) % 7)), to: today };
    }
    case "mes":
      return { from: today.slice(0, 8) + "01", to: today };
    case "q1":
      return { from: today.slice(0, 8) + "01", to: today.slice(0, 8) + "15" };
    case "q2":
      return { from: today.slice(0, 8) + "16", to: monthEnd(today) };
    case "quincena":
      return quincenaOf(today);
    case "quincena_anterior":
      return quincenaOf(addDays(quincenaOf(today).from, -1));
    case "personalizado":
      if (from && to && /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to))
        return from <= to ? { from, to } : { from: to, to: from };
      return { from: today, to: today };
    default:
      return { from: today, to: today };
  }
}

export function daysBetween(from: string, to: string) {
  return Math.round((new Date(to + "T12:00:00Z").getTime() - new Date(from + "T12:00:00Z").getTime()) / 86400000) + 1;
}
