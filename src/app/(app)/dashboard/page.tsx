"use client";
import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { Banknote, Landmark, CreditCard, UserRound, Ban, Receipt, TrendingUp, Clock, RefreshCw, AlertTriangle } from "lucide-react";
import { useMe } from "@/components/me";
import { NoAccess } from "@/components/app-shell";
import { Card, Empty, Loading, PageTitle, Stat, cx } from "@/components/ui";
import { RangePicker, type Range } from "@/components/range-picker";
import { SalesBars, BarList, Delta } from "@/components/charts";
import { PushInvite } from "@/components/push-setup";
import { fetcher, qs } from "@/lib/client/fetcher";
import { ars, fmtDate, fmtTime, int } from "@/lib/format";

type K = { count: number; total: number; avg_ticket: number; efectivo: number; transferencia: number; otros: number; fiado: number; voided_count: number; voided_total: number; methods: { name: string; color: string; amount: number }[] };
type D = {
  from: string; to: string; current: K; previous: K;
  hourly: { hour: number; count: number; total: number }[];
  daily: { day: string; count: number; total: number }[];
  top: { name: string; qty: number; amount: number }[];
  openShifts: { id: number; opened_at: string; user_name: string; shift_type_name: string | null; total: number; count: number }[];
  fiadoPending: number;
  recent: { id: string; number: number; created_at: string; total: number; status: string; user_name: string; methods: string; detail: string }[];
};

export default function Dashboard() {
  const { can, mod, me } = useMe();
  const [range, setRange] = useState<Range>({ range: "hoy" });
  const { data, isValidating } = useSWR<D>(`/api/dashboard${qs(range)}`, fetcher, { refreshInterval: 5000, keepPreviousData: true });
  const showStock = mod("stock") && can("stock.ver", "stock.gestionar");
  const { data: stock } = useSWR<{ id: number; name: string; unit: string; quantity: number; min_quantity: number; low: boolean }[]>(showStock ? "/api/stock" : null, fetcher, { refreshInterval: 60000 });
  const lowStock = (stock ?? []).filter((i) => i.low);
  if (!can("dashboard.ver")) return <NoAccess />;
  const c = data?.current;
  const multiDay = data && data.from !== data.to;
  const hours = data ? fillHours(data.hourly) : [];

  return (
    <div>
      <PageTitle title="Panel de ventas" subtitle={
        <span className="inline-flex items-center gap-1.5">
          <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-good opacity-75" /><span className="relative inline-flex size-2 rounded-full bg-good" /></span>
          En vivo · se actualiza solo {isValidating && <RefreshCw className="size-3 animate-spin" />}
        </span>} />
      {showStock && me?.schema_ok && <PushInvite />}
      <RangePicker value={range} onChange={setRange} />
      {!data || !c ? <Loading /> : (
        <div className="space-y-4">
          {lowStock.length > 0 && (
            <Link href="/stock" className="flex flex-wrap items-center gap-2 rounded-2xl border border-bad/40 bg-bad/10 p-3 text-sm text-bad">
              <AlertTriangle className="size-5 shrink-0" />
              <b>Stock bajo:</b>
              <span className="min-w-0 flex-1">{lowStock.slice(0, 6).map((i) => `${i.name} (${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(i.quantity)} ${i.unit})`).join(" · ")}{lowStock.length > 6 && ` y ${lowStock.length - 6} más`}</span>
              <span className="font-semibold underline">Ver stock</span>
            </Link>
          )}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="col-span-2 rounded-2xl bg-primary p-5 text-white shadow-sm">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide opacity-90"><TrendingUp className="size-4" />Vendido {range.range === "hoy" ? "hoy" : `del ${fmtDate(data.from)} al ${fmtDate(data.to)}`}</div>
              <div className="mt-1 text-4xl font-extrabold tabular-nums sm:text-5xl">{ars(c.total)}</div>
              <Delta now={c.total} prev={data.previous.total} className="text-white" />
            </div>
            <Stat label="Ventas" value={int(c.count)} icon={<Receipt className="size-3.5" />} sub={<Delta now={c.count} prev={data.previous.count} />} />
            <Stat label="Ticket promedio" value={ars(c.avg_ticket)} icon={<Receipt className="size-3.5" />} />
            <Stat label="Efectivo" value={ars(c.efectivo)} icon={<Banknote className="size-3.5" />} tone="accent" />
            <Stat label="Transferencia" value={ars(c.transferencia)} icon={<Landmark className="size-3.5" />} />
            <Stat label="Otros medios" value={ars(c.otros)} icon={<CreditCard className="size-3.5" />} />
            {mod("fiados") && <Stat label="Fiado del período" value={ars(c.fiado)} icon={<UserRound className="size-3.5" />} sub={`Total adeudado: ${ars(data.fiadoPending)}`} />}
            <Stat label="Anulaciones" value={ars(c.voided_total)} icon={<Ban className="size-3.5" />} sub={`${c.voided_count} venta${c.voided_count === 1 ? "" : "s"} anulada${c.voided_count === 1 ? "" : "s"}`} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2" title={multiDay ? "Ventas por día" : "Ventas por hora"}>
              {c.count === 0 ? <Empty>Todavía no hay ventas.</Empty> : multiDay
                ? <SalesBars data={data.daily} x="day" labelFmt={(d) => fmtDate(String(d)).slice(0, 5)} />
                : <SalesBars data={hours} x="hour" labelFmt={(h) => `${h}h`} />}
            </Card>
            <Card title="Por medio de pago">
              {c.methods.length ? <BarList items={c.methods} colorKey="color" /> : <Empty>Sin datos.</Empty>}
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card title="Top 5 productos">
              {data.top.length ? <BarList items={data.top} value="qty" fmt={(n) => `${int(n)} u.`} /> : <Empty>Sin datos.</Empty>}
            </Card>
            <Card title="Turnos abiertos">
              {data.openShifts.length ? (
                <div className="space-y-2">
                  {data.openShifts.map((s) => (
                    <div key={s.id} className="flex items-center justify-between rounded-xl bg-surface-2 p-3">
                      <div>
                        <div className="font-semibold">{s.user_name}</div>
                        <div className="flex items-center gap-1 text-xs text-muted"><Clock className="size-3" />{s.shift_type_name ?? "Turno"} desde {fmtTime(s.opened_at)}</div>
                      </div>
                      <div className="text-right"><div className="font-bold tabular-nums">{ars(s.total)}</div><div className="text-xs text-muted">{s.count} ventas</div></div>
                    </div>
                  ))}
                </div>
              ) : <Empty>No hay nadie atendiendo ahora.</Empty>}
            </Card>
            <Card title="Últimas ventas" action={can("ventas.ver_todas") && <Link href="/ventas" className="text-sm font-semibold text-primary">Ver todas</Link>}>
              {data.recent.length ? (
                <div className="divide-y divide-border">
                  {data.recent.map((s) => (
                    <div key={s.id} className={cx("flex items-center gap-2 py-2 text-sm", s.status === "anulada" && "opacity-60")}>
                      <span className="w-12 text-xs text-muted">{fmtTime(s.created_at)}</span>
                      <div className="min-w-0 flex-1"><div className="truncate">{s.detail}</div><div className="truncate text-xs text-muted">{s.methods} · {s.user_name}</div></div>
                      <span className={cx("font-bold tabular-nums", s.status === "anulada" && "line-through")}>{ars(s.total)}</span>
                    </div>
                  ))}
                </div>
              ) : <Empty>Sin ventas.</Empty>}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function fillHours(h: { hour: number; count: number; total: number }[]) {
  if (!h.length) return [];
  const min = Math.min(...h.map((x) => x.hour)), max = Math.max(...h.map((x) => x.hour));
  return Array.from({ length: max - min + 1 }, (_, i) => h.find((x) => x.hour === min + i) ?? { hour: min + i, count: 0, total: 0 });
}
