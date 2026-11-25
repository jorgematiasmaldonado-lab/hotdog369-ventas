"use client";
import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useMe } from "@/components/me";
import { NoAccess } from "@/components/app-shell";
import { Badge, Button, Card, Empty, Loading, PageTitle, cx } from "@/components/ui";
import { NextOpeningCard, OpeningModal } from "@/components/opening-cash";
import { RangePicker, type Range } from "@/components/range-picker";
import { fetcher, qs } from "@/lib/client/fetcher";
import { ars, fmtDateTime } from "@/lib/format";

type Row = { id: number; status: string; opened_at: string; closed_at: string | null; opening_cash: number; opening_pending?: boolean; declared_total?: number | null; expected_total?: number | null; expected_cash: number | null; counted_cash: number | null; difference: number | null; user_name: string; shift_type_name: string | null; sales_total: number; sales_count: number };

export default function TurnosPage() {
  const { can } = useMe();
  const [range, setRange] = useState<Range>({ range: "semana" });
  const [edit, setEdit] = useState<Row | null>(null);
  const { data, mutate } = useSWR<Row[]>(`/api/shifts${qs(range)}`, fetcher, { refreshInterval: 30000 });
  const admin = can("caja.gestionar");
  if (!can("turnos.ver_todos")) return <NoAccess />;
  return (
    <div>
      <PageTitle title="Turnos y arqueos" subtitle="Cada turno con su total y la diferencia de caja al cerrar" />
      {admin && <NextOpeningCard />}
      <RangePicker value={range} onChange={setRange} />
      {!data ? <Loading /> : !data.length ? <Card><Empty>No hay turnos en este período.</Empty></Card> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.map((s) => (
            <Link key={s.id} href={`/turnos/${s.id}`} className="rounded-2xl border border-border bg-surface p-4 shadow-sm transition hover:border-primary">
              <div className="mb-2 flex items-center justify-between">
                <div className="font-bold">{s.shift_type_name ?? "Turno"} · {s.user_name}</div>
                <Badge tone={s.status === "abierto" ? "good" : "neutral"}>{s.status === "abierto" ? "Abierto" : "Cerrado"}</Badge>
              </div>
              <div className="text-xs text-muted">{fmtDateTime(s.opened_at)}{s.closed_at && ` → ${fmtDateTime(s.closed_at)}`}</div>
              {s.opening_pending && (
                <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-warn/10 px-2 py-1.5 text-xs font-semibold text-warn">
                  Caja inicial pendiente
                  {admin && <Button size="sm" variant="secondary" onClick={(e) => { e.preventDefault(); setEdit(s); }}>Cargar</Button>}
                </div>
              )}
              <div className="mt-2 flex items-end justify-between">
                <div><div className="text-xs text-muted">{s.sales_count} ventas</div><div className="text-2xl font-extrabold tabular-nums">{ars(s.sales_total)}</div></div>
                {(() => {
                  // Resultado del arqueo de efectivo (lo que contó el empleado contra lo que debería haber)
                  const d = s.difference == null ? null : Number(s.difference);
                  return d != null && (
                    <div className={cx("text-right text-sm font-bold", d < 0 ? "text-bad" : d > 0 ? "text-warn" : "text-good")}>
                      {d === 0 ? "Caja OK" : `${d > 0 ? "Sobrante" : "Faltante"} ${ars(Math.abs(d))}`}
                      {s.counted_cash != null && <div className="text-xs font-normal text-muted">Efectivo contado {ars(s.counted_cash)}</div>}
                    </div>
                  );
                })()}
              </div>
            </Link>
          ))}
        </div>
      )}
      <OpeningModal shift={edit} onClose={() => setEdit(null)} onDone={() => mutate()} />
    </div>
  );
}
