"use client";
import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Delete, Loader2 } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (p = pin) => {
    if (!username || p.length < 4) return;
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, pin: p }) });
    if (res.ok) {
      router.replace("/");
      router.refresh();
    } else {
      setError((await res.json().catch(() => ({}))).error ?? "No se pudo ingresar");
      setPin("");
      setLoading(false);
    }
  };
  const press = (d: string) => {
    if (loading) return;
    const p = (pin + d).slice(0, 6);
    setPin(p);
  };

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-between bg-brand-black px-4 py-8 text-white">
      <div className="absolute right-3 top-3"><ThemeToggle /></div>
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <Image src="/brand/logo-hotdog369.png" alt="HOT DOG 369" width={150} height={150} priority className="drop-shadow-xl" />
          <h1 className="mt-3 font-display text-4xl tracking-wide">HOT DOG <span className="text-brand-yellow">369</span></h1>
          <p className="text-sm text-white/60">Control de ventas · Panchería y Cafetería</p>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="rounded-3xl bg-white p-5 text-brand-black shadow-2xl dark:bg-[#181D20] dark:text-white">
          <label className="mb-1 block text-sm font-semibold">Usuario</label>
          <input value={username} onChange={(e) => setUsername(e.target.value.trim())} autoCapitalize="none" autoComplete="username" autoFocus
            className="mb-4 h-12 w-full rounded-xl border border-black/15 bg-transparent px-3 outline-none focus:border-brand-red dark:border-white/15" placeholder="ej: empleado" />
          <label className="mb-1 block text-sm font-semibold">PIN</label>
          <div className="mb-3 flex h-12 items-center justify-center gap-3 rounded-xl bg-black/5 dark:bg-white/5" aria-label="PIN">
            {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
              <span key={i} className={`size-3.5 rounded-full ${i < pin.length ? "bg-brand-red" : "bg-black/20 dark:bg-white/20"}`} />
            ))}
          </div>
          <input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="sr-only" aria-label="PIN" autoComplete="current-password" />
          <div className="grid grid-cols-3 gap-2">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
              <button type="button" key={d} onClick={() => press(d)} className="h-14 rounded-xl bg-black/5 text-xl font-bold active:bg-brand-red active:text-white dark:bg-white/10">{d}</button>
            ))}
            <button type="button" onClick={() => setPin(pin.slice(0, -1))} className="flex h-14 items-center justify-center rounded-xl bg-black/5 dark:bg-white/10" aria-label="Borrar"><Delete className="size-6" /></button>
            <button type="button" onClick={() => press("0")} className="h-14 rounded-xl bg-black/5 text-xl font-bold active:bg-brand-red active:text-white dark:bg-white/10">0</button>
            <button type="submit" disabled={loading || pin.length < 4 || !username} className="flex h-14 items-center justify-center rounded-xl bg-brand-red text-lg font-bold text-white disabled:opacity-40">
              {loading ? <Loader2 className="size-6 animate-spin" /> : "Entrar"}
            </button>
          </div>
          {error && <p className="mt-3 rounded-xl bg-red-600/10 p-2 text-center text-sm font-semibold text-red-600 dark:text-red-400">{error}</p>}
        </form>
      </div>
      <div className="mt-8 flex flex-col items-center gap-2 text-center">
        <Image src="/brand/jmm-logo.png" alt="JMM Gestiones & Tecnología" width={140} height={77} className="rounded-lg opacity-90" />
        <span className="text-[11px] text-white/50">Desarrollado por JMM Gestiones &amp; Tecnología</span>
      </div>
    </div>
  );
}
