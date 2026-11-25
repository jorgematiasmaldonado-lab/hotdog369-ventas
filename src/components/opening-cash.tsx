"use client";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { Wallet } from "lucide-react";
import { Button, Card, Field, Modal, MoneyInput, useToast } from "./ui";
import { api, fetcher } from "@/lib/client/fetcher";
import { ars } from "@/lib/format";

/** Tarjeta del administrador: efectivo con el que arranca el próximo turno */
export function NextOpeningCard() {
  const { data, mutate } = useSWR<{ amount: number | null }>("/api/shifts/next-cash", fetcher);
  const [val, setVal] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  useEffect(() => { if (data) setVal(data.amount == null ? "" : String(data.amount)); }, [data]);
  const save = async (amount: number | null) => {
    setBusy(true);
    try {
      await api("/api/shifts/next-cash", { method: "PUT", body: { amount } });
      toast(amount == null ? "Monto borrado" : "Caja del próximo turno guardada");
      mutate();
    } catch (e) {
      toast((e as Error).message, "bad");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="mb-4" title={<span className="flex items-center gap-2"><Wallet className="size-4 text-primary" />Caja para el próximo turno</span>}>
      <p className="mb-3 text-sm text-muted">
        {data?.amount != null ? <>El próximo turno que se abra va a empezar con <b className="text-text">{ars(data.amount)}</b>. El empleado lo ve pero no lo puede cambiar.</>
          : "Todavía no cargaste el monto. Si el empleado abre igual, el turno queda con la caja inicial pendiente."}
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Efectivo inicial" className="w-48"><MoneyInput value={val} onChange={setVal} /></Field>
        <Button loading={busy} disabled={val === ""} onClick={() => save(Number(val))}>Guardar</Button>
        {data?.amount != null && <Button variant="secondary" disabled={busy} onClick={() => save(null)}>Borrar</Button>}
      </div>
    </Card>
  );
}

/** Cargar o corregir la caja inicial de un turno ya abierto o cerrado */
export function OpeningModal({ shift, onClose, onDone }: { shift: { id: number; opening_cash: number; opening_pending?: boolean } | null; onClose: () => void; onDone: () => void }) {
  const [val, setVal] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  useEffect(() => { if (shift) setVal(shift.opening_pending ? "" : String(shift.opening_cash)); }, [shift]);
  const save = async () => {
    setBusy(true);
    try {
      await api(`/api/shifts/${shift!.id}/opening`, { method: "PUT", body: { opening_cash: Number(val) } });
      toast("Caja inicial actualizada");
      onDone(); onClose();
    } catch (e) {
      toast((e as Error).message, "bad");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={!!shift} onClose={onClose} title={`Caja inicial · turno #${shift?.id ?? ""}`}
      footer={<Button className="w-full" size="lg" loading={busy} disabled={val === ""} onClick={save}>Guardar</Button>}>
      <p className="mb-3 text-sm text-muted">Si el turno ya cerró, el arqueo se recalcula con este monto.</p>
      <Field label="Efectivo inicial"><MoneyInput value={val} onChange={setVal} autoFocus /></Field>
    </Modal>
  );
}
