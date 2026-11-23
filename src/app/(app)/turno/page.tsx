"use client";
import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDownCircle, ArrowUpCircle, Lock } from "lucide-react";
import { useMe } from "@/components/me";
import { NoAccess } from "@/components/app-shell";
import { Button, Card, Field, Input, Loading, MoneyInput, PageTitle, Textarea, cx, useToast, Modal } from "@/components/ui";
import { ShiftReport, type ShiftSummary } from "@/components/shift-report";
import { api, fetcher } from "@/lib/client/fetcher";
import { ars, fmtTime } from "@/lib/format";

export default function TurnoPage() {
  const { can, mod } = useMe();
  const router = useRouter();
  const toast = useToast();
  const { data, mutate } = useSWR<{ shift: ShiftSummary | null; hours?: { enabled: boolean; clocked_in: boolean } }>("/api/shifts/current", fetcher, { refreshInterval: 15000 });
  const [clockOut, setClockOut] = useState(true);
  const [counted, setCounted] = useState("");
  const [notes, setNotes] = useState("");
  const [closing, setClosing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [mov, setMov] = useState<"ingreso" | "retiro" | null>(null);

  if (!can("turnos.operar")) return <NoAccess />;
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

  const diff = counted === "" ? null : Number(counted) - s.expected_cash;

  const close = async () => {
    setClosing(true);
    try {
      await api(`/api/shifts/${s.shift.id}/close`, { body: { counted_cash: Number(counted), notes, clock_out: !!data.hours?.clocked_in && clockOut } });
      toast("Turno cerrado");
      router.push(`/turnos/${s.shift.id}`);
    } catch (e) {
      toast((e as Error).message, "bad");
      setClosing(false);
    }
  };

  return (
    <div>
      <PageTitle title="Mi turno" subtitle={`Abierto a las ${fmtTime(s.shift.opened_at)} · ${s.totals.sales_count} ventas`}
        actions={can("caja.gestionar") && mod("caja") ? <>
          <Button variant="secondary" onClick={() => setMov("ingreso")}><ArrowDownCircle className="size-4 text-good" />Ingreso de caja</Button>
          <Button variant="secondary" onClick={() => setMov("retiro")}><ArrowUpCircle className="size-4 text-bad" />Retiro de caja</Button>
        </> : undefined} />
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <ShiftReport s={s} />
        <Card title="Cerrar turno · arqueo de caja">
          <div className="space-y-3">
            <div className="rounded-xl bg-surface-2 p-3">
              <div className="text-sm text-muted">Efectivo que debería haber en caja</div>
              <div className="text-3xl font-extrabold tabular-nums">{ars(s.expected_cash)}</div>
            </div>
            <Field label="Efectivo contado"><MoneyInput value={counted} onChange={setCounted} /></Field>
            {diff != null && (
              <div className={cx("rounded-xl p-3 text-center text-lg font-bold", diff === 0 ? "bg-good/10 text-good" : diff > 0 ? "bg-warn/10 text-warn" : "bg-bad/10 text-bad")}>
                {diff === 0 ? "Caja perfecta, sin diferencia" : diff > 0 ? `Sobrante: ${ars(diff)}` : `Faltante: ${ars(-diff)}`}
              </div>
            )}
            <Field label="Observaciones (opcional)"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} /></Field>
            {data.hours?.clocked_in && (
              <label className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-3 font-semibold">Fichar mi salida al cerrar<input type="checkbox" className="size-5" checked={clockOut} onChange={(e) => setClockOut(e.target.checked)} /></label>
            )}
            <Button size="lg" className="w-full" disabled={counted === ""} onClick={() => setConfirm(true)}>Cerrar turno</Button>
          </div>
        </Card>
      </div>
      <Modal open={confirm} onClose={() => setConfirm(false)} title="¿Cerrar el turno?"
        footer={<div className="flex gap-2"><Button variant="secondary" className="flex-1" onClick={() => setConfirm(false)}>Volver</Button><Button className="flex-1" loading={closing} onClick={close}>Sí, cerrar</Button></div>}>
        <p>Después de cerrar no vas a poder cargar más ventas en este turno. Se va a generar el reporte de cierre para imprimir o compartir.</p>
      </Modal>
      <CashMovementModal type={mov} onClose={() => setMov(null)} onDone={() => mutate()} />
    </div>
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
