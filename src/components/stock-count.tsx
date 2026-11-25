"use client";
import { useState } from "react";
import useSWR from "swr";
import { ClipboardCheck, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button, Card, Loading, Modal, Textarea, cx, useToast } from "./ui";
import { api, fetcher } from "@/lib/client/fetcher";

type Item = { id: number; name: string; unit: string; units_per_pack: number | null };
type Line = { name: string; unit: string; expected: number; counted: number; difference: number; packs: number | null; loose: number | null; units_per_pack: number | null };
type Result = { differences: number; lines: Line[] };
const fmtQ = (n: number) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 3 }).format(n);
const num = (s: string | undefined) => Number((s ?? "").replace(",", "."));

function QtyInput({ value, onChange, label, integer }: { value: string | undefined; onChange: (v: string) => void; label: string; integer?: boolean }) {
  return (
    <label className="flex flex-col items-center gap-1">
      <span className="text-xs font-semibold text-muted">{label}</span>
      <input inputMode={integer ? "numeric" : "decimal"} value={value ?? ""} placeholder="0" aria-label={label}
        onChange={(e) => onChange(e.target.value.replace(integer ? /\D/g : /[^\d.,]/g, "").slice(0, 7))}
        className={cx("h-12 w-24 rounded-xl border bg-surface px-3 text-center text-lg font-bold tabular-nums outline-none focus:border-primary focus:ring-2 focus:ring-primary/20",
          value ? "border-good" : "border-border")} />
    </label>
  );
}

/** Control de stock al abrir el turno: el empleado cuenta sin ver lo esperado. */
export function StockCount({ mode, onDone, onSkip }: { mode: string; onDone: () => void; onSkip?: () => void }) {
  const { data: items } = useSWR<Item[]>("/api/stock/count", fetcher);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const toast = useToast();
  if (!items) return <Loading />;
  const set = (k: string, v: string) => setVals({ ...vals, [k]: v });
  const filled = (k: string) => vals[k] !== undefined && vals[k] !== "";
  // Por paquete: hay que completar paquetes Y sueltas (aunque sea 0)
  const missing = items.filter((i) => (i.units_per_pack ? !filled(`${i.id}p`) || !filled(`${i.id}s`) : !filled(`${i.id}`))).length;

  const save = async () => {
    setBusy(true);
    try {
      const lines = items.map((i) => (i.units_per_pack
        ? { stock_item_id: i.id, packs: num(vals[`${i.id}p`]), loose: num(vals[`${i.id}s`]) }
        : { stock_item_id: i.id, counted: num(vals[`${i.id}`]) }));
      setResult(await api<Result>("/api/stock/count", { body: { notes, lines } }));
    } catch (e) {
      toast((e as Error).message, "bad");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <div className="mb-4 text-center">
          <ClipboardCheck className="mx-auto size-10 text-primary" />
          <h1 className="mt-2 font-display text-3xl uppercase">Control de stock</h1>
          <p className="text-sm text-muted">Antes de empezar, contá lo que hay. En los que vienen por paquete, anotá los paquetes cerrados y las unidades sueltas por separado.</p>
        </div>
        <div className="divide-y divide-border">
          {items.map((i) => (
            <div key={i.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{i.name}</div>
                {i.units_per_pack && <div className="text-xs text-muted">Paquete de {i.units_per_pack} {i.unit}</div>}
              </div>
              {i.units_per_pack ? (
                <div className="flex items-end gap-2">
                  <QtyInput label="Paquetes cerrados" integer value={vals[`${i.id}p`]} onChange={(v) => set(`${i.id}p`, v)} />
                  <span className="pb-3 text-lg font-bold text-muted">+</span>
                  <QtyInput label="Sueltas" value={vals[`${i.id}s`]} onChange={(v) => set(`${i.id}s`, v)} />
                  <div className="w-20 pb-3 text-right text-sm text-muted">
                    {filled(`${i.id}p`) || filled(`${i.id}s`) ? <>= <b className="text-text tabular-nums">{fmtQ(num(vals[`${i.id}p`] || "0") * i.units_per_pack + num(vals[`${i.id}s`] || "0"))}</b> {i.unit}</> : null}
                  </div>
                </div>
              ) : (
                <div className="flex items-end gap-2">
                  <QtyInput label={`Cantidad (${i.unit})`} value={vals[`${i.id}`]} onChange={(v) => set(`${i.id}`, v)} />
                  <div className="w-20" />
                </div>
              )}
            </div>
          ))}
        </div>
        <Textarea className="mt-3" placeholder="Observaciones (opcional): algo roto, vencido, faltante…" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
        <Button size="lg" className="mt-4 w-full" disabled={missing > 0} loading={busy} onClick={save}>
          {missing > 0 ? `Faltan ${missing} artículo${missing === 1 ? "" : "s"} por contar` : "Guardar control y empezar a vender"}
        </Button>
        {mode === "opcional" && onSkip && <button onClick={onSkip} className="mt-3 w-full text-center text-sm font-semibold text-muted hover:text-text">Saltar por ahora</button>}
      </Card>
      <Modal open={!!result} onClose={onDone} title="Control guardado" footer={<Button className="w-full" size="lg" onClick={onDone}>Empezar a vender</Button>}>
        {result && (
          result.differences === 0 ? (
            <div className="flex flex-col items-center py-3 text-center">
              <CheckCircle2 className="size-14 text-good" />
              <div className="mt-2 text-lg font-bold">Control guardado</div>
              <div className="text-muted">Gracias. Ya podés empezar a vender.</div>
            </div>
          ) : (
            <div className="flex flex-col items-center py-3 text-center">
              <AlertTriangle className="size-14 text-warn" />
              <div className="mt-2 text-lg font-bold">Control guardado</div>
              <div className="text-muted">El administrador va a revisar el conteo. Ya podés empezar a vender.</div>
            </div>
          )
        )}
      </Modal>
    </div>
  );
}
