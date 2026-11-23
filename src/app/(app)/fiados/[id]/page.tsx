"use client";
import { use, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { ArrowLeft, HandCoins, MessageCircle } from "lucide-react";
import { useMe } from "@/components/me";
import { Badge, Button, Card, Empty, ErrorBox, Field, Input, Loading, Modal, MoneyInput, PageTitle, Select, useToast } from "@/components/ui";
import { api, fetcher } from "@/lib/client/fetcher";
import type { Catalog } from "@/lib/client/types";
import { ars, fmtDateTime } from "@/lib/format";

type Mov = { id: number; type: "cargo" | "pago" | "anulacion" | "ajuste"; amount: number; notes: string | null; created_at: string; sale_number: number | null; payment_method: string | null; user_name: string | null; detail: string | null };
const LABEL = { cargo: "Fiado", pago: "Pago", anulacion: "Anulación", ajuste: "Ajuste" };

export default function ClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { can } = useMe();
  const { data, mutate, error } = useSWR<{ customer: { id: number; name: string; phone: string | null }; movements: Mov[]; balance: number }>(`/api/customers/${id}`, fetcher);
  const [paying, setPaying] = useState(false);
  if (error) return <ErrorBox error={error} />;
  if (!data) return <Loading />;
  const c = data.customer;
  const wa = c.phone ? `https://wa.me/${c.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Hola ${c.name}! Te escribimos de HOT DOG 369. Tu saldo pendiente es de ${ars(data.balance)}. ¡Gracias!`)}` : null;
  return (
    <div>
      <PageTitle title={c.name} subtitle={c.phone ?? "Sin teléfono"}
        actions={<>
          <Link href="/fiados"><Button variant="secondary"><ArrowLeft className="size-4" />Volver</Button></Link>
          {wa && data.balance > 0 && <a href={wa} target="_blank" rel="noreferrer"><Button variant="secondary"><MessageCircle className="size-4" />Recordar por WhatsApp</Button></a>}
          {can("fiados.gestionar") && data.balance > 0 && <Button onClick={() => setPaying(true)}><HandCoins className="size-4" />Registrar cobro</Button>}
        </>} />
      <div className={`mb-4 rounded-2xl p-5 ${data.balance > 0 ? "bg-primary text-white" : "bg-good/10 text-good"}`}>
        <div className="text-xs font-bold uppercase opacity-90">Saldo adeudado</div>
        <div className="text-4xl font-extrabold tabular-nums">{ars(data.balance)}</div>
      </div>
      <Card title="Movimientos">
        {!data.movements.length ? <Empty>Sin movimientos.</Empty> : (
          <div className="divide-y divide-border">
            {data.movements.map((m) => (
              <div key={m.id} className="flex items-center gap-3 py-2.5 text-sm">
                <Badge tone={m.type === "cargo" ? "bad" : m.type === "pago" ? "good" : "neutral"}>{LABEL[m.type]}</Badge>
                <div className="min-w-0 flex-1">
                  <div className="truncate">{m.detail ?? m.notes ?? (m.payment_method ? `Pago en ${m.payment_method}` : "")}</div>
                  <div className="text-xs text-muted">{fmtDateTime(m.created_at)}{m.sale_number && ` · venta #${m.sale_number}`}{m.payment_method && ` · ${m.payment_method}`}{m.user_name && ` · ${m.user_name}`}</div>
                </div>
                <div className={`font-bold tabular-nums ${m.type === "cargo" ? "text-bad" : "text-good"}`}>{m.type === "cargo" ? "+" : "−"}{ars(m.amount)}</div>
              </div>
            ))}
          </div>
        )}
      </Card>
      <PayModal open={paying} onClose={() => setPaying(false)} customerId={c.id} balance={data.balance} onDone={() => mutate()} />
    </div>
  );
}

function PayModal({ open, onClose, customerId, balance, onDone }: { open: boolean; onClose: () => void; customerId: number; balance: number; onDone: () => void }) {
  const { data: catalog } = useSWR<Catalog>("/api/catalog", fetcher);
  const [amount, setAmount] = useState("");
  const [pm, setPm] = useState<number | "">("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const methods = catalog?.paymentMethods.filter((m) => m.kind !== "fiado") ?? [];
  return (
    <Modal open={open} onClose={onClose} title="Registrar cobro de fiado"
      footer={<Button className="w-full" size="lg" loading={loading} disabled={!amount || Number(amount) > balance || !pm} onClick={async () => {
        setLoading(true);
        try { await api(`/api/customers/${customerId}/payments`, { body: { amount: Number(amount), payment_method_id: pm, notes } }); toast("Cobro registrado"); setAmount(""); setNotes(""); onDone(); onClose(); }
        catch (e) { toast((e as Error).message, "bad"); } finally { setLoading(false); }
      }}>Registrar {amount ? ars(Number(amount)) : ""}</Button>}>
      <div className="space-y-3">
        <Field label="Monto" hint={<button className="font-semibold text-primary" onClick={() => setAmount(String(balance))}>Cobrar todo ({ars(balance)})</button>}>
          <MoneyInput value={amount} onChange={setAmount} autoFocus />
        </Field>
        <Field label="Medio de pago">
          <Select value={pm} onChange={(e) => setPm(Number(e.target.value) || "")}>
            <option value="">Elegir…</option>
            {methods.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>
        </Field>
        <Field label="Nota (opcional)"><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}
