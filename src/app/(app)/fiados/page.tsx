"use client";
import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { Search, UserPlus, AlertTriangle, ChevronRight } from "lucide-react";
import { useMe } from "@/components/me";
import { NoAccess } from "@/components/app-shell";
import { Badge, Button, Card, Empty, Field, Input, Loading, Modal, PageTitle, Stat, useToast } from "@/components/ui";
import { api, fetcher } from "@/lib/client/fetcher";
import type { Customer } from "@/lib/client/types";
import { ars, fmtDate } from "@/lib/format";

export default function FiadosPage() {
  const { can, mod, me } = useMe();
  const { data, mutate } = useSWR<Customer[]>("/api/customers", fetcher, { refreshInterval: 20000 });
  const [q, setQ] = useState("");
  const [onlyDebt, setOnlyDebt] = useState(true);
  const [creating, setCreating] = useState(false);
  if (!mod("fiados") || !can("fiados.ver", "fiados.gestionar")) return <NoAccess />;
  const alertDays = Number(me?.settings.fiado_alert_days ?? 15);
  const list = (data ?? []).filter((c) => (!onlyDebt || c.balance > 0) && c.name.toLowerCase().includes(q.toLowerCase()));
  const totalDebt = (data ?? []).reduce((a, c) => a + Math.max(0, c.balance), 0);
  const oldCount = (data ?? []).filter((c) => c.balance > 0 && isOld(c.first_debt_at, alertDays)).length;

  return (
    <div>
      <PageTitle title="Fiados" subtitle="Cuentas corrientes de clientes"
        actions={can("fiados.gestionar") && <Button onClick={() => setCreating(true)}><UserPlus className="size-4" />Nuevo cliente</Button>} />
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Total adeudado" value={ars(totalDebt)} tone="brand" />
        <Stat label="Clientes con deuda" value={(data ?? []).filter((c) => c.balance > 0).length} />
        <Stat label={`Deudas de +${alertDays} días`} value={oldCount} icon={oldCount ? <AlertTriangle className="size-3.5 text-warn" /> : undefined} />
      </div>
      <div className="mb-3 flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input className="pl-9" placeholder="Buscar cliente" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Button variant={onlyDebt ? "dark" : "secondary"} onClick={() => setOnlyDebt(!onlyDebt)}>{onlyDebt ? "Con deuda" : "Todos"}</Button>
      </div>
      {!data ? <Loading /> : !list.length ? <Card><Empty>No hay clientes {onlyDebt ? "con deuda" : ""}.</Empty></Card> : (
        <div className="space-y-2">
          {list.map((c) => (
            <Link key={c.id} href={`/fiados/${c.id}`} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm hover:border-primary">
              <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">{c.name.slice(0, 1).toUpperCase()}</div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{c.name}</div>
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                  {c.phone && <span>{c.phone}</span>}
                  {c.balance > 0 && c.first_debt_at && <span>debe desde {fmtDate(c.first_debt_at)}</span>}
                  {c.balance > 0 && isOld(c.first_debt_at, alertDays) && <Badge tone="warn"><AlertTriangle className="size-3" />+{alertDays} días</Badge>}
                </div>
              </div>
              <div className={c.balance > 0 ? "font-extrabold text-bad tabular-nums" : "text-sm text-muted"}>{c.balance > 0 ? ars(c.balance) : "Al día"}</div>
              <ChevronRight className="size-4 text-muted" />
            </Link>
          ))}
        </div>
      )}
      <NewCustomer open={creating} onClose={() => setCreating(false)} onDone={() => mutate()} />
    </div>
  );
}

const isOld = (d: string | null, days: number) => !!d && Date.now() - new Date(d).getTime() > days * 86400000;

function NewCustomer({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  return (
    <Modal open={open} onClose={onClose} title="Nuevo cliente"
      footer={<Button className="w-full" loading={loading} disabled={name.trim().length < 2} onClick={async () => {
        setLoading(true);
        try { await api("/api/customers", { body: { name, phone } }); toast("Cliente creado"); setName(""); setPhone(""); onDone(); onClose(); }
        catch (e) { toast((e as Error).message, "bad"); } finally { setLoading(false); }
      }}>Guardar</Button>}>
      <div className="space-y-3">
        <Field label="Nombre"><Input autoFocus value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Teléfono (opcional)"><Input inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}
