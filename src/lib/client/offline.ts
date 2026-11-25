"use client";
// Cola de ventas sin conexión: si se corta internet la venta se guarda en el dispositivo
// y se envía sola cuando vuelve la conexión (el id generado en el dispositivo evita duplicados).
import { useEffect, useState, useSyncExternalStore } from "react";

const QUEUE_KEY = "hd369_queue";
const FAILED_KEY = "hd369_failed";
export const CATALOG_KEY = "hd369_catalog";
export const SHIFT_KEY = "hd369_shift";

type Queued = { input: Record<string, unknown>; queued_at: string };
type Failed = Queued & { error: string };

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function read<T>(key: string): T[] {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "[]") as T[];
  } catch {
    return [];
  }
}
function write(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* almacenamiento lleno o bloqueado */
  }
  emit();
}

export function cacheGet<T>(key: string): T | undefined {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : undefined;
  } catch {
    return undefined;
  }
}
export function cacheSet(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {}
}

export type SubmitResult = { queued: true } | { queued: false; number: number; change: number | null; total: number; charged?: number };

/** Envía la venta; si no hay conexión la guarda para enviarla después. */
export async function submitSale(input: Record<string, unknown>, allowOffline: boolean): Promise<SubmitResult> {
  try {
    const res = await fetch("/api/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      credentials: "same-origin",
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      location.href = "/login";
      throw new Error("Sesión vencida");
    }
    if (!res.ok) throw Object.assign(new Error(data.error ?? "Error al registrar la venta"), { http: true });
    return { queued: false, number: data.number, change: data.change ?? null, total: data.total };
  } catch (e) {
    if ((e as { http?: boolean }).http || !allowOffline) throw e;
    // error de red → guardar en la cola
    const q = read<Queued>(QUEUE_KEY);
    q.push({ input: { ...input, offline: true, created_at: new Date().toISOString() }, queued_at: new Date().toISOString() });
    write(QUEUE_KEY, q);
    return { queued: true };
  }
}

let syncing = false;
export async function syncQueue() {
  if (syncing || typeof navigator === "undefined" || !navigator.onLine) return;
  syncing = true;
  try {
    let q = read<Queued>(QUEUE_KEY);
    while (q.length) {
      const item = q[0];
      let res: Response;
      try {
        res = await fetch("/api/sales", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item.input),
          credentials: "same-origin",
        });
      } catch {
        break; // sigue sin conexión
      }
      if (res.status === 401 || res.status >= 500) break; // reintentar más tarde
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        write(FAILED_KEY, [...read<Failed>(FAILED_KEY), { ...item, error: data.error ?? `Error ${res.status}` }]);
      }
      q = read<Queued>(QUEUE_KEY).slice(1);
      write(QUEUE_KEY, q);
    }
  } finally {
    syncing = false;
  }
}

export function clearFailed() {
  write(FAILED_KEY, []);
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => (e.key === QUEUE_KEY || e.key === FAILED_KEY) && cb();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function useQueue() {
  const pending = useSyncExternalStore(subscribe, () => localStorage.getItem(QUEUE_KEY) ?? "[]", () => "[]");
  const failed = useSyncExternalStore(subscribe, () => localStorage.getItem(FAILED_KEY) ?? "[]", () => "[]");
  return { pending: JSON.parse(pending) as Queued[], failed: JSON.parse(failed) as Failed[] };
}

export function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => {
      setOnline(true);
      syncQueue();
    };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    const t = setInterval(syncQueue, 20000);
    syncQueue();
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      clearInterval(t);
    };
  }, []);
  return online;
}

export function uuid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
    (+c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (+c / 4)))).toString(16),
  );
}
