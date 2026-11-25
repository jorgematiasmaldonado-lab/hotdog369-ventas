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

/** Hora local (minutos desde medianoche) y día de la semana del instante dado, en la zona del negocio */
export function localClock(d: Date = new Date()): { minutes: number; weekday: number; date: string } {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour12: false, hour: "2-digit", minute: "2-digit", weekday: "short" })
    .formatToParts(d).map((x) => [x.type, x.value]));
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
  return { minutes: (Number(p.hour) % 24) * 60 + Number(p.minute), weekday: wd, date: localDate(d) };
}

export const hhmmToMin = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));

/**
 * ¿Cuántos minutos pasaron desde el horario de inicio del turno?
 * Toma el inicio más reciente (hoy o, para turnos de noche, ayer) dentro de las últimas 8 horas.
 * Devuelve null si el turno no tiene horario, si todavía no empezó o si ese día no se abre.
 */
export function minutesSinceStart(start: string | null | undefined, days: string | null | undefined, now: Date = new Date()): { minutes: number; day: string } | null {
  if (!start || !/^\d{2}:\d{2}/.test(start)) return null;
  const c = localClock(now);
  const s = hhmmToMin(start);
  let diff = c.minutes - s, wd = c.weekday, day = c.date;
  if (diff < 0) { diff += 1440; wd = (wd + 6) % 7; day = addDays(c.date, -1); }
  if (diff > 8 * 60) return null;
  if (days && !days.includes(String(wd))) return null;
  return { minutes: diff, day };
}

export function fmtMinutes(m: number) {
  const h = Math.floor(m / 60), r = m % 60;
  return h ? `${h} h${r ? ` ${r} min` : ""}` : `${r} min`;
}
