import { sql, TZ } from "@/lib/db";
import { route, ApiError } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { resolveRange } from "@/lib/dates";
import { reports } from "@/lib/reports";
import { DAYS } from "@/lib/format";

// CSV compatible con Excel en español (separador ; y BOM UTF-8)
function csv(headers: string[], rows: (string | number | null | undefined)[][]) {
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "number" ? String(v).replace(".", ",") : String(v);
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [headers, ...rows].map((r) => r.map(esc).join(";")).join("\r\n");
}
const dt = (d: string | Date | null) =>
  d ? new Date(d).toLocaleString("es-AR", { timeZone: TZ, dateStyle: "short", timeStyle: "short" }) : "";

export const GET = route(async (req) => {
  await requireUser("reportes.ver");
  const u = new URL(req.url);
  const section = u.searchParams.get("section") ?? "ventas";
  const { from, to } = resolveRange(u.searchParams.get("range") ?? "mes", u.searchParams.get("from"), u.searchParams.get("to"));
  let out: string;

  if (section === "ventas") {
    const rows = await sql`
      SELECT s.number, s.created_at, s.status, s.total, u.name AS user_name, c.name AS customer, s.void_reason,
        (SELECT string_agg(si.qty || 'x ' || si.product_name, ', ') FROM sale_items si WHERE si.sale_id = s.id) AS items,
        (SELECT string_agg(pm.name || ' ' || sp.amount::int, ' + ') FROM sale_payments sp JOIN payment_methods pm ON pm.id = sp.payment_method_id WHERE sp.sale_id = s.id) AS payments
      FROM sales s JOIN users u ON u.id = s.user_id LEFT JOIN customers c ON c.id = s.customer_id
      WHERE (s.created_at AT TIME ZONE ${TZ})::date BETWEEN ${from}::date AND ${to}::date ORDER BY s.created_at`;
    out = csv(["N°", "Fecha y hora", "Estado", "Total", "Empleado", "Cliente (fiado)", "Productos", "Pagos", "Motivo anulación"],
      rows.map((r) => [r.number, dt(r.created_at), r.status, r.total, r.user_name, r.customer, r.items, r.payments, r.void_reason]));
  } else {
    const r = await reports(from, to);
    switch (section) {
      case "diario": {
        const methods = [...new Set(r.dailyMethods.map((m) => m.name as string))];
        out = csv(["Fecha", "Ventas", "Total", ...methods], r.daily.map((d) => [d.day, d.count, d.total,
          ...methods.map((m) => r.dailyMethods.find((x) => x.day === d.day && x.name === m)?.amount ?? 0)]));
        break;
      }
      case "productos":
        out = csv(["Producto", "Categoría", "Unidades", "Monto"], r.products.map((p) => [p.name, p.category, p.qty, p.amount]));
        break;
      case "horarios":
        out = csv(["Día", "Hora", "Ventas", "Monto"], r.heat.sort((a, b) => a.dow - b.dow || a.hour - b.hour)
          .map((h) => [DAYS[h.dow], `${h.hour}:00`, h.count, h.total]));
        break;
      case "turnos":
        out = csv(["Apertura", "Cierre", "Turno", "Responsable", "Ventas", "Total", "Caja inicial", "Efectivo esperado", "Efectivo contado", "Diferencia", "Obs."],
          r.shifts.map((s) => [dt(s.opened_at), dt(s.closed_at), s.shift_type_name, s.user_name, s.count, s.total, s.opening_cash, s.expected_cash, s.counted_cash, s.difference, s.notes]));
        break;
      case "anulaciones":
        out = csv(["N°", "Fecha", "Total", "Vendió", "Anuló", "Motivo"], r.voids.map((v) => [v.number, dt(v.created_at), v.total, v.user_name, v.voided_by_name, v.void_reason]));
        break;
      case "gastos": {
        const rows = await sql`SELECT e.date::text AS date, e.supplier, ec.name AS category, e.amount, pm.name AS pm, e.notes
          FROM expenses e LEFT JOIN expense_categories ec ON ec.id = e.category_id LEFT JOIN payment_methods pm ON pm.id = e.payment_method_id
          WHERE e.deleted_at IS NULL AND e.date BETWEEN ${from}::date AND ${to}::date ORDER BY e.date`;
        out = csv(["Fecha", "Proveedor", "Categoría", "Monto", "Medio de pago", "Observación"], rows.map((e) => [e.date, e.supplier, e.category, e.amount, e.pm, e.notes]));
        break;
      }
      case "fiados":
        out = csv(["Cliente", "Teléfono", "Saldo", "Deuda desde"], r.fiados.customers.map((c) => [c.name, c.phone, c.balance, dt(c.first_debt_at)]));
        break;
      default:
        throw new ApiError(400, "Sección inválida.");
    }
  }
  return new Response(out, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="hotdog369_${section}_${from}_a_${to}.csv"`,
    },
  });
});
