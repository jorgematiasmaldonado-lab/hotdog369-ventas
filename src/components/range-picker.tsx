"use client";
import { useState } from "react";
import { cx, Input } from "./ui";
import { localDate } from "@/lib/dates";

export type Range = { range: string; from?: string; to?: string };
const OPTS = [["hoy", "Hoy"], ["ayer", "Ayer"], ["semana", "Esta semana"], ["mes", "Este mes"], ["personalizado", "Elegir fechas"]] as const;

export function RangePicker({ value, onChange, className }: { value: Range; onChange: (r: Range) => void; className?: string }) {
  const [from, setFrom] = useState(value.from ?? localDate());
  const [to, setTo] = useState(value.to ?? localDate());
  return (
    <div className={cx("mb-4 no-print", className)}>
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
        {OPTS.map(([k, label]) => (
          <button key={k} onClick={() => onChange(k === "personalizado" ? { range: k, from, to } : { range: k })}
            className={cx("whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold transition",
              value.range === k ? "bg-brand-black text-white dark:bg-white dark:text-brand-black" : "border border-border bg-surface text-text-2")}>
            {label}
          </button>
        ))}
      </div>
      {value.range === "personalizado" && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Input type="date" className="w-auto" value={from} max={to} onChange={(e) => { setFrom(e.target.value); onChange({ range: "personalizado", from: e.target.value, to }); }} />
          <span className="text-muted">a</span>
          <Input type="date" className="w-auto" value={to} min={from} onChange={(e) => { setTo(e.target.value); onChange({ range: "personalizado", from, to: e.target.value }); }} />
        </div>
      )}
    </div>
  );
}
