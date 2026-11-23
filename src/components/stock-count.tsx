"use client";
import { useState } from "react";
import useSWR from "swr";
import { ClipboardCheck, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button, Card, Loading, Modal, Textarea, cx, useToast } from "./ui";
import { api, fetcher } from "@/lib/client/fetcher";

type Item = { id: number; name: string; unit: string };
type Result = { differences: number; lines: { name: string; unit: string; expected: number; counted: number; difference: number }[] };
const fmtQ = (n: number) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 3 }).format(n);

/** Control de stock al abrir el turno: el empleado cuenta sin ver lo esperado. */
export function StockCount({ mode, onDone, onSkip }: { mode: string; onDone: () => void; onSkip?: () => void }) {
  const { data: items } = useSWR<Item[]>("/api/stock/count", fetcher);
  const [vals, setVals] = useState<Record<number, string>>({});
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const toast = useToast();
  if (!items) return <Loading />;
  const missing = items.filter((i) => vals[i.id] === undefined || vals[i.id] === "").length;

  const save = async () => {
    setBusy(true);
    try {
      const r = await api<Result>("/api/stock/count", { body: { notes, lines: items.map((i) => ({ stock_item_id: i.id, counted: Number(vals[i.id].replace(",", ".")) })) } });
      setResult(r);
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
          <p className="text-sm text-muted">Antes de empezar, contá lo que hay y anotá la cantidad real de cada artículo.</p>
        </div>
        <div className="divide-y divide-border">
          {items.map((i) => (
            <label key={i.id} className="flex items-center gap-3 py-2.5">
              <span className="min-w-0 flex-1 font-semibold">{i.name}</span>
              <input inputMode="decimal" value={vals[i.id] ?? ""} placeholder="0"
                onChange={(e) => setVals({ ...vals, [i.id]: e.target.value.replace(/[^\d.,]/g, "").slice(0, 10) })}
                className={cx("h-12 w-28 rounded-xl border bg-surface px-3 text-right text-lg font-bold tabular-nums outline-none focus:border-primary focus:ring-2 focus:ring-primary/20",
                  vals[i.id] ? "border-good" : "border-border")} />
              <span className="w-10 text-sm text-muted">{i.unit}</span>
            </label>
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
              <div className="mt-2 text-lg font-bold">Todo coincide</div>
              <div className="text-muted">El stock contado es igual al registrado.</div>
            </div>
          ) : (
            <div>
              <div className="mb-3 flex items-center gap-2 font-semibold text-warn"><AlertTriangle className="size-5" />{result.differences} artículo{result.differences === 1 ? "" : "s"} con diferencias. El stock quedó corregido y el administrador lo puede ver.</div>
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs uppercase text-muted"><th className="py-1">Artículo</th><th className="text-right">Sistema</th><th className="text-right">Contado</th><th className="text-right">Dif.</th></tr></thead>
                <tbody>{result.lines.filter((l) => l.difference !== 0).map((l) => (
                  <tr key={l.name} className="border-t border-border"><td className="py-1.5">{l.name}</td><td className="text-right tabular-nums">{fmtQ(l.expected)}</td><td className="text-right tabular-nums">{fmtQ(l.counted)}</td>
                    <td className={cx("text-right font-bold tabular-nums", l.difference < 0 ? "text-bad" : "text-warn")}>{l.difference > 0 ? "+" : ""}{fmtQ(l.difference)}</td></tr>
                ))}</tbody>
              </table>
            </div>
          )
        )}
      </Modal>
    </div>
  );
}
