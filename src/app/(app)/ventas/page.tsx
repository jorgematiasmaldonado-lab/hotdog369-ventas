"use client";
import { useState } from "react";
import useSWR from "swr";
import { Download, Pencil, Ban, Search, WifiOff } from "lucide-react";
import { useMe } from "@/components/me";
import { NoAccess } from "@/components/app-shell";
import { Badge, Button, Card, Empty, Input, Loading, PageTitle, Select, cx } from "@/components/ui";
import { RangePicker, type Range } from "@/components/range-picker";
import { VoidModal } from "@/components/void-modal";
import { EditSaleModal } from "@/components/edit-sale-modal";
import { fetcher, qs } from "@/lib/client/fetcher";
import type { Catalog, SaleRow } from "@/lib/client/types";
import { ars, fmtDateTime } from "@/lib/format";

export default function VentasPage() {
  const { can } = useMe();
  const [range, setRange] = useState<Range>({ range: "hoy" });
  const [status, setStatus] = useState("");
  const [pm, setPm] = useState("");
  const [q, setQ] = useState("");
  const { data: catalog } = useSWR<Catalog>("/api/catalog", fetcher);
  const { data, mutate } = useSWR<{ sales: SaleRow[] }>(`/api/sales${qs({ ...range, status, payment_method_id: pm, q, limit: 500 })}`, fetcher, { refreshInterval: 10000, keepPreviousData: true });
  const [voiding, setVoiding] = useState<SaleRow | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  if (!can("ventas.ver_todas")) return <NoAccess />;

  const sales = data?.sales ?? [];
  const ok = sales.filter((s) => s.status === "confirmada");
  const total = ok.reduce((a, s) => a + s.total, 0);
  const admin = can("ventas.editar");

  return (
    <div>
      <PageTitle title="Ventas" subtitle={`${ok.length} confirmadas · ${ars(total)}${sales.length - ok.length ? ` · ${sales.length - ok.length} anuladas` : ""}`}
        actions={can("reportes.ver") && <a href={`/api/reports/export${qs({ section: "ventas", ...range })}`}><Button variant="secondary"><Download className="size-4" />Excel (CSV)</Button></a>} />
      <RangePicker value={range} onChange={setRange} />
      <div className="mb-4 grid gap-2 sm:grid-cols-3 no-print">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input className="pl-9" placeholder="N°, producto o cliente" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos los estados</option><option value="confirmada">Confirmadas</option><option value="anulada">Anuladas</option>
        </Select>
        <Select value={pm} onChange={(e) => setPm(e.target.value)}>
          <option value="">Todos los medios de pago</option>
          {catalog?.paymentMethods.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </Select>
      </div>
      {!data ? <Loading /> : !sales.length ? <Card><Empty>No hay ventas con esos filtros.</Empty></Card> : (
        <Card className="overflow-hidden">
          <div className="-m-4 divide-y divide-border">
            {sales.map((s) => (
              <div key={s.id} className={cx("px-4 py-3", s.status === "anulada" && "bg-bad/5")}>
                <button className="flex w-full items-center gap-3 text-left" onClick={() => setOpen(open === s.id ? null : s.id)}>
                  <div className="w-24 shrink-0 text-xs text-muted"><div className="text-sm font-bold text-text">#{s.number}</div>{fmtDateTime(s.created_at)}</div>
                  <div className="min-w-0 flex-1 text-sm">
                    <div className="truncate">{s.items?.map((i) => `${i.qty}× ${i.name}`).join(", ")}</div>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                      <span>{s.user_name}</span>·<span>{s.payments?.map((p) => p.name).join(" + ")}</span>
                      {s.customer_name && <Badge tone="warn">Fiado: {s.customer_name}</Badge>}
                      {s.status === "anulada" && <Badge tone="bad">Anulada</Badge>}
                      {s.edited_at && <Badge tone="accent">Editada</Badge>}
                      {s.offline && <Badge><WifiOff className="size-3" />Sin conexión</Badge>}
                    </div>
                  </div>
                  <div className={cx("text-right font-extrabold tabular-nums", s.status === "anulada" && "line-through text-muted")}>{ars(s.total)}</div>
                </button>
                {open === s.id && (
                  <div className="mt-3 rounded-xl bg-surface-2 p-3 text-sm">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>{s.items?.map((i, k) => <div key={k} className="flex justify-between"><span>{i.qty}× {i.name}</span><span className="tabular-nums">{ars(i.subtotal)}</span></div>)}</div>
                      <div>
                        {s.payments?.map((p, k) => <div key={k} className="flex justify-between"><span>{p.name}</span><span className="tabular-nums">{ars(p.amount)}</span></div>)}
                        {s.cash_received != null && <div className="flex justify-between text-muted"><span>Pagó con / vuelto</span><span>{ars(s.cash_received)} / {ars(s.change_given)}</span></div>}
                      </div>
                    </div>
                    {s.status === "anulada" && <div className="mt-2 text-bad">Anulada por {s.voided_by_name} el {fmtDateTime(s.voided_at!)} · Motivo: <b>{s.void_reason}</b></div>}
                    {admin && s.status === "confirmada" && (
                      <div className="mt-3 flex gap-2">
                        <Button size="sm" variant="secondary" onClick={() => setEditing(s.id)}><Pencil className="size-4" />Editar</Button>
                        <Button size="sm" variant="secondary" onClick={() => setVoiding(s)}><Ban className="size-4" />Anular</Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
      <VoidModal sale={voiding} onClose={() => setVoiding(null)} onDone={() => mutate()} />
      <EditSaleModal saleId={editing} onClose={() => setEditing(null)} onDone={() => mutate()} />
    </div>
  );
}
