"use client";
import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, BellRing, Smartphone, X } from "lucide-react";
import { Button, useToast } from "./ui";
import { api } from "@/lib/client/fetcher";

function keyToBytes(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

type State = "loading" | "unsupported" | "ios-install" | "denied" | "off" | "on";

/** Estado y acciones de las notificaciones de este equipo */
export function usePush() {
  const [state, setState] = useState<State>("loading");
  const refresh = useCallback(async () => {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setState(ios && !standalone ? "ios-install" : "unsupported");
      return;
    }
    if (Notification.permission === "denied") return setState("denied");
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    setState(sub && Notification.permission === "granted" ? "on" : "off");
  }, []);
  useEffect(() => { refresh().catch(() => setState("unsupported")); }, [refresh]);

  const enable = async () => {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") { await refresh(); throw new Error(perm === "denied" ? "Bloqueaste las notificaciones. Activalas desde la configuración del navegador." : "No se activaron las notificaciones."); }
    const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
    await navigator.serviceWorker.ready;
    const { publicKey } = await api<{ publicKey: string }>("/api/push");
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(publicKey) }));
    await api("/api/push", { body: { subscription: sub.toJSON() } });
    await refresh();
  };
  const disable = async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) { await api("/api/push", { method: "DELETE", body: { endpoint: sub.endpoint } }).catch(() => {}); await sub.unsubscribe(); }
    await refresh();
  };
  const test = () => api<{ devices: number; sent: number }>("/api/push/test", { body: {} });
  return { state, enable, disable, test };
}

/** Botón compacto (pantalla de Stock) */
export function PushButton() {
  const { state, enable, disable, test } = usePush();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    try { await fn(); if (ok) toast(ok); } catch (e) { toast((e as Error).message, "bad"); } finally { setBusy(false); }
  };
  if (state === "loading" || state === "unsupported") return null;
  if (state === "ios-install") return <Button variant="secondary" onClick={() => toast("En iPhone: compartir → “Agregar a inicio”, y abrí la app desde ese ícono para activar los avisos.", "info")}><Smartphone className="size-4" />Avisos en iPhone</Button>;
  if (state === "denied") return <Button variant="secondary" onClick={() => toast("Las notificaciones están bloqueadas para este sitio. Habilitalas desde la configuración del navegador.", "info")}><BellOff className="size-4" />Avisos bloqueados</Button>;
  if (state === "off") return <Button variant="secondary" loading={busy} onClick={() => run(enable, "Avisos activados en este equipo")}><Bell className="size-4" />Activar avisos de stock</Button>;
  return (
    <div className="flex gap-1">
      <Button variant="secondary" loading={busy} onClick={() => run(async () => { const r = await test(); if (!r.sent) throw new Error("No se pudo enviar el aviso de prueba."); }, "Aviso de prueba enviado")}><BellRing className="size-4 text-good" />Avisos activados · probar</Button>
      <Button variant="ghost" onClick={() => run(disable, "Avisos desactivados en este equipo")} aria-label="Desactivar avisos"><BellOff className="size-4" /></Button>
    </div>
  );
}

/** Invitación a activar los avisos (Panel), se puede cerrar */
export function PushInvite() {
  const { state, enable } = usePush();
  const toast = useToast();
  const [hidden, setHidden] = useState(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => { try { setHidden(localStorage.getItem("hd369_push_invite") === "no"); } catch { setHidden(false); } }, []);
  if (hidden || !["off", "ios-install"].includes(state)) return null;
  const close = () => { setHidden(true); try { localStorage.setItem("hd369_push_invite", "no"); } catch {} };
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface p-3 text-sm no-print">
      <Bell className="size-5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <b>¿Querés enterarte cuando algo se esté por acabar?</b>{" "}
        {state === "ios-install" ? "En iPhone, agregá la app a la pantalla de inicio (compartir → “Agregar a inicio”) y abrila desde ahí para activar los avisos." : "Activá los avisos de stock bajo en este equipo: llegan aunque la app esté cerrada."}
      </div>
      {state === "off" && <Button size="sm" loading={busy} onClick={async () => { setBusy(true); try { await enable(); toast("Avisos activados en este equipo"); } catch (e) { toast((e as Error).message, "bad"); } finally { setBusy(false); } }}>Activar avisos</Button>}
      <button onClick={close} className="rounded-lg p-1 text-muted hover:bg-surface-2" aria-label="No mostrar más"><X className="size-4" /></button>
    </div>
  );
}
