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

export type RangeKey = "hoy" | "ayer" | "semana" | "mes" | "personalizado";

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
