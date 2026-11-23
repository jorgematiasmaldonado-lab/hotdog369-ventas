"use client";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { Plus, PackagePlus, Pencil, Trash2, History, SlidersHorizontal, AlertTriangle, Wand2, X, Boxes } from "lucide-react";
import { useMe } from "@/components/me";
import { NoAccess } from "@/components/app-shell";
import { Badge, Button, Card, Empty, Field, Input, Loading, Modal, MoneyInput, PageTitle, Select, Stat, Tabs, Textarea, cx, useToast } from "@/components/ui";
import { RangePicker, type Range } from "@/components/range-picker";
import { api, fetcher, qs } from "@/lib/client/fetcher";
import type { Catalog } from "@/lib/client/types";
import { ars, fmtDateTime } from "@/lib/format";

type Item = {
  id: number; name: string; unit: string; quantity: number; min_quantity: number; cost: number | null; count_on_shift: boolean;
  sort: number; active: boolean; low: boolean; used_by: { product_id: number; name: string; qty: number }[] | null; last_in: string | null; sold_7d: number;
};
type Tab = "articulos" | "recetas" | "movimientos" | "controles";
const q = (n: number) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 3 }).format(Number(n));
const TYPE_LABEL: Record<string, string> = { ingreso: "Ingreso", ajuste: "Ajuste", control: "Control", venta: "Venta", anulacion: "Anulación", edicion: "Edición" };

export default function StockPage() {
  const { can, mod } = useMe();
  const [tab, setTab] = useState<Tab>("articulos");
  const { data: items, mutate } = useSWR<Item[]>("/api/stock", fetcher, { refreshInterval: 30000 });
  const [ingreso, setIngreso] = useState(false);
  const [editing, setEditing] = useState<Item | "new" | null>(null);
  const [fromProducts, setFromProducts] = useState(false);
  if (!mod("stock") || !can("stock.ver", "stock.gestionar")) return <NoAccess />;
  const manage = can("stock.gestionar");
  const low = (items ?? []).filter((i) => i.low);

  return (
    <div>
      <PageTitle title="Stock" subtitle="Se descuenta solo con cada venta, según lo que lleva cada producto"
        actions={manage && <>
          <Button variant="secondary" onClick={() => setEditing("new")}><Plus className="size-4" />Nuevo artículo</Button>
          <Button onClick={() => setIngreso(true)}><PackagePlus className="size-4" />Ingreso de mercadería</Button>
        </>} />
      <Tabs className="mb-4" value={tab} onChange={setTab} items={[
        { value: "articulos", label: "Artículos" }, { value: "recetas", label: "Qué descuenta cada producto" },
        { value: "movimientos", label: "Movimientos" }, { value: "controles", label: "Controles de turno" }]} />

      {tab === "articulos" && (!items ? <Loading /> : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Artículos" value={items.length} icon={<Boxes className="size-3.5" />} />
            <Stat label="Con stock bajo" value={low.length} tone={low.length ? "brand" : undefined} icon={<AlertTriangle className="size-3.5" />} />
            <Stat label="Valor del stock" value={ars(items.reduce((a, i) => a + Math.max(0, i.quantity) * (i.cost ?? 0), 0))} sub="según último costo cargado" />
          </div>
          {!items.length ? (
            <Card>
              <Empty icon={<Boxes className="size-8 opacity-40" />}>
                Todavía no hay artículos de stock.
                {manage && <div className="mt-3 flex flex-wrap justify-center gap-2">
                  <Button onClick={() => setFromProducts(true)}><Wand2 className="size-4" />Crear desde los productos</Button>
                  <Button variant="secondary" onClick={() => setEditing("new")}><Plus className="size-4" />Crear uno a mano</Button>
                </div>}
              </Empty>
            </Card>
          ) : (
            <>
              {manage && <div className="mb-3 text-right"><button onClick={() => setFromProducts(true)} className="text-sm font-semibold text-primary"><Wand2 className="mr-1 inline size-4" />Crear artículos desde productos</button></div>}
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {items.map((i) => <ItemCard key={i.id} item={i} manage={manage} onEdit={() => setEditing(i)} onChange={() => mutate()} />)}
              </div>
            </>
          )}
        </>
      ))}
      {tab === "recetas" && <Recipes items={items ?? []} manage={manage} onChange={() => mutate()} />}
      {tab === "movimientos" && <Movements />}
      {tab === "controles" && <Counts />}

      {ingreso && <IngresoModal items={items ?? []} onClose={() => setIngreso(false)} onDone={() => mutate()} />}
      {editing && <ItemModal item={editing === "new" ? null : editing} onClose={() => setEditing(null)} onDone={() => mutate()} />}
      {fromProducts && <FromProductsModal onClose={() => setFromProducts(false)} onDone={() => mutate()} />}
    </div>
  );
}

function ItemCard({ item: i, manage, onEdit, onChange }: { item: Item; manage: boolean; onEdit: () => void; onChange: () => void }) {
  const [mode, setMode] = useState<"ingreso" | "ajuste" | "historial" | null>(null);
  const toast = useToast();
  const remove = async () => {
    if (!confirm(`¿Eliminar "${i.name}"?`)) return;
    try { const r = await api<{ deleted: boolean }>(`/api/stock/${i.id}`, { method: "DELETE" }); toast(r.deleted ? "Eliminado" : "Tenía movimientos: se desactivó", r.deleted ? "good" : "info"); onChange(); }
    catch (e) { toast((e as Error).message, "bad"); }
  };
  return (
    <div className={cx("rounded-2xl border bg-surface p-4 shadow-sm", i.low ? "border-bad/50" : "border-border")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-bold">{i.name}</div>
          <div className="text-xs text-muted">{i.used_by?.length ? `Lo usan: ${i.used_by.map((u) => u.name).join(", ")}` : "Ningún producto lo descuenta"}</div>
        </div>
        {i.low && <Badge tone="bad"><AlertTriangle className="size-3" />{i.quantity <= 0 ? "Sin stock" : "Stock bajo"}</Badge>}
      </div>
      <div className="mt-3 flex items-end justify-between">
        <div>
          <div className={cx("text-3xl font-extrabold tabular-nums", i.quantity < 0 ? "text-bad" : i.low ? "text-warn" : "")}>{q(i.quantity)} <span className="text-base font-semibold text-muted">{i.unit}</span></div>
          <div className="text-xs text-muted">Mínimo {q(i.min_quantity)} · vendido 7 días: {q(i.sold_7d)}{i.cost != null && ` · costo ${ars(i.cost)}`}</div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {manage && <Button size="sm" onClick={() => setMode("ingreso")}><Plus className="size-4" />Ingreso</Button>}
        {manage && <Button size="sm" variant="secondary" onClick={() => setMode("ajuste")}><SlidersHorizontal className="size-4" />Ajustar</Button>}
        <Button size="sm" variant="ghost" onClick={() => setMode("historial")}><History className="size-4" />Historial</Button>
        {manage && <Button size="sm" variant="ghost" onClick={onEdit} aria-label="Editar"><Pencil className="size-4" /></Button>}
        {manage && <Button size="sm" variant="ghost" onClick={remove} aria-label="Eliminar"><Trash2 className="size-4" /></Button>}
      </div>
      {(mode === "ingreso" || mode === "ajuste") && <MoveModal item={i} type={mode} onClose={() => setMode(null)} onDone={onChange} />}
      {mode === "historial" && <HistoryModal item={i} onClose={() => setMode(null)} />}
    </div>
  );
}

function MoveModal({ item, type, onClose, onDone }: { item: Item; type: "ingreso" | "ajuste"; onClose: () => void; onDone: () => void }) {
  const [qty, setQty] = useState("");
  const [cost, setCost] = useState(item.cost ? String(item.cost) : "");
  const [supplier, setSupplier] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const n = Number(qty.replace(",", "."));
  const save = async () => {
    setBusy(true);
    try {
      await api(`/api/stock/${item.id}/movements`, { body: type === "ingreso" ? { type, qty: n, unit_cost: cost ? Number(cost) : null, supplier, notes } : { type, new_quantity: n, notes } });
      toast(type === "ingreso" ? `Ingresaron ${q(n)} ${item.unit}` : "Stock ajustado"); onDone(); onClose();
    } catch (e) { toast((e as Error).message, "bad"); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={`${type === "ingreso" ? "Ingreso" : "Ajuste"} · ${item.name}`}
      footer={<Button className="w-full" size="lg" loading={busy} disabled={qty === "" || Number.isNaN(n) || (type === "ingreso" && n <= 0) || (type === "ajuste" && notes.trim().length < 3)} onClick={save}>Guardar</Button>}>
      <div className="space-y-3">
        <div className="rounded-xl bg-surface-2 p-3 text-sm">Stock actual: <b>{q(item.quantity)} {item.unit}</b>{type === "ingreso" && qty && !Number.isNaN(n) && <> → quedaría en <b>{q(item.quantity + n)}</b></>}</div>
        <Field label={type === "ingreso" ? `Cantidad que ingresa (${item.unit})` : `Cantidad real que hay ahora (${item.unit})`}>
          <Input autoFocus inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value.replace(/[^\d.,]/g, ""))} />
        </Field>
        {type === "ingreso" ? (
          <>
            <Field label="Costo por unidad (opcional)"><MoneyInput value={cost} onChange={setCost} /></Field>
            <Field label="Proveedor (opcional)"><Input value={supplier} onChange={(e) => setSupplier(e.target.value)} /></Field>
          </>
        ) : null}
        <Field label={type === "ajuste" ? "Motivo del ajuste *" : "Nota (opcional)"}><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={type === "ajuste" ? "ej: se rompieron 2, vencidos, recuento" : ""} /></Field>
      </div>
    </Modal>
  );
}

function HistoryModal({ item, onClose }: { item: Item; onClose: () => void }) {
  const { data } = useSWR<{ id: number; created_at: string; type: string; qty: number; balance_after: number; user_name: string | null; sale_number: number | null; supplier: string | null; notes: string | null }[]>(`/api/stock/${item.id}/movements`, fetcher);
  return (
    <Modal open onClose={onClose} size="lg" title={`Historial · ${item.name}`}>
      {!data ? <Loading /> : !data.length ? <Empty>Sin movimientos.</Empty> : (
        <div className="divide-y divide-border text-sm">
          {data.map((m) => (
            <div key={m.id} className="flex items-center gap-3 py-2">
              <span className="w-28 shrink-0 text-xs text-muted">{fmtDateTime(m.created_at)}</span>
              <Badge tone={m.qty > 0 ? "good" : "neutral"}>{TYPE_LABEL[m.type] ?? m.type}</Badge>
              <span className="min-w-0 flex-1 truncate text-text-2">{m.sale_number ? `Venta #${m.sale_number}` : m.supplier ?? m.notes ?? ""}{m.user_name && ` · ${m.user_name}`}</span>
              <span className={cx("w-16 text-right font-bold tabular-nums", m.qty > 0 ? "text-good" : "text-bad")}>{m.qty > 0 ? "+" : ""}{q(m.qty)}</span>
              <span className="w-16 text-right tabular-nums text-muted">{q(m.balance_after)}</span>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function ItemModal({ item, onClose, onDone }: { item: Item | null; onClose: () => void; onDone: () => void }) {
  const { data: catalog } = useSWR<Catalog>("/api/catalog", fetcher);
  const [f, setF] = useState({ name: item?.name ?? "", unit: item?.unit ?? "u", min_quantity: String(item?.min_quantity ?? ""), cost: item?.cost ? String(item.cost) : "", count_on_shift: item?.count_on_shift ?? true, sort: item?.sort ?? 0, active: item?.active ?? true });
  const [initial, setInitial] = useState("");
  const [link, setLink] = useState<number | "">("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const save = async () => {
    setBusy(true);
    try {
      const body = { ...f, min_quantity: Number(f.min_quantity.replace(",", ".") || 0), cost: f.cost ? Number(f.cost) : null };
      if (item) await api(`/api/stock/${item.id}`, { method: "PUT", body });
      else await api("/api/stock", { body: { ...body, quantity: initial ? Number(initial.replace(",", ".")) : 0, link_products: link ? [{ product_id: link, qty: 1 }] : [] } });
      toast("Guardado"); onDone(); onClose();
    } catch (e) { toast((e as Error).message, "bad"); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={item ? "Editar artículo" : "Nuevo artículo de stock"} footer={<Button className="w-full" loading={busy} disabled={f.name.trim().length < 2} onClick={save}>Guardar</Button>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nombre" className="sm:col-span-2"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="ej: Pan de pancho, Coca 500 cc" /></Field>
        <Field label="Unidad">
          <Select value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })}>
            {["u", "kg", "g", "l", "ml", "paq", "caja"].map((u) => <option key={u} value={u}>{u}</option>)}
          </Select>
        </Field>
        <Field label="Avisar cuando quede menos de"><Input inputMode="decimal" value={f.min_quantity} onChange={(e) => setF({ ...f, min_quantity: e.target.value.replace(/[^\d.,]/g, "") })} /></Field>
        <Field label="Costo por unidad (opcional)"><MoneyInput value={f.cost} onChange={(v) => setF({ ...f, cost: v })} /></Field>
        {!item && <Field label="Cantidad que hay hoy"><Input inputMode="decimal" value={initial} onChange={(e) => setInitial(e.target.value.replace(/[^\d.,]/g, ""))} /></Field>}
        {!item && (
          <Field label="¿Qué producto lo descuenta? (1 por venta)" className="sm:col-span-2" hint="Podés sumar más productos o cambiar cantidades en “Qué descuenta cada producto”.">
            <Select value={link} onChange={(e) => setLink(Number(e.target.value) || "")}>
              <option value="">Ninguno por ahora</option>
              {catalog?.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
        )}
        <label className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-3 text-sm font-semibold sm:col-span-2">Contarlo en el control al abrir turno<input type="checkbox" className="size-5" checked={f.count_on_shift} onChange={(e) => setF({ ...f, count_on_shift: e.target.checked })} /></label>
        {item && <label className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-3 text-sm font-semibold sm:col-span-2">Activo<input type="checkbox" className="size-5" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /></label>}
      </div>
    </Modal>
  );
}

function IngresoModal({ items, onClose, onDone }: { items: Item[]; onClose: () => void; onDone: () => void }) {
  const { data: catalog } = useSWR<Catalog>("/api/catalog", fetcher);
  const [rows, setRows] = useState<{ id: number | ""; qty: string; cost: string }[]>([{ id: "", qty: "", cost: "" }]);
  const [supplier, setSupplier] = useState("");
  const [notes, setNotes] = useState("");
  const [expense, setExpense] = useState(true);
  const [pm, setPm] = useState<number | "">("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const valid = rows.filter((r) => r.id && Number(r.qty.replace(",", ".")) > 0);
  const total = valid.reduce((a, r) => a + Number(r.qty.replace(",", ".")) * Number(r.cost || 0), 0);
  const set = (i: number, patch: Partial<(typeof rows)[0]>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const save = async () => {
    setBusy(true);
    try {
      const r = await api<{ total: number; expense_id: number | null }>("/api/stock/ingreso", { body: { supplier, notes, create_expense: expense, payment_method_id: pm || null,
        items: valid.map((x) => ({ stock_item_id: x.id, qty: Number(x.qty.replace(",", ".")), unit_cost: x.cost ? Number(x.cost) : null })) } });
      toast(r.expense_id ? `Ingreso guardado y gasto de ${ars(r.total)} registrado` : "Ingreso guardado"); onDone(); onClose();
    } catch (e) { toast((e as Error).message, "bad"); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} size="lg" title="Ingreso de mercadería" footer={<Button className="w-full" size="lg" loading={busy} disabled={!valid.length} onClick={save}>Guardar ingreso{total ? ` · ${ars(total)}` : ""}</Button>}>
      <div className="space-y-3">
        <Field label="Proveedor (opcional)"><Input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="ej: Distribuidora Norte" /></Field>
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-[1fr_90px_120px_36px] items-center gap-2">
              <Select value={r.id} onChange={(e) => set(i, { id: Number(e.target.value) || "", cost: items.find((x) => x.id === Number(e.target.value))?.cost ? String(items.find((x) => x.id === Number(e.target.value))!.cost) : r.cost })}>
                <option value="">Artículo…</option>
                {items.map((x) => <option key={x.id} value={x.id}>{x.name} ({x.unit})</option>)}
              </Select>
              <Input inputMode="decimal" placeholder="Cant." value={r.qty} onChange={(e) => set(i, { qty: e.target.value.replace(/[^\d.,]/g, "") })} />
              <MoneyInput placeholder="Costo u." value={r.cost} onChange={(v) => set(i, { cost: v })} />
              <button onClick={() => setRows(rows.length > 1 ? rows.filter((_, j) => j !== i) : rows)} className="rounded-lg p-2 text-muted hover:text-bad" aria-label="Quitar"><X className="size-4" /></button>
            </div>
          ))}
          <Button variant="ghost" size="sm" onClick={() => setRows([...rows, { id: "", qty: "", cost: "" }])}><Plus className="size-4" />Agregar artículo</Button>
        </div>
        <Field label="Nota (opcional)"><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ej: factura 0001-1234" /></Field>
        <label className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-3 text-sm font-semibold">Registrarlo también como gasto (mercadería){total ? ` · ${ars(total)}` : ""}<input type="checkbox" className="size-5" checked={expense} onChange={(e) => setExpense(e.target.checked)} /></label>
        {expense && total > 0 && (
          <Field label="¿Cómo se pagó?">
            <Select value={pm} onChange={(e) => setPm(Number(e.target.value) || "")}>
              <option value="">—</option>
              {catalog?.paymentMethods.filter((m) => m.kind !== "fiado").map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </Select>
          </Field>
        )}
      </div>
    </Modal>
  );
}

function FromProductsModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { data } = useSWR<{ id: number; name: string; category: string; active: boolean; components: unknown[] }[]>("/api/stock/recipes", fetcher);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const free = (data ?? []).filter((p) => p.active && !p.components.length);
  const toggle = (id: number) => { const s = new Set(sel); if (s.has(id)) s.delete(id); else s.add(id); setSel(s); };
  return (
    <Modal open onClose={onClose} size="lg" title="Crear artículos desde productos"
      footer={<Button className="w-full" loading={busy} disabled={!sel.size} onClick={async () => {
        setBusy(true);
        try { const r = await api<{ created: number }>("/api/stock/from-products", { body: { product_ids: [...sel] } }); toast(`${r.created} artículos creados`); onDone(); onClose(); }
        catch (e) { toast((e as Error).message, "bad"); } finally { setBusy(false); }
      }}>Crear {sel.size || ""} artículo{sel.size === 1 ? "" : "s"}</Button>}>
      <p className="mb-3 text-sm text-text-2">Ideal para lo que se vende tal cual se compra (bebidas, snacks, alfajores): cada producto elegido crea un artículo de stock que baja 1 por venta. Para panchos y combos, armá su receta en “Qué descuenta cada producto”.</p>
      {!data ? <Loading /> : (
        <div className="grid gap-1.5 sm:grid-cols-2">
          {free.map((p) => (
            <label key={p.id} className={cx("flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm", sel.has(p.id) ? "border-primary bg-primary/5" : "border-border")}>
              <input type="checkbox" checked={sel.has(p.id)} onChange={() => toggle(p.id)} className="size-4" />
              <span className="flex-1">{p.name}</span><span className="text-xs text-muted">{p.category}</span>
            </label>
          ))}
          {!free.length && <Empty>Todos los productos ya tienen artículos asignados.</Empty>}
        </div>
      )}
    </Modal>
  );
}

type RecipeRow = { id: number; name: string; category: string; active: boolean; components: { stock_item_id: number; name: string; unit: string; qty: number }[] };
function Recipes({ items, manage, onChange }: { items: Item[]; manage: boolean; onChange: () => void }) {
  const { data, mutate } = useSWR<RecipeRow[]>("/api/stock/recipes", fetcher);
  const [edit, setEdit] = useState<RecipeRow | null>(null);
  const [filter, setFilter] = useState("");
  const list = useMemo(() => (data ?? []).filter((p) => p.active && p.name.toLowerCase().includes(filter.toLowerCase())), [data, filter]);
  if (!data) return <Loading />;
  return (
    <Card title="Qué descuenta cada producto al venderse" action={<Input className="h-9 w-48" placeholder="Buscar producto" value={filter} onChange={(e) => setFilter(e.target.value)} />}>
      <div className="-mx-4 divide-y divide-border">
        {list.map((p) => (
          <div key={p.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
            <div className="w-56 shrink-0"><div className="font-semibold">{p.name}</div><div className="text-xs text-muted">{p.category}</div></div>
            <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
              {p.components.length ? p.components.map((c) => <Badge key={c.stock_item_id}>{q(c.qty)} {c.unit} · {c.name}</Badge>) : <span className="text-xs text-muted">No descuenta stock</span>}
            </div>
            {manage && <Button size="sm" variant="ghost" onClick={() => setEdit(p)}><Pencil className="size-4" /></Button>}
          </div>
        ))}
      </div>
      {edit && <RecipeModal product={edit} items={items} onClose={() => setEdit(null)} onDone={() => { mutate(); onChange(); }} />}
    </Card>
  );
}

function RecipeModal({ product, items, onClose, onDone }: { product: RecipeRow; items: Item[]; onClose: () => void; onDone: () => void }) {
  const [rows, setRows] = useState(product.components.map((c) => ({ id: c.stock_item_id as number | "", qty: String(c.qty) })));
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  return (
    <Modal open onClose={onClose} title={`Receta · ${product.name}`}
      footer={<Button className="w-full" loading={busy} onClick={async () => {
        setBusy(true);
        try { await api("/api/stock/recipes", { method: "PUT", body: { product_id: product.id, components: rows.filter((r) => r.id && Number(r.qty.replace(",", ".")) > 0).map((r) => ({ stock_item_id: r.id, qty: Number(r.qty.replace(",", ".")) })) } }); toast("Receta guardada"); onDone(); onClose(); }
        catch (e) { toast((e as Error).message, "bad"); } finally { setBusy(false); }
      }}>Guardar</Button>}>
      <p className="mb-3 text-sm text-text-2">Cada vez que se venda 1 <b>{product.name}</b>, se descuenta:</p>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[1fr_100px_36px] gap-2">
            <Select value={r.id} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, id: Number(e.target.value) || "" } : x)))}>
              <option value="">Artículo…</option>
              {items.map((x) => <option key={x.id} value={x.id}>{x.name} ({x.unit})</option>)}
            </Select>
            <Input inputMode="decimal" value={r.qty} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, qty: e.target.value.replace(/[^\d.,]/g, "") } : x)))} />
            <button onClick={() => setRows(rows.filter((_, j) => j !== i))} className="rounded-lg p-2 text-muted hover:text-bad" aria-label="Quitar"><X className="size-4" /></button>
          </div>
        ))}
        <Button variant="ghost" size="sm" onClick={() => setRows([...rows, { id: "", qty: "1" }])}><Plus className="size-4" />Agregar artículo</Button>
        {!items.length && <p className="text-sm text-warn">Primero creá artículos de stock.</p>}
      </div>
    </Modal>
  );
}

function Movements() {
  const [range, setRange] = useState<Range>({ range: "semana" });
  const { data } = useSWR<{ manual: { id: number; created_at: string; type: string; qty: number; balance_after: number; item: string; unit: string; user_name: string | null; supplier: string | null; notes: string | null; unit_cost: number | null }[]; sold: { item: string; unit: string; qty: number }[] }>(`/api/stock/movements${qs(range)}`, fetcher);
  return (
    <div>
      <RangePicker value={range} onChange={setRange} />
      {!data ? <Loading /> : (
        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <Card title="Ingresos, ajustes y controles">
            {!data.manual.length ? <Empty>Sin movimientos en el período.</Empty> : (
              <div className="-mx-4 divide-y divide-border text-sm">
                {data.manual.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 px-4 py-2">
                    <span className="w-28 shrink-0 text-xs text-muted">{fmtDateTime(m.created_at)}</span>
                    <Badge tone={m.type === "ingreso" ? "good" : m.type === "control" ? "accent" : "neutral"}>{TYPE_LABEL[m.type]}</Badge>
                    <span className="min-w-0 flex-1 truncate"><b>{m.item}</b> · {[m.supplier, m.notes, m.user_name].filter(Boolean).join(" · ")}</span>
                    <span className={cx("font-bold tabular-nums", m.qty > 0 ? "text-good" : "text-bad")}>{m.qty > 0 ? "+" : ""}{q(m.qty)} {m.unit}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card title="Salió por ventas">
            {!data.sold.length ? <Empty>Sin ventas con stock.</Empty> : (
              <div className="space-y-1.5 text-sm">{data.sold.map((s) => <div key={s.item} className="flex justify-between"><span>{s.item}</span><b className="tabular-nums">{q(s.qty)} {s.unit}</b></div>)}</div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

function Counts() {
  const [range, setRange] = useState<Range>({ range: "semana" });
  const [open, setOpen] = useState<number | null>(null);
  const { data } = useSWR<{ id: number; created_at: string; items_count: number; differences: number; notes: string | null; user_name: string; shift_type: string | null; lines: { name: string; unit: string; expected: number; counted: number; difference: number }[] | null }[]>(`/api/stock/counts${qs(range)}`, fetcher);
  return (
    <div>
      <RangePicker value={range} onChange={setRange} />
      {!data ? <Loading /> : !data.length ? <Card><Empty>No hubo controles en el período.</Empty></Card> : (
        <div className="space-y-2">
          {data.map((c) => (
            <div key={c.id} className="rounded-2xl border border-border bg-surface p-4">
              <button className="flex w-full items-center gap-3 text-left" onClick={() => setOpen(open === c.id ? null : c.id)}>
                <span className="w-32 shrink-0 text-xs text-muted">{fmtDateTime(c.created_at)}</span>
                <span className="min-w-0 flex-1 font-semibold">{c.user_name}{c.shift_type && ` · turno ${c.shift_type}`}</span>
                {c.differences ? <Badge tone="warn"><AlertTriangle className="size-3" />{c.differences} con diferencia</Badge> : <Badge tone="good">Todo coincide</Badge>}
              </button>
              {open === c.id && (
                <div className="mt-3 overflow-x-auto">
                  {c.notes && <p className="mb-2 rounded-lg bg-surface-2 p-2 text-sm">Obs.: {c.notes}</p>}
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-xs uppercase text-muted"><th className="py-1">Artículo</th><th className="text-right">Sistema</th><th className="text-right">Contado</th><th className="text-right">Diferencia</th></tr></thead>
                    <tbody>{c.lines?.map((l) => (
                      <tr key={l.name} className="border-t border-border"><td className="py-1.5">{l.name}</td><td className="text-right tabular-nums">{q(l.expected)}</td><td className="text-right tabular-nums">{q(l.counted)}</td>
                        <td className={cx("text-right font-bold tabular-nums", l.difference < 0 ? "text-bad" : l.difference > 0 ? "text-warn" : "text-muted")}>{l.difference > 0 ? "+" : ""}{q(l.difference)} {l.unit}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
