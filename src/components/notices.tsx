"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { DatabaseBackup, AlertTriangle, X } from "lucide-react";
import { useMe } from "./me";

/** Días desde el último respaldo (null = nunca) */
export function daysSince(iso: unknown): number | null {
  if (typeof iso !== "string") return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : Math.floor((Date.now() - t) / 86400000);
}

/** Avisos para el administrador: respaldo atrasado y base de datos sin actualizar. */
export function AdminNotices() {
  const { me, can, reload } = useMe();
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    try { setHidden(sessionStorage.getItem("hd369_backup_hidden") === "1"); } catch {}
  }, []);
  if (!me) return null;
  const out: React.ReactNode[] = [];
  if (me.schema_ok === false && can("config.gestionar")) {
    out.push(
      <div key="schema" className="mb-3 flex items-start gap-3 rounded-2xl border border-bad/40 bg-bad/10 p-3 text-sm text-bad no-print">
        <AlertTriangle className="mt-0.5 size-5 shrink-0" />
        <div><b>Falta actualizar la base de datos.</b> Ejecutá en Supabase (SQL Editor) el archivo de actualización más reciente de <code>db/supabase/</code>. Hasta entonces, algunas secciones nuevas no van a funcionar.</div>
      </div>,
    );
  }
  if (can("respaldo.gestionar") && !hidden) {
    const every = Number(me.settings.backup_reminder_days ?? 3) || 3;
    const d = daysSince(me.settings.last_backup_at);
    if (d === null || d >= every) {
      out.push(
        <div key="backup" className="mb-3 flex flex-wrap items-center gap-3 rounded-2xl border border-accent bg-accent/20 p-3 text-sm no-print">
          <DatabaseBackup className="size-5 shrink-0 text-warn" />
          <div className="min-w-0 flex-1">
            <b>{d === null ? "Todavía no hiciste ningún respaldo." : `Hace ${d} días que no hacés un respaldo.`}</b>{" "}
            Se recomienda cada {every} días: si algo le pasa a la base, con el respaldo se recupera todo.
          </div>
          <a href="/api/admin/backup" onClick={() => setTimeout(reload, 2500)} className="rounded-xl bg-brand-black px-3 py-2 font-semibold text-white dark:bg-white dark:text-brand-black">Descargar respaldo</a>
          <Link href="/admin?tab=respaldo" className="font-semibold underline">Ver</Link>
          <button aria-label="Ocultar por hoy" onClick={() => { setHidden(true); try { sessionStorage.setItem("hd369_backup_hidden", "1"); } catch {} }} className="rounded-lg p-1 text-muted hover:bg-black/5"><X className="size-4" /></button>
        </div>,
      );
    }
  }
  return <>{out}</>;
}
