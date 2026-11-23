const money = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
export const ars = (n: number | null | undefined) => `$ ${money.format(Math.round(Number(n ?? 0)))}`;
export const int = (n: number | null | undefined) => money.format(Number(n ?? 0));

const TZ = "America/Argentina/Buenos_Aires";
export const fmtDateTime = (d: string | Date) =>
  new Date(d).toLocaleString("es-AR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
export const fmtTime = (d: string | Date) =>
  new Date(d).toLocaleTimeString("es-AR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
export const fmtDate = (d: string | Date) =>
  typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)
    ? d.split("-").reverse().join("/")
    : new Date(d).toLocaleDateString("es-AR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" });

export const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
export const DAYS_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
