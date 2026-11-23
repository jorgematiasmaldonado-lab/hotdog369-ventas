"use client";
import { useState } from "react";
import useSWR from "swr";
import { Modal, Button, Textarea, cx, useToast } from "./ui";
import { api, fetcher } from "@/lib/client/fetcher";
import type { Catalog } from "@/lib/client/types";
import { ars } from "@/lib/format";

export function VoidModal({ sale, onClose, onDone }: { sale: { id: string; number: number; total: number } | null; onClose: () => void; onDone: () => void }) {
  const { data } = useSWR<Catalog>("/api/catalog", fetcher);
  const [choice, setChoice] = useState<string | null>(null);
  const [other, setOther] = useState("");
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const reason = choice === "__otro" ? other.trim() : choice ?? "";

  const confirm = async () => {
    if (!sale || reason.length < 3) return;
    setLoading(true);
    try {
      await api(`/api/sales/${sale.id}/void`, { body: { reason } });
      toast(`Venta #${sale.number} anulada`);
      setChoice(null);
      setOther("");
      onDone();
      onClose();
    } catch (e) {
      toast((e as Error).message, "bad");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={!!sale} onClose={onClose} title={`Anular venta #${sale?.number ?? ""}`}
      footer={<Button variant="danger" className="w-full" size="lg" disabled={reason.length < 3} loading={loading} onClick={confirm}>Anular {sale ? ars(sale.total) : ""}</Button>}>
      <p className="mb-3 text-sm text-text-2">La venta no se borra: queda marcada como <b>ANULADA</b> con tu usuario, la hora y el motivo.</p>
      <div className="mb-3 text-sm font-semibold">¿Por qué la anulás? <span className="text-bad">*</span></div>
      <div className="flex flex-wrap gap-2">
        {[...(data?.voidReasons ?? []).map((r) => r.label), "__otro"].map((r) => (
          <button key={r} onClick={() => setChoice(r)}
            className={cx("rounded-full border px-3 py-2 text-sm font-semibold", choice === r ? "border-primary bg-primary text-white" : "border-border bg-surface-2")}>
            {r === "__otro" ? "Otro motivo…" : r}
          </button>
        ))}
      </div>
      {choice === "__otro" && <Textarea className="mt-3" autoFocus placeholder="Escribí el motivo" value={other} onChange={(e) => setOther(e.target.value)} maxLength={300} />}
    </Modal>
  );
}
