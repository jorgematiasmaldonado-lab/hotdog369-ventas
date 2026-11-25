"use client";
import { useState } from "react";
import useSWR from "swr";
import { Plus, Pencil, Trash2, History } from "lucide-react";
import { Badge, Button, Card, Empty, Field, Input, Loading, Modal, MoneyInput, Select, cx, useToast } from "@/components/ui";
import { api, fetcher } from "@/lib/client/fetcher";
import { ars, fmtDateTime } from "@/lib/format";

type FieldDef = { type: "text" | "int" | "money" | "color" | "bool" | "select" | "time" | "days" | "percent"; label: string; required?: boolean; options?: string[]; ref?: string; hint?: string };
const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const daysText = (d: string) => (d === "0123456" ? "Todos los días" : [1, 2, 3, 4, 5, 6, 0].filter((i) => d.includes(String(i))).map((i) => DAY_NAMES[i]).join(" "));
type Resp = { def: { label: string; fields: Record<string, FieldDef> }; rows: Record<string, unknown>[]; refs: Record<string, { id: number; name: string }[]> };

/** Administrador genérico de catálogos: se arma solo a partir de la definición del servidor */
export function CatalogManager({ entity }: { entity: string }) {
  const { data, mutate } = useSWR<Resp>(`/api/admin/catalog/${entity}`, fetcher);
  const [editing, setEditing] = useState<Record<string, unknown> | "new" | null>(null);
  const [history, setHistory] = useState<number | null>(null);
  const [filter, setFilter] = useState<string>("");
  const toast = useToast();
  if (!data) return <Loading />;
  const f = data.def.fields;
  const nameKey = "name" in f ? "name" : "label";
  const catRef = data.refs.categories;
  const rows = data.rows.filter((r) => !filter || String(r.category_id) === filter);

  const remove = async (r: Record<string, unknown>) => {
    if (!confirm(`¿Eliminar "${r[nameKey]}"?`)) return;
    try {
      const res = await api<{ deleted: boolean }>(`/api/admin/catalog/${entity}/${r.id}`, { method: "DELETE" });
      toast(res.deleted ? "Eliminado" : "Está en uso: se desactivó para conservar el historial", res.deleted ? "good" : "info");
      mutate();
    } catch (e) {
      toast((e as Error).message, "bad");
    }
  };

  return (
    <Card title={data.def.label} action={<Button size="sm" onClick={() => setEditing("new")}><Plus className="size-4" />Agregar</Button>}>
      {catRef && (
        <Select className="mb-3" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">Todas las categorías</option>
          {catRef.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      )}
      {!rows.length ? <Empty>No hay registros.</Empty> : (
        <div className="-mx-4 divide-y divide-border">
          {rows.map((r) => (
            <div key={String(r.id)} className={cx("flex items-center gap-3 px-4 py-2.5 text-sm", r.active === false && "opacity-50")}>
              {"color" in f && <span className="size-5 shrink-0 rounded-md border border-border" style={{ background: String(r.color ?? "#ccc") }} />}
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{String(r[nameKey])}</div>
                <div className="flex flex-wrap gap-1.5 text-xs text-muted">
                  {catRef && <span>{catRef.find((c) => c.id === r.category_id)?.name}</span>}
                  {"kind" in f && <span>Tipo: {String(r.kind)}</span>}
                  {"surcharge_pct" in f && Number(r.surcharge_pct) > 0 && <Badge tone="accent">Recargo {String(r.surcharge_pct).replace(".", ",")} %</Badge>}
                  {"start_time" in f && <span>{r.start_time ? `Empieza ${String(r.start_time)}` : "Sin horario"}</span>}
                  {"days" in f && typeof r.days === "string" && <span>· {daysText(r.days)}</span>}
                  {r.is_combo === true && <Badge tone="accent">Promo</Badge>}
                  {r.active === false && <Badge>Inactivo</Badge>}
                </div>
              </div>
              {"price" in f && <span className="font-bold tabular-nums">{ars(Number(r.price))}</span>}
              {entity === "products" && <button onClick={() => setHistory(Number(r.id))} className="rounded-lg p-1.5 text-muted hover:bg-surface-2" title="Historial de precios"><History className="size-4" /></button>}
              <button onClick={() => setEditing(r)} className="rounded-lg p-1.5 text-muted hover:bg-surface-2" aria-label="Editar"><Pencil className="size-4" /></button>
              <button onClick={() => remove(r)} className="rounded-lg p-1.5 text-muted hover:text-bad" aria-label="Eliminar"><Trash2 className="size-4" /></button>
            </div>
          ))}
        </div>
      )}
      {editing && <EditRow entity={entity} def={data.def} refs={data.refs} row={editing === "new" ? null : editing} defaultCategory={filter} onClose={() => setEditing(null)} onDone={() => mutate()} />}
      <PriceHistory id={history} onClose={() => setHistory(null)} />
    </Card>
  );
}

function EditRow({ entity, def, refs, row, defaultCategory, onClose, onDone }: { entity: string; def: Resp["def"]; refs: Resp["refs"]; row: Record<string, unknown> | null; defaultCategory: string; onClose: () => void; onDone: () => void }) {
  const init: Record<string, unknown> = {};
  for (const [k, f] of Object.entries(def.fields)) {
    init[k] = row ? row[k] : f.type === "bool" ? k === "active" : f.type === "int" ? 0 : f.type === "days" ? "0123456" : f.type === "percent" ? 0 : f.type === "time" ? "" : f.type === "color" ? "#D71B22" : f.type === "select" ? (f.options?.[0] ?? (k === "category_id" && defaultCategory ? Number(defaultCategory) : refs[f.ref!]?.[0]?.id)) : "";
  }
  const [v, setV] = useState(init);
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const save = async () => {
    setLoading(true);
    try {
      if (row) await api(`/api/admin/catalog/${entity}/${row.id}`, { method: "PUT", body: v });
      else await api(`/api/admin/catalog/${entity}`, { body: v });
      toast("Guardado");
      onDone(); onClose();
    } catch (e) {
      toast((e as Error).message, "bad");
    } finally {
      setLoading(false);
    }
  };
  return (
    <Modal open onClose={onClose} title={`${row ? "Editar" : "Agregar"} · ${def.label}`} footer={<Button className="w-full" loading={loading} onClick={save}>Guardar</Button>}>
      <div className="space-y-3">
        {Object.entries(def.fields).map(([k, f]) => {
          const set = (x: unknown) => setV({ ...v, [k]: x });
          if (f.type === "bool")
            return (
              <label key={k} className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-3 font-semibold">
                {f.label}<input type="checkbox" className="size-5 accent-[var(--primary)]" checked={!!v[k]} onChange={(e) => set(e.target.checked)} />
              </label>
            );
          return (
            <Field key={k} label={f.label + (f.required ? " *" : "")} hint={k === "price" && row ? "El cambio de precio queda en el historial; las ventas anteriores conservan su precio." : f.hint}>
              {f.type === "days" ? (
                <div className="grid grid-cols-7 gap-1">
                  {[1, 2, 3, 4, 5, 6, 0].map((i) => {
                    const on = String(v[k] ?? "").includes(String(i));
                    return <button key={i} type="button" onClick={() => set(on ? String(v[k]).replace(String(i), "") : String(v[k] ?? "") + i)}
                      className={cx("rounded-lg border py-2 text-xs font-semibold", on ? "border-primary bg-primary text-white" : "border-border bg-surface-2 text-muted")}>{DAY_NAMES[i]}</button>;
                  })}
                </div>
              )
                : f.type === "percent" ? <Input inputMode="decimal" value={String(v[k] ?? "")} placeholder="0" onChange={(e) => set(e.target.value.replace(/[^\d.,]/g, "").slice(0, 6))} />
                : f.type === "time" ? <Input type="time" value={String(v[k] ?? "")} onChange={(e) => set(e.target.value)} />
                : f.type === "money" ? <MoneyInput value={v[k] === "" || v[k] == null ? "" : String(v[k])} onChange={(x) => set(x === "" ? "" : Number(x))} />
                : f.type === "color" ? (
                  <div className="flex gap-2">
                    <input type="color" value={String(v[k] || "#D71B22")} onChange={(e) => set(e.target.value.toUpperCase())} className="h-11 w-16 rounded-xl border border-border bg-surface" />
                    {["#D71B22", "#151A1D", "#F9C21B", "#8B5A2B", "#16A34A", "#2563EB"].map((c) => (
                      <button key={c} type="button" onClick={() => set(c)} className="size-11 rounded-xl border border-border" style={{ background: c }} aria-label={c} />
                    ))}
                  </div>
                )
                : f.type === "select" ? (
                  <Select value={String(v[k] ?? "")} onChange={(e) => set(f.options ? e.target.value : Number(e.target.value))}>
                    {f.options ? f.options.map((o) => <option key={o} value={o}>{o}</option>) : refs[f.ref!]?.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </Select>
                )
                : <Input type={f.type === "int" ? "number" : "text"} value={String(v[k] ?? "")} onChange={(e) => set(f.type === "int" ? Number(e.target.value) : e.target.value)} />}
            </Field>
          );
        })}
      </div>
    </Modal>
  );
}

function PriceHistory({ id, onClose }: { id: number | null; onClose: () => void }) {
  const { data } = useSWR<{ old_price: number | null; new_price: number; changed_at: string; user_name: string }[]>(id ? `/api/admin/products/${id}/history` : null, fetcher);
  return (
    <Modal open={!!id} onClose={onClose} title="Historial de precios">
      {!data ? <Loading /> : !data.length ? <Empty>Sin cambios registrados.</Empty> : (
        <div className="divide-y divide-border text-sm">
          {data.map((h, i) => (
            <div key={i} className="flex justify-between py-2">
              <span className="text-muted">{fmtDateTime(h.changed_at)} · {h.user_name}</span>
              <span className="font-semibold tabular-nums">{h.old_price != null ? `${ars(h.old_price)} → ` : "Alta: "}{ars(h.new_price)}</span>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
