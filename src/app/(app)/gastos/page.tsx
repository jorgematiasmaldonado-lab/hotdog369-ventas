"use client";
import { useState } from "react";
import useSWR from "swr";
import { Plus, Pencil, Trash2, Camera, Image as ImageIcon, Download } from "lucide-react";
import { useMe } from "@/components/me";
import { NoAccess } from "@/components/app-shell";
import { Button, Card, Empty, Field, Input, Loading, Modal, MoneyInput, PageTitle, Select, Stat, Textarea, useToast } from "@/components/ui";
import { RangePicker, type Range } from "@/components/range-picker";
import { BarList } from "@/components/charts";
import { api, fetcher, qs } from "@/lib/client/fetcher";
import type { Catalog } from "@/lib/client/types";
import { ars, fmtDate } from "@/lib/format";
import { localDate } from "@/lib/dates";

type Exp = { id: number; date: string; supplier: string | null; category_id: number | null; category_name: string | null; amount: number; payment_method_id: number | null; payment_method: string | null; notes: string | null; has_receipt: boolean; user_name: string };

export default function GastosPage() {
  const { can, mod } = useMe();
  const [range, setRange] = useState<Range>({ range: "mes" });
  const { data, mutate } = useSWR<{ expenses: Exp[]; byCategory: { name: string; amount: number }[]; total: number }>(`/api/expenses${qs(range)}`, fetcher);
  const [editing, setEditing] = useState<Exp | "new" | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<Exp | null>(null);
  const toast = useToast();
  if (!mod("gastos") || !can("gastos.ver", "gastos.gestionar")) return <NoAccess />;
  const manage = can("gastos.gestionar");

  return (
    <div>
      <PageTitle title="Gastos y compras" subtitle="Mercadería, servicios y otros gastos del negocio"
        actions={<>
          {can("reportes.ver") && <a href={`/api/reports/export${qs({ section: "gastos", ...range })}`}><Button variant="secondary"><Download className="size-4" />CSV</Button></a>}
          {manage && <Button onClick={() => setEditing("new")}><Plus className="size-4" />Nuevo gasto</Button>}
        </>} />
      <RangePicker value={range} onChange={setRange} />
      {!data ? <Loading /> : (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <Card className="overflow-hidden">
            {!data.expenses.length ? <Empty>No hay gastos en este período.</Empty> : (
              <div className="-m-4 divide-y divide-border">
                {data.expenses.map((e) => (
                  <div key={e.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                    <div className="w-20 text-xs text-muted">{fmtDate(e.date)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{e.supplier || e.category_name || "Gasto"}</div>
                      <div className="truncate text-xs text-muted">{[e.category_name, e.payment_method, e.notes].filter(Boolean).join(" · ")}</div>
                    </div>
                    {e.has_receipt && <button onClick={() => setViewing(e.id)} className="rounded-lg p-1.5 text-muted hover:bg-surface-2" aria-label="Ver comprobante"><ImageIcon className="size-4" /></button>}
                    <div className="font-bold tabular-nums">{ars(e.amount)}</div>
                    {manage && <>
                      <button onClick={() => setEditing(e)} className="rounded-lg p-1.5 text-muted hover:bg-surface-2" aria-label="Editar"><Pencil className="size-4" /></button>
                      <button onClick={() => setDeleting(e)} className="rounded-lg p-1.5 text-muted hover:text-bad" aria-label="Eliminar"><Trash2 className="size-4" /></button>
                    </>}
                  </div>
                ))}
              </div>
            )}
          </Card>
          <div className="space-y-4">
            <Stat label="Total gastado" value={ars(data.total)} tone="brand" />
            <Card title="Por categoría">{data.byCategory.length ? <BarList items={data.byCategory} /> : <Empty>Sin datos.</Empty>}</Card>
          </div>
        </div>
      )}
      {editing && <ExpenseModal exp={editing === "new" ? null : editing} onClose={() => setEditing(null)} onDone={() => mutate()} />}
      <Receipt id={viewing} onClose={() => setViewing(null)} />
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="¿Eliminar gasto?"
        footer={<Button variant="danger" className="w-full" onClick={async () => {
          try { await api(`/api/expenses/${deleting!.id}`, { method: "DELETE" }); toast("Gasto eliminado"); mutate(); } catch (e) { toast((e as Error).message, "bad"); }
          setDeleting(null);
        }}>Eliminar {deleting && ars(deleting.amount)}</Button>}>
        <p>Queda registrado en la auditoría.</p>
      </Modal>
    </div>
  );
}

function Receipt({ id, onClose }: { id: number | null; onClose: () => void }) {
  const { data } = useSWR<{ receipt_image: string | null }>(id ? `/api/expenses/${id}` : null, fetcher);
  return (
    <Modal open={!!id} onClose={onClose} title="Comprobante">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {data?.receipt_image ? <img src={data.receipt_image} alt="Comprobante" className="w-full rounded-xl" /> : <Loading />}
    </Modal>
  );
}

/** Reduce la foto en el teléfono antes de subirla (máx. ~1200px, JPEG) */
async function compress(file: File): Promise<string> {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, 1200 / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.7);
}

function ExpenseModal({ exp, onClose, onDone }: { exp: Exp | null; onClose: () => void; onDone: () => void }) {
  const { data: catalog } = useSWR<Catalog>("/api/catalog", fetcher);
  const { data: cats } = useSWR<{ id: number; name: string }[]>("/api/expenses/categories", fetcher);
  const [f, setF] = useState({
    date: exp?.date ?? localDate(), supplier: exp?.supplier ?? "", category_id: exp?.category_id ?? "", amount: exp ? String(exp.amount) : "",
    payment_method_id: exp?.payment_method_id ?? "", notes: exp?.notes ?? "",
  });
  const [img, setImg] = useState<string | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const save = async () => {
    setLoading(true);
    try {
      const body = { ...f, amount: Number(f.amount), category_id: f.category_id || null, payment_method_id: f.payment_method_id || null, ...(img !== undefined ? { receipt_image: img } : {}) };
      if (exp) await api(`/api/expenses/${exp.id}`, { method: "PUT", body });
      else await api("/api/expenses", { body });
      toast(exp ? "Gasto actualizado" : "Gasto registrado");
      onDone(); onClose();
    } catch (e) {
      toast((e as Error).message, "bad");
    } finally {
      setLoading(false);
    }
  };
  return (
    <Modal open onClose={onClose} title={exp ? "Editar gasto" : "Nuevo gasto"}
      footer={<Button className="w-full" size="lg" loading={loading} disabled={!f.amount || !f.date} onClick={save}>Guardar</Button>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Fecha"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="Monto"><MoneyInput value={f.amount} onChange={(v) => setF({ ...f, amount: v })} /></Field>
        <Field label="Proveedor"><Input value={f.supplier} onChange={(e) => setF({ ...f, supplier: e.target.value })} placeholder="ej: Panificadora" /></Field>
        <Field label="Categoría">
          <Select value={f.category_id} onChange={(e) => setF({ ...f, category_id: Number(e.target.value) || "" })}>
            <option value="">Sin categoría</option>
            {cats?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Medio de pago">
          <Select value={f.payment_method_id} onChange={(e) => setF({ ...f, payment_method_id: Number(e.target.value) || "" })}>
            <option value="">—</option>
            {catalog?.paymentMethods.filter((m) => m.kind !== "fiado").map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>
        </Field>
        <Field label="Foto del comprobante (opcional)">
          <label className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border text-sm font-semibold text-text-2">
            <Camera className="size-4" />{img ? "Foto cargada ✓" : exp?.has_receipt && img === undefined ? "Reemplazar foto" : "Sacar / elegir foto"}
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) setImg(await compress(file));
            }} />
          </label>
        </Field>
        <Field label="Observación" className="sm:col-span-2"><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}
