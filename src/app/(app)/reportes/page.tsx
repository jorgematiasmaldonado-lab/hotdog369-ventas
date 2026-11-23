"use client";
import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { Download, Printer, AlertTriangle } from "lucide-react";
import { useMe } from "@/components/me";
import { NoAccess } from "@/components/app-shell";
import { Badge, Button, Card, Empty, Loading, PageTitle, Stat, Tabs, cx } from "@/components/ui";
import { RangePicker, type Range } from "@/components/range-picker";
import { SalesBars, BarList } from "@/components/charts";
import { fetcher, qs } from "@/lib/client/fetcher";
import { ars, fmtDate, fmtDateTime, int, DAYS, DAYS_SHORT } from "@/lib/format";

type Tab = "resumen" | "horarios" | "productos" | "turnos" | "anulaciones" | "resultado" | "fiados";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type R = any;

export default function ReportesPage() {
  const { can, mod } = useMe();
  const [range, setRange] = useState<Range>({ range: "mes" });
  const [tab, setTab] = useState<Tab>("resumen");
  const { data } = useSWR<R>(`/api/reports${qs(range)}`, fetcher, { keepPreviousData: true });
  if (!can("reportes.ver")) return <NoAccess />;

  const exportSection: Record<Tab, string> = { resumen: "diario", horarios: "horarios", productos: "productos", turnos: "turnos", anulaciones: "anulaciones", resultado: "gastos", fiados: "fiados" };
  const tabs: { value: Tab; label: string }[] = [
    { value: "resumen", label: "Resumen" }, { value: "horarios", label: "Días y horarios" }, { value: "productos", label: "Productos" },
    { value: "turnos", label: "Turnos y empleados" }, { value: "anulaciones", label: "Anulaciones" },
    ...(mod("gastos") ? [{ value: "resultado" as Tab, label: "Gastos vs. ingresos" }] : []),
    ...(mod("fiados") ? [{ value: "fiados" as Tab, label: "Fiados" }] : []),
  ];

  return (
    <div>
      <PageTitle title="Reportes" subtitle={data ? `Del ${fmtDate(data.from)} al ${fmtDate(data.to)}` : ""}
        actions={<>
          <a href={`/api/reports/export${qs({ section: exportSection[tab], ...range })}`}><Button variant="secondary"><Download className="size-4" />Excel (CSV)</Button></a>
          <Button variant="secondary" onClick={() => window.print()}><Printer className="size-4" />Imprimir / PDF</Button>
        </>} />
      <RangePicker value={range} onChange={setRange} />
      <Tabs className="mb-4 no-print" value={tab} onChange={setTab} items={tabs} />
      {!data ? <Loading /> : (
        <div className="space-y-4">
          {tab === "resumen" && <Resumen d={data} />}
          {tab === "horarios" && <Horarios d={data} />}
          {tab === "productos" && <Productos d={data} />}
          {tab === "turnos" && <Turnos d={data} />}
          {tab === "anulaciones" && <Anulaciones d={data} />}
          {tab === "resultado" && <Resultado d={data} />}
          {tab === "fiados" && <Fiados d={data} />}
        </div>
      )}
    </div>
  );
}

function Resumen({ d }: { d: R }) {
  const s = d.summary;
  const methods = [...new Set(d.dailyMethods.map((m: R) => m.name))] as string[];
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total vendido" value={ars(s.total)} tone="brand" />
        <Stat label="Ventas" value={int(s.count)} sub={`Ticket promedio ${ars(s.avg_ticket)}`} />
        <Stat label="Efectivo" value={ars(s.efectivo)} tone="accent" />
        <Stat label="Transferencia" value={ars(s.transferencia)} />
        <Stat label="Otros medios" value={ars(s.otros)} />
        <Stat label="Fiado" value={ars(s.fiado)} />
        <Stat label="Anuladas" value={`${s.voided_count} · ${ars(s.voided_total)}`} />
        <Stat label="Promedio por día" value={ars(d.daily.length ? s.total / d.daily.length : 0)} sub={`${d.daily.length} días con ventas`} />
      </div>
      <Card title="Ventas por día">{d.daily.length ? <SalesBars data={d.daily} x="day" labelFmt={(x) => fmtDate(String(x)).slice(0, 5)} /> : <Empty>Sin ventas.</Empty>}</Card>
      <Card title="Detalle diario por medio de pago" className="overflow-x-auto">
        {!d.daily.length ? <Empty>Sin ventas.</Empty> : (
          <table className="w-full min-w-[520px] text-sm">
            <thead><tr className="border-b border-border text-left text-xs uppercase text-muted"><th className="py-2">Fecha</th><th className="text-right">Ventas</th>{methods.map((m) => <th key={m} className="text-right">{m}</th>)}<th className="text-right">Total</th></tr></thead>
            <tbody>
              {d.daily.map((day: R) => (
                <tr key={day.day} className="border-b border-border">
                  <td className="py-1.5">{DAYS_SHORT[new Date(day.day + "T12:00:00Z").getUTCDay()]} {fmtDate(day.day)}</td>
                  <td className="text-right tabular-nums">{day.count}</td>
                  {methods.map((m) => <td key={m} className="text-right tabular-nums">{ars(d.dailyMethods.find((x: R) => x.day === day.day && x.name === m)?.amount ?? 0)}</td>)}
                  <td className="text-right font-bold tabular-nums">{ars(day.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}

function Horarios({ d }: { d: R }) {
  const heat: R[] = d.heat;
  if (!heat.length) return <Card><Empty>Sin ventas en el período.</Empty></Card>;
  const hours = heat.map((h) => h.hour);
  const minH = Math.min(...hours), maxH = Math.max(...hours);
  const max = Math.max(...heat.map((h) => h.count));
  const order = [1, 2, 3, 4, 5, 6, 0];
  const bestDays = [...d.dowAgg].filter((x: R) => x.count).sort((a: R, b: R) => b.total - a.total);
  const bestHours = [...d.hourAgg].sort((a: R, b: R) => b.count - a.count).slice(0, 5);
  return (
    <>
      <Card title="Mapa de calor: cantidad de ventas por día y hora">
        <div className="overflow-x-auto">
          <table className="border-separate border-spacing-[3px] text-xs">
            <thead><tr><th />{Array.from({ length: maxH - minH + 1 }, (_, i) => <th key={i} className="w-9 font-medium text-muted">{minH + i}h</th>)}</tr></thead>
            <tbody>
              {order.map((dow) => (
                <tr key={dow}>
                  <th className="pr-2 text-left font-semibold text-text-2">{DAYS_SHORT[dow]}</th>
                  {Array.from({ length: maxH - minH + 1 }, (_, i) => {
                    const c = heat.find((h) => h.dow === dow && h.hour === minH + i);
                    const t = c ? c.count / max : 0;
                    return (
                      <td key={i} title={`${DAYS[dow]} ${minH + i}:00 · ${c?.count ?? 0} ventas · ${ars(c?.total ?? 0)}`}
                        className={cx("h-8 w-9 rounded-md text-center font-semibold tabular-nums", t > 0.55 ? "text-white" : "text-text-2")}
                        style={{ background: c ? `color-mix(in oklab, var(--chart-bar) ${Math.round(12 + t * 88)}%, var(--surface-2))` : "var(--surface-2)" }}>
                        {c?.count ?? ""}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted">Más oscuro = más ventas. Pasá el dedo o el mouse sobre una celda para ver el monto.</p>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Días de la semana que más venden">
          <BarList items={bestDays.map((x: R) => ({ name: DAYS[x.dow], amount: x.total, count: x.count }))} />
        </Card>
        <Card title="Horarios con más ventas">
          <BarList items={bestHours.map((h: R) => ({ name: `${h.hour}:00 a ${h.hour + 1}:00`, qty: h.count }))} value="qty" fmt={(n) => `${int(n)} ventas`} />
        </Card>
      </div>
    </>
  );
}

function Productos({ d }: { d: R }) {
  const products: R[] = d.products;
  const least = [...products].sort((a, b) => a.qty - b.qty).slice(0, 5);
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Por categoría"><BarList items={d.categories} /></Card>
        <Card title="Menos vendidos">{least.length ? <BarList items={least} value="qty" fmt={(n) => `${int(n)} u.`} /> : <Empty>Sin datos.</Empty>}</Card>
      </div>
      <Card title="Ranking de productos" className="overflow-x-auto">
        {!products.length ? <Empty>Sin ventas.</Empty> : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-left text-xs uppercase text-muted"><th className="py-2">#</th><th>Producto</th><th>Categoría</th><th className="text-right">Unidades</th><th className="text-right">Monto</th></tr></thead>
            <tbody>{products.map((p, i) => (
              <tr key={p.name} className="border-b border-border"><td className="py-1.5 text-muted">{i + 1}</td><td className="font-semibold">{p.name}</td><td className="text-muted">{p.category}</td><td className="text-right tabular-nums">{p.qty}</td><td className="text-right tabular-nums">{ars(p.amount)}</td></tr>
            ))}</tbody>
          </table>
        )}
      </Card>
    </>
  );
}

function Turnos({ d }: { d: R }) {
  return (
    <>
      <Card title="Por empleado" className="overflow-x-auto">
        {!d.byUser.length ? <Empty>Sin datos.</Empty> : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-left text-xs uppercase text-muted"><th className="py-2">Empleado</th><th className="text-right">Ventas</th><th className="text-right">Total</th><th className="text-right">Anuladas</th><th className="text-right">% anulado</th></tr></thead>
            <tbody>{d.byUser.map((u: R) => {
              const pct = u.total + u.voided_total ? (u.voided_total / (u.total + u.voided_total)) * 100 : 0;
              return (
                <tr key={u.name} className="border-b border-border"><td className="py-1.5 font-semibold">{u.name}</td><td className="text-right tabular-nums">{u.count}</td><td className="text-right tabular-nums">{ars(u.total)}</td><td className="text-right tabular-nums">{u.voided_count} · {ars(u.voided_total)}</td>
                  <td className={cx("text-right font-semibold tabular-nums", pct > 10 && "text-bad")}>{pct.toFixed(1)}%</td></tr>
              );
            })}</tbody>
          </table>
        )}
      </Card>
      <Card title="Turnos y arqueos de caja" className="overflow-x-auto">
        {!d.shifts.length ? <Empty>Sin turnos.</Empty> : (
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="border-b border-border text-left text-xs uppercase text-muted"><th className="py-2">Apertura</th><th>Turno</th><th>Responsable</th><th className="text-right">Ventas</th><th className="text-right">Esperado</th><th className="text-right">Contado</th><th className="text-right">Diferencia</th></tr></thead>
            <tbody>{d.shifts.map((s: R) => (
              <tr key={s.id} className="border-b border-border">
                <td className="py-1.5"><Link href={`/turnos/${s.id}`} className="font-semibold text-primary">{fmtDateTime(s.opened_at)}</Link></td>
                <td>{s.shift_type_name}</td><td>{s.user_name}</td><td className="text-right tabular-nums">{ars(s.total)}</td>
                <td className="text-right tabular-nums">{s.expected_cash != null ? ars(s.expected_cash) : <Badge tone="good">Abierto</Badge>}</td>
                <td className="text-right tabular-nums">{s.counted_cash != null ? ars(s.counted_cash) : "—"}</td>
                <td className={cx("text-right font-bold tabular-nums", s.difference < 0 ? "text-bad" : s.difference > 0 ? "text-warn" : "text-good")}>{s.difference != null ? ars(s.difference) : "—"}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Card>
    </>
  );
}

function Anulaciones({ d }: { d: R }) {
  const s = d.summary;
  const pct = s.total + s.voided_total ? (s.voided_total / (s.total + s.voided_total)) * 100 : 0;
  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat label="Ventas anuladas" value={s.voided_count} />
        <Stat label="Monto anulado" value={ars(s.voided_total)} />
        <Stat label="% sobre lo vendido" value={`${pct.toFixed(1)}%`} icon={pct > 5 ? <AlertTriangle className="size-3.5 text-warn" /> : undefined} />
      </div>
      <Card title="Detalle">
        {!d.voids.length ? <Empty>No hubo anulaciones. ¡Bien!</Empty> : (
          <div className="divide-y divide-border">{d.voids.map((v: R) => (
            <div key={v.id} className="flex items-start gap-3 py-2.5 text-sm">
              <div className="w-28 text-xs text-muted"><div className="font-bold text-text">#{v.number}</div>{fmtDateTime(v.created_at)}</div>
              <div className="flex-1"><div className="font-semibold">“{v.void_reason}”</div><div className="text-xs text-muted">Vendió {v.user_name} · anuló {v.voided_by_name} {v.voided_at && `el ${fmtDateTime(v.voided_at)}`}</div></div>
              <div className="font-bold tabular-nums">{ars(v.total)}</div>
            </div>
          ))}</div>
        )}
      </Card>
    </>
  );
}

function Resultado({ d }: { d: R }) {
  const r = d.result;
  const days = [...new Set([...d.daily.map((x: R) => x.day), ...d.expenses.daily.map((x: R) => x.day)])].sort() as string[];
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Ingresos por ventas" value={ars(r.sales)} />
        <Stat label="Gastos" value={ars(r.expenses)} />
        <Stat label="Resultado bruto" value={ars(r.net)} tone={r.net >= 0 ? "brand" : undefined} sub="Ventas − gastos registrados" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Gastos por categoría">{d.expenses.byCategory.length ? <BarList items={d.expenses.byCategory} /> : <Empty>Sin gastos.</Empty>}</Card>
        <Card title="Día por día" className="overflow-x-auto">
          {!days.length ? <Empty>Sin movimientos.</Empty> : (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-left text-xs uppercase text-muted"><th className="py-2">Fecha</th><th className="text-right">Ventas</th><th className="text-right">Gastos</th><th className="text-right">Resultado</th></tr></thead>
              <tbody>{days.map((day) => {
                const v = d.daily.find((x: R) => x.day === day)?.total ?? 0;
                const g = d.expenses.daily.find((x: R) => x.day === day)?.amount ?? 0;
                return <tr key={day} className="border-b border-border"><td className="py-1.5">{fmtDate(day)}</td><td className="text-right tabular-nums">{ars(v)}</td><td className="text-right tabular-nums">{ars(g)}</td><td className={cx("text-right font-bold tabular-nums", v - g < 0 && "text-bad")}>{ars(v - g)}</td></tr>;
              })}</tbody>
            </table>
          )}
        </Card>
      </div>
    </>
  );
}

function Fiados({ d }: { d: R }) {
  const daily = d.fiados.daily.map((x: R) => ({ ...x, total: x.balance }));
  return (
    <>
      <Stat label="Total adeudado hoy" value={ars(d.fiados.total)} tone="brand" />
      <Card title="Evolución de la deuda total (fin de cada día)"><SalesBars data={daily} x="day" labelFmt={(x) => fmtDate(String(x)).slice(0, 5)} height={180} /></Card>
      <Card title="Clientes con deuda">
        {!d.fiados.customers.length ? <Empty>Nadie debe nada.</Empty> : (
          <div className="divide-y divide-border">{d.fiados.customers.map((c: R) => (
            <Link key={c.id} href={`/fiados/${c.id}`} className="flex justify-between py-2 text-sm"><span className="font-semibold">{c.name}</span><span className="font-bold tabular-nums text-bad">{ars(c.balance)}</span></Link>
          ))}</div>
        )}
      </Card>
    </>
  );
}

