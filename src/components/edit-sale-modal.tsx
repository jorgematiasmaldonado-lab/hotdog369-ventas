"use client";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { Plus, Trash2 } from "lucide-react";
import { Button, Field, Input, Modal, MoneyInput, Select, cx, useToast } from "./ui";
import { api, fetcher } from "@/lib/client/fetcher";
import type { Catalog } from "@/lib/client/types";
import { ars } from "@/lib/format";

type Line = { product_id: number; product_name: string; unit_price: string; qty: number };
type Pay = { payment_method_id: number; amount: string };

export function EditSaleModal({ saleId, onClose, onDone }: { saleId: string | null; onClose: () => void; onDone: () => void }) {
  const { data: catalog } = useSWR<Catalog>("/api/catalog", fetcher);
  const { data: sale } = useSWR<{ number: number; items: { product_id: number; product_name: string; unit_price: number; qty: number }[]; payments: { payment_method_id: number; amount: number }[]; customer_id: number | null }>(saleId ? `/api/sales/${saleId}` : null, fetcher);
  const [lines, setLines] = useState<Line[]>([]);
  const [pays, setPays] = useState<Pay[]>([]);
  const [reason, setReason] = useState("");
  const [add, setAdd] = useState<number | "">("");
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (sale) {
      setLines(sale.items.map((i) => ({ product_id: i.product_id, product_name: i.product_name, unit_price: String(i.unit_price), qty: i.qty })));
      setPays(sale.payments.map((p) => ({ payment_method_id: p.payment_method_id, amount: String(p.amount) })));
      setReason("");
    }
  }, [sale]);

  const total = lines.reduce((a, l) => a + Number(l.unit_price || 0) * l.qty, 0);
  const paid = pays.reduce((a, p) => a + Number(p.amount || 0), 0);
  const save = async () => {
    setLoading(true);
    try {
      await api(`/api/sales/${saleId}`, {
        method: "PUT",
        body: {
          reason,
          customer_id: sale?.customer_id,
          items: lines.map((l) => ({ product_id: l.product_id, qty: l.qty, unit_price: Number(l.unit_price || 0) })),
          payments: pays.filter((p) => Number(p.amount) > 0).map((p) => ({ payment_method_id: p.payment_method_id, amount: Number(p.amount) })),
        },
      });
      toast("Venta corregida");
      onDone();
      onClose();
    } catch (e) {
      toast((e as Error).message, "bad");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={!!saleId} onClose={onClose} size="lg" title={`Editar venta #${sale?.number ?? ""}`}
      footer={<Button className="w-full" size="lg" loading={loading} disabled={!lines.length || paid !== total || reason.trim().length < 3} onClick={save}>Guardar cambios</Button>}>
      {!sale || !catalog ? null : (
        <div className="space-y-4">
          <div>
            <div className="mb-2 text-sm font-semibold">Productos</div>
            <div className="space-y-2">
              {lines.map((l, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{l.product_name}</span>
                  <Input type="number" min={1} className="w-16 text-center" value={l.qty} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, qty: Math.max(1, Number(e.target.value) || 1) } : x))} />
                  <MoneyInput className="w-32" value={l.unit_price} onChange={(v) => setLines(lines.map((x, j) => j === i ? { ...x, unit_price: v } : x))} />
                  <button onClick={() => setLines(lines.filter((_, j) => j !== i))} className="rounded-lg p-2 text-muted hover:text-bad"><Trash2 className="size-4" /></button>
                </div>
              ))}
              <div className="flex gap-2">
                <Select value={add} onChange={(e) => setAdd(Number(e.target.value) || "")}>
                  <option value="">Agregar producto…</option>
                  {catalog.products.map((p) => <option key={p.id} value={p.id}>{p.name} · {ars(p.price)}</option>)}
                </Select>
                <Button variant="secondary" disabled={!add} onClick={() => {
                  const p = catalog.products.find((x) => x.id === add);
                  if (p) setLines([...lines, { product_id: p.id, product_name: p.name, unit_price: String(p.price), qty: 1 }]);
                  setAdd("");
                }}><Plus className="size-4" /></Button>
              </div>
            </div>
          </div>
          <div>
            <div className="mb-2 flex justify-between text-sm font-semibold"><span>Pagos</span><span>Total venta: {ars(total)}</span></div>
            <div className="space-y-2">
              {pays.map((p, i) => (
                <div key={i} className="flex gap-2">
                  <Select value={p.payment_method_id} onChange={(e) => setPays(pays.map((x, j) => j === i ? { ...x, payment_method_id: Number(e.target.value) } : x))}>
                    {catalog.paymentMethods.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </Select>
                  <MoneyInput className="w-40" value={p.amount} onChange={(v) => setPays(pays.map((x, j) => j === i ? { ...x, amount: v } : x))} />
                  <button onClick={() => setPays(pays.filter((_, j) => j !== i))} className="rounded-lg p-2 text-muted hover:text-bad"><Trash2 className="size-4" /></button>
                </div>
              ))}
              <Button variant="ghost" size="sm" onClick={() => setPays([...pays, { payment_method_id: catalog.paymentMethods[0].id, amount: String(Math.max(0, total - paid)) }])}><Plus className="size-4" />Agregar pago</Button>
              <div className={cx("rounded-xl p-2 text-center text-sm font-bold", paid === total ? "bg-good/10 text-good" : "bg-warn/10 text-warn")}>
                {paid === total ? "Pagos completos" : `Pagos ${ars(paid)} ≠ total ${ars(total)}`}
              </div>
            </div>
          </div>
          <Field label="Motivo de la corrección (queda en auditoría)"><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="ej: se cobró por transferencia, no en efectivo" /></Field>
        </div>
      )}
    </Modal>
  );
}
