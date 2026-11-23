"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  ShoppingCart, LayoutDashboard, Receipt, Users, Wallet, BarChart3, Settings, Clock, LogOut, MoreHorizontal, WifiOff, RefreshCw, Info, AlertTriangle, Boxes, UserRoundCheck,
} from "lucide-react";
import { useMe } from "./me";
import { ThemeToggle } from "./theme-toggle";
import { AdminNotices } from "./notices";
import { cx, Modal, Button } from "./ui";
import { useOnline, useQueue, syncQueue, clearFailed } from "@/lib/client/offline";
import { ars, fmtDateTime } from "@/lib/format";
import type { Permission } from "@/lib/permissions";

type NavItem = { href: string; label: string; icon: ReactNode; perms: Permission[]; module?: string };
const NAV: NavItem[] = [
  { href: "/vender", label: "Vender", icon: <ShoppingCart className="size-5" />, perms: ["ventas.crear"] },
  { href: "/dashboard", label: "Panel", icon: <LayoutDashboard className="size-5" />, perms: ["dashboard.ver"] },
  { href: "/turno", label: "Mi turno", icon: <Clock className="size-5" />, perms: ["turnos.operar"] },
  { href: "/ventas", label: "Ventas", icon: <Receipt className="size-5" />, perms: ["ventas.ver_todas"] },
  { href: "/stock", label: "Stock", icon: <Boxes className="size-5" />, perms: ["stock.ver", "stock.gestionar"], module: "stock" },
  { href: "/fiados", label: "Fiados", icon: <Users className="size-5" />, perms: ["fiados.ver", "fiados.gestionar"], module: "fiados" },
  { href: "/gastos", label: "Gastos", icon: <Wallet className="size-5" />, perms: ["gastos.ver", "gastos.gestionar"], module: "gastos" },
  { href: "/reportes", label: "Reportes", icon: <BarChart3 className="size-5" />, perms: ["reportes.ver"] },
  { href: "/turnos", label: "Turnos", icon: <Clock className="size-5" />, perms: ["turnos.ver_todos"] },
  { href: "/horas", label: "Horas", icon: <UserRoundCheck className="size-5" />, perms: ["horas.fichar", "horas.ver", "horas.gestionar"], module: "personal" },
  { href: "/admin", label: "Administración", icon: <Settings className="size-5" />, perms: ["productos.gestionar", "usuarios.gestionar", "config.gestionar", "auditoria.ver", "respaldo.gestionar"] },
];

function SyncBadge() {
  const online = useOnline();
  const { pending, failed } = useQueue();
  const [open, setOpen] = useState(false);
  if (online && !pending.length && !failed.length) return null;
  return (
    <>
      <button onClick={() => setOpen(true)}
        className={cx("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold",
          failed.length ? "bg-bad text-white" : online ? "bg-accent text-brand-black" : "bg-white/15 text-white")}>
        {online ? <RefreshCw className="size-3.5" /> : <WifiOff className="size-3.5" />}
        {!online ? "Sin conexión" : failed.length ? `${failed.length} con error` : "Sincronizando"}
        {pending.length > 0 && <span className="rounded-full bg-black/20 px-1.5">{pending.length}</span>}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Ventas guardadas en este dispositivo">
        <p className="mb-3 text-sm text-text-2">
          {online ? "Hay conexión: las ventas pendientes se envían automáticamente." : "Sin conexión a internet. Podés seguir vendiendo: las ventas se guardan acá y se envían solas cuando vuelva la conexión."}
        </p>
        <div className="space-y-2">
          {pending.map((p, i) => (
            <div key={i} className="flex justify-between rounded-xl bg-surface-2 px-3 py-2 text-sm">
              <span>Pendiente · {fmtDateTime(p.queued_at)}</span>
              <span className="font-semibold">{ars((p.input.payments as { amount: number }[] | undefined)?.reduce((a, x) => a + x.amount, 0))}</span>
            </div>
          ))}
          {failed.map((p, i) => (
            <div key={"f" + i} className="rounded-xl border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">
              <div className="flex justify-between font-semibold"><span>No se pudo registrar · {fmtDateTime(p.queued_at)}</span><span>{ars((p.input.payments as { amount: number }[] | undefined)?.reduce((a, x) => a + x.amount, 0))}</span></div>
              <div>{p.error}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          {online && pending.length > 0 && <Button onClick={() => syncQueue()}><RefreshCw className="size-4" />Enviar ahora</Button>}
          {failed.length > 0 && <Button variant="secondary" onClick={() => clearFailed()}>Descartar con error</Button>}
        </div>
      </Modal>
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { me, can, mod } = useMe();
  const path = usePathname();
  const router = useRouter();
  const [more, setMore] = useState(false);
  useEffect(() => setMore(false), [path]);
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  const items = NAV.filter((n) => can(...n.perms) && (!n.module || mod(n.module)));
  const primary = items.slice(0, 4);
  const extra = items.slice(4);
  const isActive = (href: string) => path === href || path.startsWith(href + "/");

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  };

  return (
    <div className="min-h-dvh lg:pl-64">
      {/* Barra lateral (escritorio) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-[var(--header-bg)] text-white lg:flex no-print">
        <Link href="/" className="flex items-center gap-3 px-5 py-5">
          <Image src="/brand/logo-hotdog369.png" alt="HOT DOG 369" width={52} height={52} priority />
          <div>
            <div className="font-display text-xl leading-none tracking-wide">HOT DOG <span className="text-brand-yellow">369</span></div>
            <div className="text-xs text-white/60">Panchería · Cafetería</div>
          </div>
        </Link>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          {items.map((n) => (
            <Link key={n.href} href={n.href}
              className={cx("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition",
                isActive(n.href) ? "bg-brand-red text-white" : "text-white/75 hover:bg-white/10 hover:text-white")}>
              {n.icon}{n.label}
            </Link>
          ))}
          <Link href="/acerca" className={cx("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold", isActive("/acerca") ? "bg-brand-red" : "text-white/60 hover:bg-white/10")}>
            <Info className="size-5" />Acerca de
          </Link>
        </nav>
        <div className="border-t border-white/10 p-4">
          <div className="mb-3 text-sm">
            <div className="font-semibold">{me?.user.name}</div>
            <div className="text-xs text-brand-yellow">{me?.user.role.name}</div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button onClick={logout} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2.5 text-sm font-semibold hover:bg-white/20">
              <LogOut className="size-4" />Salir
            </button>
          </div>
          <a href="/acerca" className="mt-4 flex items-center gap-2 opacity-60 hover:opacity-100">
            <Image src="/brand/jmm-mark.png" alt="JMM" width={36} height={23} className="rounded" />
            <span className="text-[11px] leading-tight text-white/70">Desarrollado por<br />JMM Gestiones &amp; Tecnología</span>
          </a>
        </div>
      </aside>

      {/* Encabezado (celular / tablet) */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-2 bg-[var(--header-bg)] px-3 py-2 text-white lg:hidden no-print" style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}>
        <Link href="/" className="flex items-center gap-2">
          <Image src="/brand/logo-hotdog369.png" alt="HOT DOG 369" width={40} height={40} priority />
          <span className="font-display text-lg tracking-wide">HOT DOG <span className="text-brand-yellow">369</span></span>
        </Link>
        <div className="flex items-center gap-1">
          <SyncBadge />
          <ThemeToggle />
          <button onClick={logout} className="rounded-xl p-2.5 text-white/80 hover:bg-white/10" aria-label="Salir"><LogOut className="size-5" /></button>
        </div>
      </header>

      {/* Estado de sincronización (escritorio) */}
      <div className="fixed right-4 top-4 z-40 hidden lg:block no-print"><SyncBadge /></div>

      <main className="mx-auto max-w-7xl px-3 pb-28 pt-4 sm:px-5 lg:pb-10 lg:pt-6"><AdminNotices />{children}</main>

      {/* Navegación inferior (celular) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur lg:hidden safe-bottom no-print">
        <div className="mx-auto flex max-w-lg">
          {primary.map((n) => (
            <Link key={n.href} href={n.href} className={cx("flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold",
              isActive(n.href) ? "text-primary" : "text-muted")}>
              {n.icon}{n.label}
            </Link>
          ))}
          <button onClick={() => setMore(true)} className={cx("flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold",
            extra.some((n) => isActive(n.href)) ? "text-primary" : "text-muted")}>
            <MoreHorizontal className="size-5" />Más
          </button>
        </div>
      </nav>
      <Modal open={more} onClose={() => setMore(false)} title={<span>{me?.user.name} · <span className="text-primary">{me?.user.role.name}</span></span>}>
        <div className="grid grid-cols-2 gap-2">
          {[...extra, { href: "/acerca", label: "Acerca de", icon: <Info className="size-5" />, perms: [] }].map((n) => (
            <Link key={n.href} href={n.href} className="flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-3 py-3 font-semibold">
              {n.icon}{n.label}
            </Link>
          ))}
        </div>
      </Modal>
    </div>
  );
}

export function NoAccess() {
  return (
    <div className="mx-auto mt-16 max-w-sm text-center text-muted">
      <AlertTriangle className="mx-auto mb-2 size-8" />
      No tenés permiso para ver esta sección.
    </div>
  );
}
