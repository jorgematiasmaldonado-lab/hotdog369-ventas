"use client";
import Image from "next/image";
import { ars, fmtDateTime } from "@/lib/format";
import { cx } from "./ui";

export type ShiftSummary = {
  shift: { id: number; status: string; opened_at: string; closed_at: string | null; opening_cash: number; expected_cash: number | null; counted_cash: number | null; difference: number | null; notes: string | null; user_name: string; shift_type_name: string | null;
    opening_pending?: boolean; opening_confirmed?: boolean | null; opening_note?: string | null;
    declared?: Record<string, number> | null; expected?: Record<string, number> | null; declared_total?: number | null; expected_total?: number | null };
  totals: { sales_count: number; sales_total: number; voided_count: number; voided_total: number };
  byMethod: { id: number; name: string; kind: string; color: string; amount: number }[];
  collections: { id: number; name: string; kind: string; amount: number }[];
  cash: { ingresos: number; retiros: number };
  items: { product_name: string; category_name: string | null; qty: number; amount: number }[];
  cashSales: number;
  cashCollections: number;
  expected_cash: number;
  expected?: { id: number; name: string; kind: string; amount: number }[];
  expected_total?: number;
  methods?: { id: number; name: string; kind: string }[];
};

export type ArqueoLine = { id: number; name: string; expected: number; declared: number | null; diff: number | null };

/** Arqueo por medio de pago: lo que debería haber, lo declarado por el empleado y la diferencia */
export function arqueo(s: ShiftSummary): { lines: ArqueoLine[]; expected: number; declared: number | null; diff: number | null } | null {
  const sh = s.shift;
  const live = s.expected ?? [];
  const exp = sh.status === "cerrado" && sh.expected ? sh.expected : Object.fromEntries(live.map((m) => [m.id, m.amount]));
  const names = new Map((s.methods ?? live).map((m) => [String(m.id), m.name]));
  const ids = [...new Set([...Object.keys(exp), ...Object.keys(sh.declared ?? {})])];
  if (!ids.length) return null;
  const lines = ids.map((k) => {
    const e = Number(exp[k] ?? 0);
    const d = sh.declared ? Number(sh.declared[k] ?? 0) : null;
    return { id: Number(k), name: names.get(k) ?? `Medio ${k}`, expected: e, declared: d, diff: d == null ? null : Math.round((d - e) * 100) / 100 };
  });
  const expected = sh.status === "cerrado" && sh.expected_total != null ? Number(sh.expected_total) : lines.reduce((a, l) => a + l.expected, 0);
  const declared = sh.declared ? (sh.declared_total != null ? Number(sh.declared_total) : lines.reduce((a, l) => a + (l.declared ?? 0), 0)) : null;
  return { lines, expected, declared, diff: declared == null ? null : Math.round((declared - expected) * 100) / 100 };
}

export const diffText = (d: number) => (d === 0 ? "Sin diferencia" : `${d > 0 ? "Sobrante" : "Faltante"} ${ars(Math.abs(d))}`);
export const diffTone = (d: number) => (d < 0 ? "text-bad" : d > 0 ? "text-warn" : "text-good");

/** Reporte de cierre de turno: equivalente digital de la planilla en papel */
export function ShiftReport({ s }: { s: ShiftSummary }) {
  const sh = s.shift;
  const cats = [...new Set(s.items.map((i) => i.category_name ?? "Otros"))];
  const transfer = s.byMethod.filter((m) => m.kind === "transferencia").reduce((a, m) => a + m.amount, 0);
  const others = s.byMethod.filter((m) => m.kind === "otro").reduce((a, m) => a + m.amount, 0);
  const fiado = s.byMethod.filter((m) => m.kind === "fiado").reduce((a, m) => a + m.amount, 0);
  const expected = sh.status === "cerrado" ? sh.expected_cash ?? s.expected_cash : s.expected_cash;
  const aq = arqueo(s);
  return (
    <div className="print-area rounded-2xl border border-border bg-surface p-4 text-sm print:text-black">
      <div className="mb-4 flex items-center gap-3 rounded-xl bg-brand-black p-3 text-white">
        <Image src="/brand/logo-hotdog369.png" alt="" width={56} height={56} />
        <div className="flex-1">
          <div className="font-display text-xl tracking-wide">HOT DOG 369 · CIERRE DE TURNO</div>
          <div className="text-xs text-white/75">
            Turno {sh.shift_type_name ?? "-"} · Responsable: {sh.user_name} · {fmtDateTime(sh.opened_at)} → {sh.closed_at ? fmtDateTime(sh.closed_at) : "abierto"}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          {cats.map((c) => (
            <table key={c} className="mb-3 w-full">
              <thead><tr className="border-b-2 border-brand-red text-left"><th className="py-1 uppercase">{c}</th><th className="w-12 text-right">Cant.</th><th className="w-24 text-right">Importe</th></tr></thead>
              <tbody>
                {s.items.filter((i) => (i.category_name ?? "Otros") === c).map((i) => (
                  <tr key={i.product_name} className="border-b border-border"><td className="py-1">{i.product_name}</td><td className="text-right tabular-nums">{i.qty}</td><td className="text-right tabular-nums">{ars(i.amount)}</td></tr>
                ))}
              </tbody>
            </table>
          ))}
          {!s.items.length && <div className="text-muted">Sin ventas en el turno.</div>}
        </div>
        <div className="space-y-1.5">
          {s.byMethod.map((m) => <Row key={m.id} label={`Ventas en ${m.name}`} value={ars(m.amount)} />)}
          {s.collections.map((m) => <Row key={"c" + m.id} label={`Cobros de fiado (${m.name})`} value={ars(m.amount)} />)}
          <Row label="Ventas confirmadas" value={`${s.totals.sales_count}`} />
          <Row label="Anuladas" value={`${s.totals.voided_count} · ${ars(s.totals.voided_total)}`} />
          <div className="my-2 border-t border-border" />
          <Row label="Efectivo inicial" value={sh.opening_pending ? <span className="text-warn">Pendiente</span> : ars(sh.opening_cash)} />
          {sh.opening_confirmed === true && <div className="text-xs text-good">✓ El responsable confirmó la caja inicial</div>}
          {sh.opening_note && <div className="rounded-lg bg-warn/10 p-2 text-xs">Obs. al abrir: {sh.opening_note}</div>}
          <Row label="+ Ventas en efectivo" value={ars(s.cashSales)} />
          {s.cashCollections > 0 && <Row label="+ Cobros de fiado en efectivo" value={ars(s.cashCollections)} />}
          {s.cash.ingresos > 0 && <Row label="+ Ingresos de caja" value={ars(s.cash.ingresos)} />}
          {s.cash.retiros > 0 && <Row label="− Retiros de caja" value={ars(s.cash.retiros)} />}
          <Row label="Efectivo esperado" value={ars(expected)} bold />
          {!sh.declared && sh.counted_cash != null && <Row label="Efectivo contado" value={ars(sh.counted_cash)} bold />}
          {!sh.declared && sh.difference != null && (
            <Row label="Diferencia" bold value={<span className={cx(sh.difference < 0 ? "text-bad" : sh.difference > 0 ? "text-warn" : "text-good")}>
              {sh.difference === 0 ? "Sin diferencia" : `${sh.difference > 0 ? "Sobrante" : "Faltante"} ${ars(Math.abs(sh.difference))}`}</span>} />
          )}
          {sh.notes && <div className="mt-2 rounded-lg bg-surface-2 p-2 text-xs">Obs.: {sh.notes}</div>}
        </div>
      </div>

      {aq && (sh.declared || sh.status === "abierto") && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[420px]">
            <thead><tr className="border-b-2 border-brand-red text-left">
              <th className="py-1 uppercase">Arqueo</th><th className="text-right">Debería haber</th><th className="text-right">Declaró</th><th className="text-right">Diferencia</th>
            </tr></thead>
            <tbody>
              {aq.lines.map((l) => (
                <tr key={l.id} className="border-b border-border">
                  <td className="py-1">{l.name}</td>
                  <td className="text-right tabular-nums">{ars(l.expected)}</td>
                  <td className="text-right tabular-nums">{l.declared == null ? "—" : ars(l.declared)}</td>
                  <td className={cx("text-right font-semibold tabular-nums", l.diff != null && diffTone(l.diff))}>{l.diff == null ? "—" : diffText(l.diff)}</td>
                </tr>
              ))}
              <tr className="font-bold">
                <td className="py-1.5">Total</td>
                <td className="text-right tabular-nums">{ars(aq.expected)}</td>
                <td className="text-right tabular-nums">{aq.declared == null ? "—" : ars(aq.declared)}</td>
                <td className={cx("text-right tabular-nums", aq.diff != null && diffTone(aq.diff))}>{aq.diff == null ? "—" : diffText(aq.diff)}</td>
              </tr>
            </tbody>
          </table>
          {sh.opening_pending && <div className="mt-1 text-xs text-warn">La caja inicial está pendiente: el arqueo de efectivo se recalcula cuando el administrador la cargue.</div>}
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Box label="Efectivo" value={ars(s.cashSales)} />
        <Box label="Transferencia" value={ars(transfer)} />
        <Box label={fiado ? "Otros / Fiado" : "Otros medios"} value={ars(others + fiado)} />
        <Box label="Total del turno" value={ars(s.totals.sales_total)} strong />
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: React.ReactNode; bold?: boolean }) {
  return <div className={cx("flex justify-between gap-2", bold && "font-bold")}><span className="text-text-2">{label}</span><span className="tabular-nums">{value}</span></div>;
}
function Box({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cx("rounded-xl p-3", strong ? "bg-brand-red text-white" : "bg-accent text-brand-black")}>
      <div className="text-[11px] font-bold uppercase">{label}</div>
      <div className="text-lg font-extrabold tabular-nums">{value}</div>
    </div>
  );
}

export function shiftWhatsappText(s: ShiftSummary) {
  const sh = s.shift;
  const lines = [
    `*HOT DOG 369 · Cierre de turno*`,
    `Turno ${sh.shift_type_name ?? ""} · ${sh.user_name}`,
    `${fmtDateTime(sh.opened_at)} → ${sh.closed_at ? fmtDateTime(sh.closed_at) : "abierto"}`,
    ``,
    ...s.byMethod.map((m) => `${m.name}: ${ars(m.amount)}`),
    `*TOTAL DEL TURNO: ${ars(s.totals.sales_total)}* (${s.totals.sales_count} ventas)`,
    s.totals.voided_count ? `Anuladas: ${s.totals.voided_count} (${ars(s.totals.voided_total)})` : "",
    ...whatsArqueo(s),
    ``,
    `*Productos*`,
    ...s.items.map((i) => `${i.qty} × ${i.product_name}`),
  ];
  return lines.filter((l, i, a) => l !== "" || a[i - 1] !== "").join("\n");
}

function whatsArqueo(s: ShiftSummary) {
  const sh = s.shift;
  if (!sh.declared) return [sh.difference != null ? `Arqueo: esperado ${ars(sh.expected_cash)} · contado ${ars(sh.counted_cash)} · diferencia ${ars(sh.difference)}` : ""];
  const aq = arqueo(s)!;
  return ["", "*Arqueo (debería / declaró)*", ...aq.lines.map((l) => `${l.name}: ${ars(l.expected)} / ${ars(l.declared ?? 0)}${l.diff ? ` (${diffText(l.diff)})` : ""}`),
    `*Total: ${ars(aq.expected)} / ${ars(aq.declared ?? 0)} → ${diffText(aq.diff ?? 0)}*`, sh.opening_pending ? "⚠ Caja inicial pendiente" : ""];
}
