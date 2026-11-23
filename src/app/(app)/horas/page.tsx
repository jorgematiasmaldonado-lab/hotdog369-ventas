"use client";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { LogIn, LogOut, Plus, CalendarOff, Pencil, Trash2, Clock, Download } from "lucide-react";
import { useMe } from "@/components/me";
import { NoAccess } from "@/components/app-shell";
import { Badge, Button, Card, Empty, Field, Input, Loading, Modal, PageTitle, Select, Stat, Tabs, Textarea, cx, useToast } from "@/components/ui";
import { RangePicker, type Range } from "@/components/range-picker";
import { api, fetcher, qs } from "@/lib/client/fetcher";
import { fmtDate, fmtDateTime, fmtTime, DAYS_SHORT } from "@/lib/format";
import { addDays, localDate } from "@/lib/dates";

const OFF: Record<string, { label: string; short: string; tone: "accent" | "good" | "bad" | "warn" | "neutral" }> = {
  franco: { label: "Franco", short: "F", tone: "accent" },
  vacaciones: { label: "Vacaciones", short: "V", tone: "good" },
  enfermedad: { label: "Enfermedad", short: "E", tone: "warn" },
  falta: { label: "Falta", short: "X", tone: "bad" },
  licencia: { label: "Licencia", short: "L", tone: "neutral" },
  otro: { label: "Otro", short: "O", tone: "neutral" },
};
const hrs = (h: number) => {
  const m = Math.round(Number(h) * 60);
  return `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}`;
};
const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

type Entry = { id: number; user_id: number; clock_in: string; clock_out: string | null; source: string; notes: string | null; day: string; hours: number; edited_by_name: string | null };
type Off = { id: number; user_id: number; date: string; type: string; notes: string | null };
type Data = { from: string; to: string; users: { id: number; name: string; role_name: string }[]; entries: Entry[]; off: Off[];
  summary: { user_id: number; name: string; role_name: string; hours: number; days_worked: number; open: boolean; franco: number; vacaciones: number; enfermedad: number; falta: number; licencia: number; otro: number }[] };

export default function HorasPage() {
  const { can, mod } = useMe();
  if (!mod("personal") || !can("horas.fichar", "horas.ver", "horas.gestionar")) return <NoAccess />;
  return (
    <div>
      <PageTitle title="Horas del personal" subtitle="Fichadas de entrada y salida, francos, vacaciones y faltas" />
      {can("horas.fichar") && <MyAttendance />}
      {can("horas.ver", "horas.gestionar") && <Team />}
    </div>
  );
}

function MyAttendance() {
  const toast = useToast();
  const { data, mutate } = useSWR<{ open: { clock_in: string } | null; entries: { id: number; clock_in: string; clock_out: string | null; hours: number; source: string }[]; week: number; month: number; off: Off[] }>("/api/hours/me", fetcher, { refreshInterval: 60000 });
  const [busy, setBusy] = useState(false);
  if (!data) return <Loading />;
  const clock = async (action: "in" | "out") => {
    setBusy(true);
    try { await api("/api/hours/clock", { body: { action } }); toast(action === "in" ? "Entrada fichada" : "Salida fichada"); mutate(); }
    catch (e) { toast((e as Error).message, "bad"); } finally { setBusy(false); }
  };
  return (
    <div className="mb-6 grid gap-4 lg:grid-cols-[360px_1fr]">
      <Card>
        <div className="text-center">
          <Clock className={cx("mx-auto size-10", data.open ? "text-good" : "text-muted")} />
          <div className="mt-2 text-lg font-bold">{data.open ? `Adentro desde las ${fmtTime(data.open.clock_in)}` : "Ahora estás afuera"}</div>
          {data.open && <div className="text-sm text-muted">Llevás {hrs((Date.now() - Date.parse(data.open.clock_in)) / 3600000)}</div>}
          <Button size="xl" className="mt-4 w-full" variant={data.open ? "dark" : "primary"} loading={busy} onClick={() => clock(data.open ? "out" : "in")}>
            {data.open ? <><LogOut className="size-5" />Fichar salida</> : <><LogIn className="size-5" />Fichar entrada</>}
          </Button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Stat label="Esta semana" value={hrs(data.week)} />
          <Stat label="Este mes" value={hrs(data.month)} />
        </div>
      </Card>
      <Card title="Mis últimas fichadas">
        {!data.entries.length && !data.off.length ? <Empty>Todavía no hay fichadas.</Empty> : (
          <div className="-mx-4 divide-y divide-border text-sm">
            {data.off.slice(0, 5).map((o) => (
              <div key={"o" + o.id} className="flex items-center gap-3 px-4 py-2"><span className="w-28 text-muted">{DAYS_SHORT[new Date(o.date + "T12:00:00Z").getUTCDay()]} {fmtDate(o.date)}</span><Badge tone={OFF[o.type]?.tone}>{OFF[o.type]?.label}</Badge></div>
            ))}
            {data.entries.slice(0, 12).map((e) => (
              <div key={e.id} className="flex items-center gap-3 px-4 py-2">
                <span className="w-28 text-muted">{fmtDate(e.clock_in)}</span>
                <span className="flex-1">{fmtTime(e.clock_in)} → {e.clock_out ? fmtTime(e.clock_out) : <Badge tone="good">en curso</Badge>}</span>
                <b className="tabular-nums">{hrs(e.hours)}</b>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function Team() {
  const { can } = useMe();
  const manage = can("horas.gestionar");
  const [range, setRange] = useState<Range>({ range: "mes" });
  const [tab, setTab] = useState<"resumen" | "planilla" | "fichadas">("resumen");
  const { data, mutate } = useSWR<Data>(`/api/hours${qs(range)}`, fetcher, { refreshInterval: 60000 });
  const [entry, setEntry] = useState<Partial<Entry> | null>(null);
  const [off, setOff] = useState<{ user_id?: number; date?: string } | null>(null);
  const toast = useToast();

  const days = useMemo(() => {
    if (!data) return [];
    const out: string[] = [];
    for (let d = data.from; d <= data.to && out.length < 62; d = addDays(d, 1)) out.push(d);
    return out;
  }, [data]);

  const exportCsv = () => {
    if (!data) return;
    const head = ["Empleado", "Horas", "Días trabajados", "Francos", "Vacaciones", "Enfermedad", "Faltas", "Licencias"];
    const rows = data.summary.map((s) => [s.name, s.hours.toFixed(2).replace(".", ","), s.days_worked, s.franco, s.vacaciones, s.enfermedad, s.falta, s.licencia]);
    const csv = "﻿" + [head, ...rows].map((r) => r.join(";")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `hotdog369_horas_${data.from}_a_${data.to}.csv`;
    a.click();
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-2xl uppercase">Equipo</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={exportCsv}><Download className="size-4" />CSV</Button>
          {manage && <Button variant="secondary" size="sm" onClick={() => setOff({})}><CalendarOff className="size-4" />Franco / ausencia</Button>}
          {manage && <Button size="sm" onClick={() => setEntry({})}><Plus className="size-4" />Cargar fichada</Button>}
        </div>
      </div>
      <RangePicker value={range} onChange={setRange} />
      <Tabs className="mb-4" value={tab} onChange={setTab} items={[{ value: "resumen", label: "Resumen" }, { value: "planilla", label: "Planilla por día" }, { value: "fichadas", label: "Fichadas" }]} />
      {!data ? <Loading /> : (
        <>
          {tab === "resumen" && (
            <Card className="overflow-x-auto">
              {!data.summary.length ? <Empty>No hay personal con fichadas.</Empty> : (
                <table className="w-full min-w-[640px] text-sm">
                  <thead><tr className="border-b border-border text-left text-xs uppercase text-muted"><th className="py-2">Empleado</th><th className="text-right">Horas</th><th className="text-right">Días trab.</th><th className="text-right">Francos</th><th className="text-right">Vacac.</th><th className="text-right">Enferm.</th><th className="text-right">Faltas</th></tr></thead>
                  <tbody>{data.summary.map((s) => (
                    <tr key={s.user_id} className="border-b border-border">
                      <td className="py-2 font-semibold">{s.name} {s.open && <Badge tone="good">adentro ahora</Badge>}</td>
                      <td className="text-right font-bold tabular-nums">{hrs(s.hours)}</td><td className="text-right tabular-nums">{s.days_worked}</td>
                      <td className="text-right tabular-nums">{s.franco}</td><td className="text-right tabular-nums">{s.vacaciones}</td><td className="text-right tabular-nums">{s.enfermedad}</td>
                      <td className={cx("text-right tabular-nums", s.falta > 0 && "font-bold text-bad")}>{s.falta}</td>
                    </tr>
                  ))}</tbody>
                </table>
              )}
            </Card>
          )}
          {tab === "planilla" && (
            <Card className="overflow-x-auto">
              <table className="border-separate border-spacing-1 text-xs">
                <thead><tr><th className="sticky left-0 bg-surface pr-2 text-left">Empleado</th>{days.map((d) => (
                  <th key={d} className="min-w-14 font-medium text-muted">{DAYS_SHORT[new Date(d + "T12:00:00Z").getUTCDay()]}<br />{d.slice(8)}/{d.slice(5, 7)}</th>
                ))}</tr></thead>
                <tbody>{data.users.map((u) => (
                  <tr key={u.id}>
                    <th className="sticky left-0 whitespace-nowrap bg-surface pr-2 text-left font-semibold">{u.name}</th>
                    {days.map((d) => {
                      const o = data.off.find((x) => x.user_id === u.id && x.date === d);
                      const h = data.entries.filter((e) => e.user_id === u.id && e.day === d).reduce((a, e) => a + Number(e.hours), 0);
                      return (
                        <td key={d} onClick={() => manage && setOff({ user_id: u.id, date: d })} title={o ? `${OFF[o.type]?.label}${o.notes ? `: ${o.notes}` : ""}` : h ? hrs(h) : manage ? "Cargar franco/ausencia" : ""}
                          className={cx("h-10 rounded-md text-center font-semibold tabular-nums", manage && "cursor-pointer hover:ring-2 hover:ring-primary/40",
                            o ? "bg-accent/30" : h ? "bg-good/15 text-good" : "bg-surface-2 text-muted")}>
                          {o ? OFF[o.type]?.short : h ? `${(Math.round(h * 10) / 10).toString().replace(".", ",")}h` : ""}
                        </td>
                      );
                    })}
                  </tr>
                ))}</tbody>
              </table>
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted">
                {Object.entries(OFF).map(([k, v]) => <span key={k}><b>{v.short}</b> = {v.label}</span>)}
                {manage && <span>· Tocá un día para cargar un franco o ausencia.</span>}
              </div>
            </Card>
          )}
          {tab === "fichadas" && (
            <Card>
              {!data.entries.length && !data.off.length ? <Empty>Sin fichadas en el período.</Empty> : (
                <div className="-mx-4 divide-y divide-border text-sm">
                  {data.off.map((o) => (
                    <div key={"o" + o.id} className="flex items-center gap-3 px-4 py-2">
                      <span className="w-40 shrink-0 font-semibold">{data.users.find((u) => u.id === o.user_id)?.name}</span>
                      <span className="w-28 text-muted">{fmtDate(o.date)}</span>
                      <span className="flex-1"><Badge tone={OFF[o.type]?.tone}>{OFF[o.type]?.label}</Badge> {o.notes}</span>
                      {manage && <button onClick={async () => { try { await api(`/api/hours/off/${o.id}`, { method: "DELETE" }); mutate(); } catch (e) { toast((e as Error).message, "bad"); } }} className="rounded-lg p-1.5 text-muted hover:text-bad" aria-label="Eliminar"><Trash2 className="size-4" /></button>}
                    </div>
                  ))}
                  {[...data.entries].reverse().map((e) => (
                    <div key={e.id} className="flex items-center gap-3 px-4 py-2">
                      <span className="w-40 shrink-0 font-semibold">{data.users.find((u) => u.id === e.user_id)?.name}</span>
                      <span className="w-28 text-muted">{fmtDate(e.clock_in)}</span>
                      <span className="flex-1">{fmtTime(e.clock_in)} → {e.clock_out ? fmtTime(e.clock_out) : <Badge tone="good">en curso</Badge>}
                        {e.source === "manual" && <Badge className="ml-1">manual</Badge>}{e.edited_by_name && <Badge tone="accent" className="ml-1">corregida</Badge>}
                        {e.notes && <span className="ml-1 text-xs text-muted">{e.notes}</span>}</span>
                      <b className="tabular-nums">{hrs(e.hours)}</b>
                      {manage && <button onClick={() => setEntry(e)} className="rounded-lg p-1.5 text-muted hover:bg-surface-2" aria-label="Corregir"><Pencil className="size-4" /></button>}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </>
      )}
      {entry && data && <EntryModal entry={entry} users={data.users} onClose={() => setEntry(null)} onDone={() => mutate()} />}
      {off && data && <OffModal init={off} users={data.users} onClose={() => setOff(null)} onDone={() => mutate()} />}
    </div>
  );
}

function EntryModal({ entry, users, onClose, onDone }: { entry: Partial<Entry>; users: Data["users"]; onClose: () => void; onDone: () => void }) {
  const editing = !!entry.id;
  const [f, setF] = useState({ user_id: entry.user_id ?? users[0]?.id ?? "", clock_in: toLocalInput(entry.clock_in ?? null), clock_out: toLocalInput(entry.clock_out ?? null), notes: entry.notes ?? "" });
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const save = async () => {
    setBusy(true);
    try {
      const body = { user_id: f.user_id, clock_in: new Date(f.clock_in).toISOString(), clock_out: f.clock_out ? new Date(f.clock_out).toISOString() : null, notes: f.notes };
      if (editing) await api(`/api/hours/entries/${entry.id}`, { method: "PUT", body }); else await api("/api/hours/entries", { body });
      toast("Fichada guardada"); onDone(); onClose();
    } catch (e) { toast((e as Error).message, "bad"); } finally { setBusy(false); }
  };
  const del = async () => {
    if (!confirm("¿Eliminar esta fichada?")) return;
    try { await api(`/api/hours/entries/${entry.id}`, { method: "DELETE" }); toast("Fichada eliminada"); onDone(); onClose(); } catch (e) { toast((e as Error).message, "bad"); }
  };
  return (
    <Modal open onClose={onClose} title={editing ? "Corregir fichada" : "Cargar fichada"}
      footer={<div className="flex gap-2">{editing && <Button variant="danger" onClick={del}><Trash2 className="size-4" /></Button>}<Button className="flex-1" loading={busy} disabled={!f.clock_in || !f.user_id} onClick={save}>Guardar</Button></div>}>
      <div className="space-y-3">
        <Field label="Empleado"><Select value={f.user_id} disabled={editing} onChange={(e) => setF({ ...f, user_id: Number(e.target.value) })}>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Entrada"><Input type="datetime-local" value={f.clock_in} onChange={(e) => setF({ ...f, clock_in: e.target.value })} /></Field>
          <Field label="Salida" hint="Vacío = sigue adentro"><Input type="datetime-local" value={f.clock_out} onChange={(e) => setF({ ...f, clock_out: e.target.value })} /></Field>
        </div>
        <Field label="Nota (opcional)"><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="ej: se olvidó de fichar la salida" /></Field>
        <p className="text-xs text-muted">Las correcciones quedan registradas en la auditoría.</p>
      </div>
    </Modal>
  );
}

function OffModal({ init, users, onClose, onDone }: { init: { user_id?: number; date?: string }; users: Data["users"]; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ user_id: init.user_id ?? users[0]?.id ?? "", type: "franco", from: init.date ?? localDate(), to: init.date ?? localDate(), notes: "" });
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  return (
    <Modal open onClose={onClose} title="Franco / ausencia"
      footer={<Button className="w-full" loading={busy} disabled={!f.user_id || f.to < f.from} onClick={async () => {
        setBusy(true);
        try { const r = await api<{ days: number }>("/api/hours/off", { body: f }); toast(`${OFF[f.type].label}: ${r.days} día${r.days === 1 ? "" : "s"} cargado${r.days === 1 ? "" : "s"}`); onDone(); onClose(); }
        catch (e) { toast((e as Error).message, "bad"); } finally { setBusy(false); }
      }}>Guardar</Button>}>
      <div className="space-y-3">
        <Field label="Empleado"><Select value={f.user_id} onChange={(e) => setF({ ...f, user_id: Number(e.target.value) })}>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></Field>
        <Field label="Tipo">
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(OFF).map(([k, v]) => (
              <button key={k} type="button" onClick={() => setF({ ...f, type: k })} className={cx("rounded-xl border py-2.5 text-sm font-semibold", f.type === k ? "border-primary bg-primary text-white" : "border-border bg-surface-2")}>{v.label}</button>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Desde"><Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value, to: e.target.value > f.to ? e.target.value : f.to })} /></Field>
          <Field label="Hasta"><Input type="date" value={f.to} min={f.from} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
        </div>
        <Field label="Nota (opcional)"><Input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="ej: certificado médico" /></Field>
      </div>
    </Modal>
  );
}
