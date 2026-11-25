"use client";
import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDownCircle, ArrowUpCircle, CheckCircle2, Lock } from "lucide-react";
import { useMe } from "@/components/me";
import { NoAccess } from "@/components/app-shell";
import { Button, Card, Field, Input, Loading, MoneyInput, PageTitle, Textarea, cx, useToast, Modal } from "@/components/ui";
import { ShiftReport, type ShiftSummary } from "@/components/shift-report";
import { api, fetcher } from "@/lib/client/fetcher";
import { ars, fmtTime } from "@/lib/format";

type Blind = {
  blind: true;
  shift: { id: number; opened_at: string; shift_type_name: string | null; opening_cash: number; opening_pending: boolean };
  totals: { sales_count: number; voided_count: number };
  items: { product_name: string; category_name: string | null; qty: number }[];
  methods: { id: number; name: string; kind: string }[];
};
type Current = { shift: ShiftSummary | Blind | null; hours?: { enabled: boolean; clocked_in: boolean } };
const isBlind = (s: ShiftSummary | Blind): s is Blind => "blind" in s && s.blind === true;

export default function TurnoPage() {
  const { can, mod } = useMe();
  const router = useRouter();
  const toast = useToast();
  const { data, mutate } = useSWR<Current>("/api/shifts/current", fetcher, { refreshInterval: 15000 });
  const [clockOut, setClockOut] = useState(true);
  const [vals, setVals] = useState<Record<number, string>>({});
  const [notes, setNotes] = useState("");
  const [closing, setClosing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [closed, setClosed] = useState(false);
  const [mov, setMov] = useState<"ingreso" | "retiro" | null>(null);

  if (!can("turnos.operar")) return <NoAccess />;
  if (closed)
    return (
      <div className="mx-auto mt-10 max-w-md text-center">
        <CheckCircle2 className="mx-auto mb-2 size-14 text-good" />
        <h1 className="font-display text-3xl uppercase">Turno cerrado</h1>
        <p className="mb-4 text-muted">Gracias. El administrador va a revisar el arqueo de caja.</p>
        <Link href="/vender"><Button>Volver al inicio</Button></Link>
      </div>
    );
  if (!data) return <Loading />;
  const s = data.shift;
  if (!s)
    return (
      <div className="mx-auto mt-10 max-w-md text-center">
        <Lock className="mx-auto mb-2 size-10 text-muted" />
        <p className="mb-4 text-muted">No tenés un turno abierto.</p>
        <Link href="/vender"><Button>Ir a Vender y abrir turno</Button></Link>
      </div>
    );

  const blind = isBlind(s);
  const methods = (blind ? s.methods : s.methods ?? s.expected ?? []).filter((m) => m.kind !== "fiado");
  const expectedOf = (id: number) => (blind ? null : s.expected?.find((m) => m.id === id)?.amount ?? 0);
  const n = (id: number) => Number(vals[id] || 0);
  const total = methods.reduce((a, m) => a + n(m.id), 0);
  const filled = methods.length > 0 && methods.every((m) => vals[m.id] !== undefined && vals[m.id] !== "");
  const fullDiff = blind ? null : total - (s.expected_total ?? 0);

  const close = async () => {
    setClosing(true);
    try {
      await api(`/api/shifts/${s.shift.id}/close`, {
        body: { declared: Object.fromEntries(methods.map((m) => [m.id, n(m.id)])), notes, clock_out: !!data.hours?.clocked_in && clockOut },
      });
      toast("Turno cerrado");
      if (blind) { setConfirm(false); setClosed(true); } else router.push(`/turnos/${s.shift.id}`);
    } catch (e) {
      toast((e as Error).message, "bad");
      setClosing(false);
    }
  };

  const hint = (m: { kind: string }) =>
    m.kind === "efectivo" ? "Todo el efectivo de la caja, incluida la caja inicial"
      : m.kind === "transferencia" ? "Lo que figura recibido por transferencia en el turno" : "Lo que figura en el resumen del turno";

  return (
    <div>
      <PageTitle title="Mi turno" subtitle={`Abierto a las ${fmtTime(s.shift.opened_at)} · ${s.totals.sales_count} ventas`}
        actions={can("caja.gestionar") && mod("caja") ? <>
          <Button variant="secondary" onClick={() => setMov("ingreso")}><ArrowDownCircle className="size-4 text-good" />Ingreso de caja</Button>
          <Button variant="secondary" onClick={() => setMov("retiro")}><ArrowUpCircle className="size-4 text-bad" />Retiro de caja</Button>
        </> : undefined} />
      <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
        {blind ? <BlindInfo s={s} /> : <ShiftReport s={s} />}
        <Card title="Cerrar turno · arqueo de caja">
          <div className="space-y-3">
            <p className="text-sm text-muted">Contá y anotá cuánto hay en cada medio de pago. Si en alguno no hubo nada, poné 0.</p>
            {methods.map((m) => (
              <Field key={m.id} label={m.kind === "efectivo" ? `${m.name} en caja` : m.name} hint={hint(m)}>
                <MoneyInput value={vals[m.id] ?? ""} onChange={(v) => setVals({ ...vals, [m.id]: v })} />
                {!blind && <span className="mt-1 block text-xs text-muted">Debería haber: <b className="tabular-nums">{ars(expectedOf(m.id) ?? 0)}</b></span>}
              </Field>
            ))}
            <div className="rounded-xl bg-surface-2 p-3">
              <div className="text-sm text-muted">Total declarado</div>
              <div className="text-3xl font-extrabold tabular-nums">{ars(total)}</div>
            </div>
            {fullDiff != null && filled && (
              <div className={cx("rounded-xl p-3 text-center text-lg font-bold", fullDiff === 0 ? "bg-good/10 text-good" : fullDiff > 0 ? "bg-warn/10 text-warn" : "bg-bad/10 text-bad")}>
                {fullDiff === 0 ? "Caja perfecta, sin diferencia" : fullDiff > 0 ? `Sobrante: ${ars(fullDiff)}` : `Faltante: ${ars(-fullDiff)}`}
              </div>
            )}
            <Field label="Observaciones (opcional)"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} /></Field>
            {data.hours?.clocked_in && (
              <label className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-3 font-semibold">Fichar mi salida al cerrar<input type="checkbox" className="size-5" checked={clockOut} onChange={(e) => setClockOut(e.target.checked)} /></label>
            )}
            <Button size="lg" className="w-full" disabled={!filled} onClick={() => setConfirm(true)}>{filled ? "Cerrar turno" : "Completá todos los montos"}</Button>
          </div>
        </Card>
      </div>
      <Modal open={confirm} onClose={() => setConfirm(false)} title="¿Cerrar el turno?"
        footer={<div className="flex gap-2"><Button variant="secondary" className="flex-1" onClick={() => setConfirm(false)}>Volver</Button><Button className="flex-1" loading={closing} onClick={close}>Sí, cerrar</Button></div>}>
        <p>Vas a declarar un total de <b>{ars(total)}</b>. Después de cerrar no vas a poder cargar más ventas en este turno{blind ? " ni cambiar los montos" : ""}.</p>
      </Modal>
      <CashMovementModal type={mov} onClose={() => setMov(null)} onDone={() => mutate()} />
    </div>
  );
}

function BlindInfo({ s }: { s: Blind }) {
  return (
    <Card title={`Turno ${s.shift.shift_type_name ?? ""}`}>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-surface-2 p-3">
          <div className="text-xs font-semibold uppercase text-muted">Caja inicial</div>
          <div className="text-2xl font-extrabold tabular-nums">{s.shift.opening_pending ? <span className="text-base text-warn">Pendiente</span> : ars(s.shift.opening_cash)}</div>
        </div>
        <div className="rounded-xl bg-surface-2 p-3">
          <div className="text-xs font-semibold uppercase text-muted">Ventas</div>
          <div className="text-2xl font-extrabold tabular-nums">{s.totals.sales_count}</div>
          {s.totals.voided_count > 0 && <div className="text-xs text-muted">{s.totals.voided_count} anuladas</div>}
        </div>
      </div>
      <div className="mt-4">
        <div className="mb-1 text-sm font-semibold">Productos vendidos</div>
        {!s.items.length ? <div className="text-sm text-muted">Todavía no hay ventas.</div> : (
          <div className="divide-y divide-border text-sm">
            {s.items.map((i) => <div key={i.product_name} className="flex justify-between py-1.5"><span>{i.product_name}</span><b className="tabular-nums">{i.qty}</b></div>)}
          </div>
        )}
      </div>
    </Card>
  );
}

function CashMovementModal({ type, onClose, onDone }: { type: "ingreso" | "retiro" | null; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const save = async () => {
    setLoading(true);
    try {
      await api("/api/cash-movements", { body: { type, amount: Number(amount), reason } });
      toast(type === "ingreso" ? "Ingreso registrado" : "Retiro registrado");
      setAmount(""); setReason("");
      onDone(); onClose();
    } catch (e) {
      toast((e as Error).message, "bad");
    } finally {
      setLoading(false);
    }
  };
  return (
    <Modal open={!!type} onClose={onClose} title={type === "ingreso" ? "Ingreso de efectivo a la caja" : "Retiro de efectivo de la caja"}
      footer={<Button className="w-full" size="lg" loading={loading} disabled={!amount || reason.trim().length < 3} onClick={save}>Guardar</Button>}>
      <div className="space-y-3">
        <Field label="Monto"><MoneyInput value={amount} onChange={setAmount} autoFocus /></Field>
        <Field label="Motivo"><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={type === "ingreso" ? "ej: cambio" : "ej: pago a proveedor, retiro del dueño"} /></Field>
      </div>
    </Modal>
  );
}
