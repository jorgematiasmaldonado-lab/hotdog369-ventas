"use client";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { Plus, Pencil, Trash2, Lock, ShieldCheck } from "lucide-react";
import { useMe } from "@/components/me";
import { NoAccess } from "@/components/app-shell";
import { Badge, Button, Card, Empty, Field, Input, Loading, Modal, MoneyInput, PageTitle, Select, Tabs, Textarea, cx, useToast } from "@/components/ui";
import { CatalogManager } from "./catalog-manager";
import { Respaldo } from "./respaldo";
import { api, fetcher } from "@/lib/client/fetcher";
import { PERMISSIONS, WRITE_PERMISSIONS, type Permission } from "@/lib/permissions";
import { fmtDateTime } from "@/lib/format";

type Tab = "productos" | "catalogos" | "usuarios" | "roles" | "modulos" | "config" | "respaldo" | "auditoria";

export default function AdminPage() {
  const { can } = useMe();
  const tabs = ([
    ["productos", "Productos", can("productos.gestionar")],
    ["catalogos", "Catálogos", can("productos.gestionar")],
    ["usuarios", "Usuarios", can("usuarios.gestionar")],
    ["roles", "Roles y permisos", can("usuarios.gestionar")],
    ["modulos", "Módulos", can("config.gestionar")],
    ["config", "Configuración", can("config.gestionar")],
    ["respaldo", "Respaldo", can("respaldo.gestionar")],
    ["auditoria", "Auditoría", can("auditoria.ver")],
  ] as [Tab, string, boolean][]).filter((t) => t[2]);
  const [tab, setTab] = useState<Tab>(tabs[0]?.[0] ?? "auditoria");
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab") as Tab | null;
    if (t && tabs.some(([v]) => v === t)) setTab(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!tabs.length) return <NoAccess />;
  return (
    <div>
      <PageTitle title="Administración" subtitle="Todo lo configurable del sistema, sin tocar código" />
      <Tabs className="mb-4" value={tab} onChange={setTab} items={tabs.map(([value, label]) => ({ value, label }))} />
      {tab === "productos" && (
        <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
          <CatalogManager entity="products" />
          <CatalogManager entity="categories" />
        </div>
      )}
      {tab === "catalogos" && (
        <div className="grid gap-4 md:grid-cols-2">
          <CatalogManager entity="payment_methods" />
          <CatalogManager entity="shift_types" />
          <CatalogManager entity="void_reasons" />
          <CatalogManager entity="expense_categories" />
        </div>
      )}
      {tab === "usuarios" && <Users />}
      {tab === "roles" && <Roles />}
      {tab === "modulos" && <Modules />}
      {tab === "config" && <Config />}
      {tab === "respaldo" && <Respaldo />}
      {tab === "auditoria" && <Audit />}
    </div>
  );
}

type U = { id: number; name: string; username: string; role_id: number; role_name: string; active: boolean; locked: boolean; hourly_rate?: number | null };
function Users() {
  const { me } = useMe();
  const { data, mutate } = useSWR<{ users: U[]; roles: { id: number; name: string }[] }>("/api/admin/users", fetcher);
  const [editing, setEditing] = useState<U | "new" | null>(null);
  if (!data) return <Loading />;
  return (
    <Card title="Usuarios" action={<Button size="sm" onClick={() => setEditing("new")}><Plus className="size-4" />Nuevo usuario</Button>}>
      <div className="-mx-4 divide-y divide-border">
        {data.users.map((u) => (
          <div key={u.id} className={cx("flex items-center gap-3 px-4 py-3", !u.active && "opacity-50")}>
            <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">{u.name.slice(0, 1)}</div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{u.name} {u.id === me?.user.id && <span className="text-xs text-muted">(vos)</span>}</div>
              <div className="flex flex-wrap gap-1.5 text-xs text-muted"><span>@{u.username}</span><Badge tone="brand">{u.role_name}</Badge>{!u.active && <Badge>Inactivo</Badge>}{u.locked && <Badge tone="bad"><Lock className="size-3" />Bloqueado</Badge>}</div>
            </div>
            <button onClick={() => setEditing(u)} className="rounded-lg p-2 text-muted hover:bg-surface-2" aria-label="Editar"><Pencil className="size-4" /></button>
          </div>
        ))}
      </div>
      {editing && <UserModal user={editing === "new" ? null : editing} roles={data.roles} onClose={() => setEditing(null)} onDone={() => mutate()} />}
    </Card>
  );
}

function UserModal({ user, roles, onClose, onDone }: { user: U | null; roles: { id: number; name: string }[]; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ name: user?.name ?? "", username: user?.username ?? "", pin: "", role_id: user?.role_id ?? roles.find((r) => r.name === "Empleado")?.id ?? roles[0].id, active: user?.active ?? true,
    hourly_rate: user?.hourly_rate != null ? String(user.hourly_rate) : "" });
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const save = async () => {
    setLoading(true);
    try {
      if (user) await api(`/api/admin/users/${user.id}`, { method: "PUT", body: f });
      else await api("/api/admin/users", { body: f });
      toast("Usuario guardado");
      onDone(); onClose();
    } catch (e) {
      toast((e as Error).message, "bad");
    } finally {
      setLoading(false);
    }
  };
  return (
    <Modal open onClose={onClose} title={user ? "Editar usuario" : "Nuevo usuario"} footer={<Button className="w-full" loading={loading} onClick={save}>Guardar</Button>}>
      <div className="space-y-3">
        <Field label="Nombre"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Usuario (para ingresar)"><Input value={f.username} autoCapitalize="none" onChange={(e) => setF({ ...f, username: e.target.value.toLowerCase().trim() })} /></Field>
        <Field label={user ? "Nuevo PIN (dejar vacío para no cambiarlo)" : "PIN (4 a 6 números)"} hint={user ? "Si cambiás el PIN o el rol, se cierran sus sesiones abiertas." : undefined}>
          <Input inputMode="numeric" value={f.pin} onChange={(e) => setF({ ...f, pin: e.target.value.replace(/\D/g, "").slice(0, 6) })} />
        </Field>
        <Field label="Rol"><Select value={f.role_id} onChange={(e) => setF({ ...f, role_id: Number(e.target.value) })}>{roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</Select></Field>
        <Field label="Valor de la hora (opcional)" hint="Se usa para calcular cuánto cobra según las horas fichadas.">
          <MoneyInput value={f.hourly_rate} onChange={(v) => setF({ ...f, hourly_rate: v })} />
        </Field>
        <label className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-3 font-semibold">Activo<input type="checkbox" className="size-5" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /></label>
      </div>
    </Modal>
  );
}

type Role = { id: number; key: string; name: string; description: string | null; permissions: Permission[]; is_system: boolean; users: number };
function Roles() {
  const { data, mutate } = useSWR<Role[]>("/api/admin/roles", fetcher);
  const [editing, setEditing] = useState<Role | "new" | null>(null);
  const toast = useToast();
  if (!data) return <Loading />;
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><Button onClick={() => setEditing("new")}><Plus className="size-4" />Nuevo rol</Button></div>
      <div className="grid gap-3 md:grid-cols-3">
        {data.map((r) => (
          <Card key={r.id} title={<span className="flex items-center gap-2"><ShieldCheck className="size-4 text-primary" />{r.name}</span>}
            action={<div className="flex">
              <button onClick={() => setEditing(r)} className="rounded-lg p-1.5 text-muted hover:bg-surface-2" aria-label="Editar"><Pencil className="size-4" /></button>
              {!r.is_system && <button onClick={async () => { try { await api(`/api/admin/roles/${r.id}`, { method: "DELETE" }); mutate(); } catch (e) { toast((e as Error).message, "bad"); } }} className="rounded-lg p-1.5 text-muted hover:text-bad" aria-label="Eliminar"><Trash2 className="size-4" /></button>}
            </div>}>
            <p className="mb-2 text-sm text-text-2">{r.description}</p>
            <div className="mb-2 text-xs text-muted">{r.users} usuario(s) · {r.permissions.length} permisos</div>
            <div className="flex flex-wrap gap-1">{r.permissions.map((p) => <Badge key={p} tone={WRITE_PERMISSIONS.includes(p) ? "brand" : "neutral"}>{p}</Badge>)}</div>
          </Card>
        ))}
      </div>
      {editing && <RoleModal role={editing === "new" ? null : editing} onClose={() => setEditing(null)} onDone={() => mutate()} />}
    </div>
  );
}

function RoleModal({ role, onClose, onDone }: { role: Role | null; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ name: role?.name ?? "", description: role?.description ?? "", permissions: role?.permissions ?? [] as Permission[] });
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const locked = role?.key === "admin";
  const readOnly = role?.key === "dueno";
  const toggle = (p: Permission) => setF({ ...f, permissions: f.permissions.includes(p) ? f.permissions.filter((x) => x !== p) : [...f.permissions, p] });
  return (
    <Modal open onClose={onClose} size="lg" title={role ? `Rol: ${role.name}` : "Nuevo rol"}
      footer={<Button className="w-full" loading={loading} onClick={async () => {
        setLoading(true);
        try { if (role) await api(`/api/admin/roles/${role.id}`, { method: "PUT", body: f }); else await api("/api/admin/roles", { body: f }); toast("Rol guardado"); onDone(); onClose(); }
        catch (e) { toast((e as Error).message, "bad"); } finally { setLoading(false); }
      }}>Guardar</Button>}>
      <div className="space-y-3">
        <Field label="Nombre"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Descripción"><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        {locked && <p className="rounded-xl bg-accent/25 p-3 text-sm">El Administrador siempre tiene todos los permisos (así nunca se pierde el acceso al panel).</p>}
        {readOnly && <p className="rounded-xl bg-accent/25 p-3 text-sm">Este es el rol de <b>solo lectura</b>: no admite permisos de carga o modificación (marcados en rojo).</p>}
        <div className="grid gap-2 sm:grid-cols-2">
          {(Object.keys(PERMISSIONS) as Permission[]).map((p) => {
            const disabled = locked || (readOnly && WRITE_PERMISSIONS.includes(p));
            return (
              <label key={p} className={cx("flex items-start gap-2 rounded-xl border border-border p-2.5 text-sm", disabled && "opacity-50")}>
                <input type="checkbox" className="mt-0.5 size-4" disabled={disabled} checked={locked || f.permissions.includes(p)} onChange={() => toggle(p)} />
                <span><span className={cx("block font-mono text-xs", WRITE_PERMISSIONS.includes(p) ? "text-primary" : "text-muted")}>{p}</span>{PERMISSIONS[p]}</span>
              </label>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}

function Modules() {
  const { reload } = useMe();
  const { data, mutate } = useSWR<{ key: string; name: string; description: string; enabled: boolean; available: boolean }[]>("/api/admin/modules", fetcher);
  const toast = useToast();
  if (!data) return <Loading />;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {data.map((m) => (
        <div key={m.key} className={cx("flex items-center gap-3 rounded-2xl border border-border bg-surface p-4", !m.available && "opacity-60")}>
          <div className="flex-1">
            <div className="flex items-center gap-2 font-semibold">{m.name}{!m.available && <Badge tone="accent">Próximamente</Badge>}</div>
            <div className="text-sm text-muted">{m.description}</div>
          </div>
          <button disabled={!m.available} onClick={async () => {
            try { await api(`/api/admin/modules/${m.key}`, { method: "PUT", body: { enabled: !m.enabled } }); mutate(); reload(); toast(`${m.name}: ${m.enabled ? "desactivado" : "activado"}`); }
            catch (e) { toast((e as Error).message, "bad"); }
          }} className={cx("relative h-7 w-12 shrink-0 rounded-full transition", m.enabled ? "bg-good" : "bg-border")} aria-label={`Activar ${m.name}`}>
            <span className={cx("absolute top-0.5 size-6 rounded-full bg-white shadow transition", m.enabled ? "left-[22px]" : "left-0.5")} />
          </button>
        </div>
      ))}
    </div>
  );
}

function Config() {
  const { me, reload } = useMe();
  const [f, setF] = useState({ business_name: String(me?.settings.business_name ?? "HOT DOG 369"), fiado_alert_days: Number(me?.settings.fiado_alert_days ?? 15), ticket_footer: String(me?.settings.ticket_footer ?? ""),
    stock_control_on_open: String(me?.settings.stock_control_on_open ?? "obligatorio"), backup_reminder_days: Number(me?.settings.backup_reminder_days ?? 3) });
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  return (
    <Card title="Datos del negocio" className="max-w-xl">
      <div className="space-y-3">
        <Field label="Nombre del negocio"><Input value={f.business_name} onChange={(e) => setF({ ...f, business_name: e.target.value })} /></Field>
        <Field label="Avisar fiados con más de… (días)"><Input type="number" min={1} value={f.fiado_alert_days} onChange={(e) => setF({ ...f, fiado_alert_days: Number(e.target.value) })} /></Field>
        <Field label="Mensaje al pie del ticket"><Input value={f.ticket_footer} onChange={(e) => setF({ ...f, ticket_footer: e.target.value })} /></Field>
        <Field label="Control de stock al abrir el turno" hint="Obligatorio: el empleado no puede vender sin contar. Opcional: puede saltearlo.">
          <Select value={f.stock_control_on_open} onChange={(e) => setF({ ...f, stock_control_on_open: e.target.value })}>
            <option value="obligatorio">Obligatorio</option><option value="opcional">Opcional</option><option value="no">No pedir control</option>
          </Select>
        </Field>
        <Field label="Recordar el respaldo cada… (días)"><Input type="number" min={1} max={30} value={f.backup_reminder_days} onChange={(e) => setF({ ...f, backup_reminder_days: Number(e.target.value) })} /></Field>
        <Button loading={loading} onClick={async () => {
          setLoading(true);
          try { await api("/api/admin/settings", { method: "PUT", body: f }); reload(); toast("Configuración guardada"); } catch (e) { toast((e as Error).message, "bad"); } finally { setLoading(false); }
        }}>Guardar</Button>
      </div>
    </Card>
  );
}

type A = { id: number; at: string; action: string; entity: string; entity_id: string | null; before: unknown; after: unknown; notes: string | null; user_name: string | null };
function Audit() {
  const [entity, setEntity] = useState("");
  const { data } = useSWR<A[]>(`/api/audit${entity ? `?entity=${entity}` : ""}`, fetcher, { refreshInterval: 15000 });
  const [open, setOpen] = useState<number | null>(null);
  return (
    <Card title="Registro de auditoría" action={
      <Select className="h-9 w-44" value={entity} onChange={(e) => setEntity(e.target.value)}>
        <option value="">Todo</option>
        {["venta", "turno", "products", "categories", "payment_methods", "usuario", "rol", "gasto", "fiado", "cliente", "movimiento_caja", "modulo", "configuracion"].map((x) => <option key={x}>{x}</option>)}
      </Select>}>
      {!data ? <Loading /> : !data.length ? <Empty>Sin registros.</Empty> : (
        <div className="-mx-4 divide-y divide-border text-sm">
          {data.map((a) => (
            <div key={a.id} className="px-4 py-2.5">
              <button className="flex w-full items-center gap-3 text-left" onClick={() => setOpen(open === a.id ? null : a.id)}>
                <span className="w-32 shrink-0 text-xs text-muted">{fmtDateTime(a.at)}</span>
                <Badge tone={a.action === "anular" || a.action === "eliminar" ? "bad" : a.action === "editar" ? "accent" : "neutral"}>{a.action}</Badge>
                <span className="min-w-0 flex-1 truncate"><b>{a.entity}</b>{a.entity_id && ` · ${a.entity_id.slice(0, 8)}`}{a.notes && ` · ${a.notes}`}</span>
                <span className="text-xs text-muted">{a.user_name}</span>
              </button>
              {open === a.id && (a.before != null || a.after != null) && (
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  <pre className="overflow-x-auto rounded-lg bg-surface-2 p-2 text-xs">Antes: {JSON.stringify(a.before, null, 1)}</pre>
                  <pre className="overflow-x-auto rounded-lg bg-surface-2 p-2 text-xs">Después: {JSON.stringify(a.after, null, 1)}</pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
