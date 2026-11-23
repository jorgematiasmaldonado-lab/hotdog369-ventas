"use client";
import { useRef, useState } from "react";
import { DatabaseBackup, Download, Upload, ShieldCheck, AlertTriangle } from "lucide-react";
import { useMe } from "@/components/me";
import { daysSince } from "@/components/notices";
import { Button, Card, Field, Input, Modal, cx, useToast } from "@/components/ui";
import { fmtDateTime, int } from "@/lib/format";

export function Respaldo() {
  const { me, reload } = useMe();
  const toast = useToast();
  const last = me?.settings.last_backup_at as string | undefined;
  const every = Number(me?.settings.backup_reminder_days ?? 3) || 3;
  const d = daysSince(last);
  const late = d === null || d >= every;
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ created_at: string; counts: Record<string, number> } | null>(null);

  const restore = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/backup/restore", { method: "POST", headers: { "Content-Type": "application/octet-stream", "x-confirmar": "RESTAURAR" }, body: file });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) { location.href = "/login"; return; }
      if (!res.ok) throw new Error(data.error ?? "No se pudo restaurar");
      setResult(data); setFile(null); setConfirm(""); reload();
      toast("Respaldo restaurado");
    } catch (e) {
      toast((e as Error).message, "bad");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title={<span className="flex items-center gap-2"><DatabaseBackup className="size-5 text-primary" />Descargar respaldo</span>}>
        <div className={cx("mb-4 rounded-xl p-4", late ? "bg-accent/25" : "bg-good/10")}>
          <div className="text-sm text-text-2">Último respaldo</div>
          <div className="text-xl font-bold">{last ? fmtDateTime(last) : "Nunca"}</div>
          <div className={cx("text-sm font-semibold", late ? "text-warn" : "text-good")}>
            {d === null ? "Hacé el primero ahora." : d === 0 ? "Hoy · al día ✓" : late ? `Hace ${d} días: conviene hacer uno` : `Hace ${d} día${d === 1 ? "" : "s"} · al día ✓`}
          </div>
        </div>
        <p className="mb-4 text-sm text-text-2">
          Descarga un archivo con <b>todos los datos</b>: ventas, turnos, fiados, gastos, stock, horas, productos, usuarios y configuración.
          Se recomienda hacerlo <b>cada {every} días</b> y guardarlo en un lugar seguro (Google Drive, un pendrive o el mail).
        </p>
        <a href="/api/admin/backup" onClick={() => setTimeout(reload, 2500)}>
          <Button size="lg" className="w-full"><Download className="size-5" />Descargar respaldo ahora</Button>
        </a>
      </Card>

      <Card title={<span className="flex items-center gap-2"><Upload className="size-5 text-primary" />Restaurar un respaldo</span>}>
        <div className="mb-4 flex gap-2 rounded-xl border border-bad/30 bg-bad/10 p-3 text-sm text-bad">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" />
          <span>Restaurar <b>reemplaza todos los datos actuales</b> por los del respaldo. Lo cargado después de esa fecha se pierde. Usalo solo si se perdió o se dañó la información.</span>
        </div>
        <input ref={fileRef} type="file" accept=".gz,.json,application/gzip,application/json" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <Button variant="secondary" className="w-full" onClick={() => fileRef.current?.click()}>
          <Upload className="size-4" />{file ? file.name : "Elegir archivo de respaldo (.json.gz)"}
        </Button>
        {file && (
          <div className="mt-4 space-y-3">
            <Field label='Para confirmar, escribí RESTAURAR'><Input value={confirm} onChange={(e) => setConfirm(e.target.value.toUpperCase())} placeholder="RESTAURAR" /></Field>
            <Button variant="danger" className="w-full" size="lg" disabled={confirm !== "RESTAURAR"} loading={busy} onClick={restore}>Restaurar y reemplazar todo</Button>
          </div>
        )}
      </Card>

      <Modal open={!!result} onClose={() => setResult(null)} title="Respaldo restaurado">
        {result && (
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 font-semibold text-good"><ShieldCheck className="size-5" />Datos restaurados del respaldo del {fmtDateTime(result.created_at)}</div>
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-3">
              {[["sales", "Ventas"], ["shifts", "Turnos"], ["customers", "Clientes"], ["expenses", "Gastos"], ["products", "Productos"], ["users", "Usuarios"], ["stock_items", "Artículos de stock"], ["time_entries", "Fichadas"]].map(([k, l]) => (
                <div key={k} className="flex justify-between"><span>{l}</span><b>{int(result.counts[k] ?? 0)}</b></div>
              ))}
            </div>
            <p className="text-muted">Si cambiaron los usuarios, puede que tengas que volver a ingresar.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
