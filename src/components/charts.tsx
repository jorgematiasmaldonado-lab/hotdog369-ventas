"use client";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ars, int } from "@/lib/format";
import { cx } from "./ui";

const axis = { fontSize: 11, fill: "var(--muted)" };

function Tip({ active, payload, label, labelFmt }: { active?: boolean; payload?: { payload: { total: number; count?: number } }[]; label?: string | number; labelFmt?: (l: string | number) => string }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-lg">
      <div className="font-semibold text-text">{labelFmt ? labelFmt(label!) : label}</div>
      <div className="text-text-2">{ars(p.total)}{p.count != null && ` · ${int(p.count)} ventas`}</div>
    </div>
  );
}

/** Barras de una sola serie (monto vendido) */
export function SalesBars({ data, x, labelFmt, height = 220 }: { data: ({ total: number; count?: number } & Record<string, unknown>)[]; x: string; labelFmt?: (l: string | number) => string; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }} barCategoryGap="20%">
        <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
        <XAxis dataKey={x} tick={axis} tickLine={false} axisLine={false} tickFormatter={labelFmt} interval="preserveStartEnd" />
        <YAxis tick={axis} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
        <Tooltip cursor={{ fill: "var(--surface-2)" }} content={<Tip labelFmt={labelFmt} />} />
        <Bar dataKey="total" fill="var(--chart-bar)" radius={[4, 4, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Lista de barras horizontales con etiqueta (medios de pago, productos) */
export function BarList({ items, value = "amount", fmt = ars, colorKey }: { items: Record<string, unknown>[]; value?: string; fmt?: (n: number) => string; colorKey?: string }) {
  const max = Math.max(1, ...items.map((i) => Number(i[value]) || 0));
  return (
    <div className="space-y-2">
      {items.map((i, idx) => (
        <div key={idx}>
          <div className="mb-0.5 flex justify-between gap-2 text-sm">
            <span className="flex min-w-0 items-center gap-1.5 truncate text-text">
              {colorKey && <span className="size-2.5 shrink-0 rounded-full" style={{ background: String(i[colorKey]) }} />}
              {String(i.name)}
            </span>
            <span className="font-semibold tabular-nums text-text">{fmt(Number(i[value]))}</span>
          </div>
          <div className="h-2 rounded-full bg-surface-2">
            <div className="h-2 rounded-full bg-[var(--chart-bar)]" style={{ width: `${(Number(i[value]) / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Variación porcentual contra el período anterior */
export function Delta({ now, prev, className }: { now: number; prev: number; className?: string }) {
  if (!prev) return <span className={cx("text-xs opacity-80", className)}>sin datos previos</span>;
  const pct = ((now - prev) / prev) * 100;
  const up = pct >= 0;
  if (Math.abs(pct) < 0.5) return <span className={cx("text-xs font-bold", className)}>= igual que la semana anterior</span>;
  return <span className={cx("text-xs font-bold", className)}>{up ? "▲" : "▼"} {Math.abs(pct).toFixed(0)}% vs. semana anterior</span>;
}
