"use client";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { Search, Minus, Plus, Trash2, ShoppingCart, ChevronUp, Clock, Ban, Banknote, Split, UserRound, CheckCircle2, WifiOff } from "lucide-react";
import { useMe } from "@/components/me";
import { NoAccess } from "@/components/app-shell";
import { Button, Card, Field, Input, Loading, Modal, MoneyInput, Select, cx, useToast } from "@/components/ui";
import { VoidModal } from "@/components/void-modal";
import { StockCount } from "@/components/stock-count";
import { CustomerPicker, type PickedCustomer } from "@/components/customer-picker";
import { api, fetcher } from "@/lib/client/fetcher";
import { cacheGet, cacheSet, CATALOG_KEY, SHIFT_KEY, submitSale, uuid, useOnline } from "@/lib/client/offline";
import type { Catalog, PaymentMethod, Product, SaleRow } from "@/lib/client/types";
import { ars, fmtTime } from "@/lib/format";
import { minutesSinceStart, fmtMinutes, localClock } from "@/lib/dates";
import { surchargeFor, fmtPct } from "@/lib/surcharge";

type CartLine = { product: Product; qty: number };
type ShiftInfo = { blind?: boolean; shift: { id: number; opened_at: string; shift_type_name: string | null; opening_cash: number }; totals: { sales_count: number; sales_total?: number } } | null;
type Opening = { next: number | null; editable: boolean; managed: boolean };
type CurrentShift = { shift: ShiftInfo; stock_check?: { required: boolean; mode: string }; hours?: { enabled: boolean; clocked_in: boolean }; opening?: Opening };

export default function VenderPage() {
  const { can, mod } = useMe();
  const online = useOnline();
  const toast = useToast();

  const { data: catalog } = useSWR<Catalog>("/api/catalog", fetcher, {
    fallbackData: typeof window !== "undefined" ? cacheGet<Catalog>(CATALOG_KEY) : undefined,
    onSuccess: (d) => cacheSet(CATALOG_KEY, d),
    revalidateOnFocus: true,
  });
  const { data: cur, mutate: refreshShift, error: shiftErr } = useSWR<CurrentShift>("/api/shifts/current", fetcher, {
    fallbackData: typeof window !== "undefined" ? cacheGet<CurrentShift>(SHIFT_KEY) : undefined,
    onSuccess: (d) => cacheSet(SHIFT_KEY, d),
    refreshInterval: 15000,
  });
  const { data: recent, mutate: refreshRecent } = useSWR<{ sales: SaleRow[] }>("/api/sales?scope=turno&limit=30", fetcher, { refreshInterval: 15000 });

  const [cat, setCat] = useState<number | "all">("all");
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [success, setSuccess] = useState<{ number?: number; change: number | null; queued: boolean; total: number } | null>(null);
  const [voiding, setVoiding] = useState<SaleRow | null>(null);
  const [skipCount, setSkipCount] = useState<number | null>(null);
  useEffect(() => {
    try { setSkipCount(Number(sessionStorage.getItem("hd369_skip_count")) || null); } catch {}
  }, []);

  useEffect(() => {
    if (catalog && cat === "all" && catalog.categories.length) setCat(catalog.categories[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog?.categories.length]);

  const products = useMemo(() => {
    const list = catalog?.products ?? [];
    if (q.trim()) return list.filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase()));
    return cat === "all" ? list : list.filter((p) => p.category_id === cat);
  }, [catalog, cat, q]);

  const total = cart.reduce((a, l) => a + l.product.price * l.qty, 0);
  const units = cart.reduce((a, l) => a + l.qty, 0);
  const qtyOf = (id: number) => cart.find((l) => l.product.id === id)?.qty ?? 0;

  const add = (p: Product, d = 1) => {
    setCart((c) => {
      const ex = c.find((l) => l.product.id === p.id);
      if (!ex) return d > 0 ? [...c, { product: p, qty: d }] : c;
      const qty = ex.qty + d;
      return qty <= 0 ? c.filter((l) => l.product.id !== p.id) : c.map((l) => (l.product.id === p.id ? { ...l, qty } : l));
    });
    if (d > 0 && "vibrate" in navigator) navigator.vibrate?.(15);
  };

  if (!can("ventas.crear")) return <NoAccess />;
  if (!catalog || (!cur && !shiftErr)) return <Loading />;

  const shift = cur?.shift ?? null;
  if (!shift) return <OpenShift catalog={catalog} hours={cur?.hours} opening={cur?.opening} onOpened={() => refreshShift()} />;
  const sc = cur?.stock_check;
  if (sc?.required && online && skipCount !== shift.shift.id)
    return <StockCount mode={sc.mode} onDone={() => refreshShift()}
      onSkip={() => { setSkipCount(shift.shift.id); try { sessionStorage.setItem("hd369_skip_count", String(shift.shift.id)); } catch {} }} />;

  const done = (r: { number?: number; change: number | null; queued: boolean; total: number }) => {
    setCart([]);
    setCheckout(false);
    setCartOpen(false);
    setSuccess(r);
    if ("vibrate" in navigator) navigator.vibrate?.([30, 40, 30]);
    refreshRecent();
    refreshShift();
    setTimeout(() => setSuccess((s) => (s === r && r.change == null ? null : s)), 1600);
  };

  const cartPanel = (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-2 overflow-y-auto">
        {cart.length === 0 && <div className="py-10 text-center text-sm text-muted"><ShoppingCart className="mx-auto mb-2 size-8 opacity-40" />Tocá un producto para agregarlo</div>}
        {cart.map((l) => (
          <div key={l.product.id} className="flex items-center gap-2 rounded-xl bg-surface-2 p-2">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{l.product.name}</div>
              <div className="text-xs text-muted">{ars(l.product.price)} c/u</div>
            </div>
            <button onClick={() => add(l.product, -1)} className="flex size-9 items-center justify-center rounded-lg bg-surface border border-border" aria-label="Quitar uno"><Minus className="size-4" /></button>
            <span className="w-6 text-center font-bold tabular-nums">{l.qty}</span>
            <button onClick={() => add(l.product, 1)} className="flex size-9 items-center justify-center rounded-lg bg-surface border border-border" aria-label="Agregar uno"><Plus className="size-4" /></button>
            <div className="w-20 text-right text-sm font-bold tabular-nums">{ars(l.product.price * l.qty)}</div>
          </div>
        ))}
      </div>
      {cart.length > 0 && (
        <button onClick={() => setCart([])} className="mt-2 flex items-center justify-center gap-1 py-2 text-sm font-semibold text-muted hover:text-bad">
          <Trash2 className="size-4" />Vaciar
        </button>
      )}
      <div className="mt-2 border-t border-border pt-3">
        <div className="mb-3 flex items-end justify-between">
          <span className="text-sm font-semibold text-muted">TOTAL · {units} u.</span>
          <span className="text-3xl font-extrabold tabular-nums">{ars(total)}</span>
        </div>
        <Button size="xl" className="w-full text-xl" disabled={!cart.length} onClick={() => setCheckout(true)}>COBRAR</Button>
      </div>
    </div>
  );

  return (
    <div className="lg:grid lg:grid-cols-[1fr_360px] lg:gap-5">
      <div>
        {/* Info del turno */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-brand-black px-4 py-3 text-white dark:bg-surface-2 dark:text-text">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="size-4 text-brand-yellow" />
            <span>Turno <b>{shift.shift.shift_type_name ?? ""}</b> desde {fmtTime(shift.shift.opened_at)}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span><b className="tabular-nums">{shift.totals.sales_count}</b> ventas{shift.totals.sales_total != null && <> · <b className="tabular-nums text-brand-yellow">{ars(shift.totals.sales_total)}</b></>}</span>
            <Link href="/turno" className="rounded-lg bg-white/10 px-2.5 py-1 font-semibold hover:bg-white/20">Cerrar turno</Link>
          </div>
        </div>
        {!online && (
          <div className="mb-3 flex items-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-brand-black">
            <WifiOff className="size-4" />Sin conexión: {mod("sin_conexion") ? "las ventas se guardan en el equipo y se envían al volver internet." : "el modo sin conexión está desactivado."}
          </div>
        )}

        {/* Categorías + búsqueda */}
        <div className="sticky top-14 z-20 -mx-3 mb-3 bg-bg/95 px-3 py-2 backdrop-blur lg:top-0 lg:mx-0 lg:px-0">
          <div className="flex gap-2">
            <div className="flex flex-1 gap-1.5 overflow-x-auto no-scrollbar">
              {catalog.categories.map((c) => (
                <button key={c.id} onClick={() => { setCat(c.id); setQ(""); }}
                  className={cx("whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold uppercase tracking-wide transition",
                    cat === c.id && !q ? "bg-primary text-white shadow" : "bg-surface border border-border text-text-2")}>
                  {c.name}
                </button>
              ))}
            </div>
            <div className="relative w-36 sm:w-56">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <Input className="pl-9" placeholder="Buscar" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Grilla de productos */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
          {products.map((p) => {
            const n = qtyOf(p.id);
            return (
              <button key={p.id} onClick={() => add(p)}
                className="relative flex min-h-24 flex-col justify-between rounded-2xl p-3 text-left text-white shadow-sm transition active:scale-[0.96]"
                style={{ background: p.color || "#D71B22" }}>
                <span className="pr-6 text-[15px] font-bold leading-tight">{p.name}</span>
                <span className="mt-2 inline-block self-start rounded-lg bg-black/25 px-2 py-0.5 text-sm font-extrabold tabular-nums">{ars(p.price)}</span>
                {n > 0 && (
                  <span className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-brand-yellow text-sm font-extrabold text-brand-black shadow">{n}</span>
                )}
              </button>
            );
          })}
          {!products.length && <div className="col-span-full py-10 text-center text-muted">No hay productos.</div>}
        </div>

        {/* Últimas ventas del turno */}
        <Card className="mt-6" title="Últimas ventas del turno">
          {!recent?.sales.length ? (
            <div className="py-4 text-center text-sm text-muted">Todavía no hay ventas en este turno.</div>
          ) : (
            <div className="divide-y divide-border">
              {recent.sales.map((s) => (
                <div key={s.id} className={cx("flex items-center gap-3 py-2.5", s.status === "anulada" && "opacity-60")}>
                  <div className="w-14 text-xs text-muted"><div className="font-bold text-text">#{s.number}</div>{fmtTime(s.created_at)}</div>
                  <div className="min-w-0 flex-1 text-sm">
                    <div className="truncate">{s.items?.map((i) => `${i.qty}× ${i.name}`).join(", ")}</div>
                    <div className="flex flex-wrap gap-1 text-xs text-muted">
                      {s.payments?.map((p, i) => <span key={i}>{p.name}{s.payments!.length > 1 ? ` ${ars(p.amount)}` : ""}</span>)}
                      {s.customer_name && <span>· {s.customer_name}</span>}
                    </div>
                    {s.status === "anulada" && <div className="text-xs text-bad">Anulada: {s.void_reason}</div>}
                  </div>
                  <div className={cx("text-right font-bold tabular-nums", s.status === "anulada" && "line-through")}>{ars(s.total)}</div>
                  {s.status === "confirmada" && (can("ventas.anular") || can("ventas.editar")) ? (
                    <button onClick={() => setVoiding(s)} className="rounded-lg p-2 text-muted hover:bg-bad/10 hover:text-bad" aria-label="Anular"><Ban className="size-4" /></button>
                  ) : <span className="w-8" />}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Ticket (escritorio) */}
      <aside className="hidden lg:block">
        <div className="sticky top-6 h-[calc(100dvh-3rem)] rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <h2 className="mb-3 font-display text-xl uppercase">Ticket actual</h2>
          <div className="h-[calc(100%-2.5rem)]">{cartPanel}</div>
        </div>
      </aside>

      {/* Barra de ticket (celular) */}
      {cart.length > 0 && (
        <div className="fixed inset-x-0 bottom-[60px] z-30 px-3 pb-2 lg:hidden">
          <div className="mx-auto flex max-w-lg items-center gap-2 rounded-2xl bg-brand-black p-2 text-white shadow-2xl">
            <button onClick={() => setCartOpen(true)} className="flex flex-1 items-center gap-2 px-2 text-left">
              <ChevronUp className="size-5" />
              <div>
                <div className="text-xs text-white/70">{units} producto{units !== 1 && "s"}</div>
                <div className="text-xl font-extrabold tabular-nums">{ars(total)}</div>
              </div>
            </button>
            <Button size="lg" onClick={() => setCheckout(true)} className="px-7 text-lg">COBRAR</Button>
          </div>
        </div>
      )}
      <Modal open={cartOpen} onClose={() => setCartOpen(false)} title="Ticket actual">
        <div className="max-h-[60dvh]">{cartPanel}</div>
      </Modal>

      <Checkout
        open={checkout}
        onClose={() => setCheckout(false)}
        cart={cart}
        total={total}
        methods={catalog.paymentMethods}
        shiftId={shift.shift.id}
        allowFiado={mod("fiados") && can("fiados.gestionar")}
        allowOffline={mod("sin_conexion")}
        onDone={done}
        onError={(m) => toast(m, "bad")}
      />

      {/* Confirmación de venta */}
      <Modal open={!!success} onClose={() => setSuccess(null)} title="">
        {success && (
          <div className="flex flex-col items-center py-2 text-center">
            <CheckCircle2 className="size-16 text-good" />
            <div className="mt-2 text-xl font-bold">{success.queued ? "Venta guardada sin conexión" : `Venta #${success.number} registrada`}</div>
            <div className="text-muted">Total {ars(success.total)}</div>
            {success.change != null && (
              <div className="mt-4 w-full rounded-2xl bg-accent p-4 text-brand-black">
                <div className="text-sm font-bold uppercase">Vuelto</div>
                <div className="text-5xl font-extrabold tabular-nums">{ars(success.change)}</div>
              </div>
            )}
            <Button size="lg" className="mt-5 w-full" onClick={() => setSuccess(null)}>Nueva venta</Button>
          </div>
        )}
      </Modal>

      <VoidModal sale={voiding} onClose={() => setVoiding(null)} onDone={() => { refreshRecent(); refreshShift(); }} />
    </div>
  );
}

function OpenShift({ catalog, hours, opening, onOpened }: { catalog: Catalog; hours?: { enabled: boolean; clocked_in: boolean }; opening?: Opening; onOpened: () => void }) {
  const editable = opening?.editable ?? true;
  const next = opening?.next ?? null;
  const [type, setType] = useState<number | "">(catalog.shiftTypes[0]?.id ?? "");
  const [cash, setCash] = useState(next != null ? String(next) : "");
  const [ok, setOk] = useState(false);
  const [note, setNote] = useState("");
  const [clock, setClock] = useState(true);
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const pending = !editable && next == null;
  const { me } = useMe();
  // ¿Se está abriendo tarde? (horario del turno + tolerancia)
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 30000); return () => clearInterval(t); }, []);
  const st = catalog.shiftTypes.find((t) => t.id === type);
  const since = me?.schema_ok ? minutesSinceStart(st?.start_time, st?.days) : null;
  const tol = Number(me?.settings.late_tolerance_min ?? 15);
  const isLate = !!since && since.minutes > tol;
  const [arrived, setArrived] = useState("");
  const [reason, setReason] = useState("");
  const nowHHMM = (() => { const m = localClock().minutes; return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; })();
  // El empleado confirma que contó la caja, o deja una observación si no coincide
  const canOpen = (editable || pending || ok || note.trim().length >= 3) && (!isLate || (!!arrived && reason.trim().length >= 3));
  const open = async () => {
    setLoading(true);
    try {
      await api("/api/shifts", { body: {
        shift_type_id: type || null, clock_in: !!hours?.enabled && !hours.clocked_in && clock,
        ...(editable ? { opening_cash: Number(cash || 0) } : { opening_confirmed: ok, opening_note: note.trim() || null }),
        ...(isLate ? { arrived_time: arrived, late_reason: reason.trim() } : {}),
      } });
      toast("Turno abierto. ¡Buenas ventas!");
      onOpened();
    } catch (e) {
      toast((e as Error).message, "bad");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="mx-auto mt-6 max-w-md">
      <Card>
        <div className="mb-4 text-center">
          <Clock className="mx-auto size-10 text-primary" />
          <h1 className="mt-2 font-display text-3xl uppercase">Abrir turno</h1>
          <p className="text-sm text-muted">{editable ? "Antes de vender, abrí tu turno con el efectivo que hay en la caja." : "Antes de vender, contá la caja y abrí tu turno."}</p>
        </div>
        <div className="space-y-3">
          <Field label="Turno">
            <div className="grid grid-cols-3 gap-2">
              {catalog.shiftTypes.map((t) => (
                <button key={t.id} onClick={() => setType(t.id)} className={cx("rounded-xl border py-3 font-semibold", type === t.id ? "border-primary bg-primary text-white" : "border-border bg-surface-2")}>{t.name}</button>
              ))}
            </div>
          </Field>
          {isLate && (
            <div className="space-y-3 rounded-xl border border-warn/40 bg-warn/10 p-3">
              <div className="text-sm">
                <div className="font-bold text-warn">Estás abriendo el turno {fmtMinutes(since!.minutes)} tarde</div>
                <div className="text-text-2">El turno {st?.name} empieza a las {st?.start_time}. Contanos qué pasó: lo ve el administrador.</div>
              </div>
              <div className="grid grid-cols-[110px_1fr] gap-2">
                <Field label="Llegué a las"><Input type="time" value={arrived} max={nowHHMM} onChange={(e) => setArrived(e.target.value)} /></Field>
                <Field label="¿Por qué abriste tarde?"><Input value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} placeholder="ej: estaba limpiando" /></Field>
              </div>
              <p className="text-xs text-text-2">Tus horas se cuentan desde que fichás. Si llegaste antes, el administrador puede corregir tu fichada.</p>
            </div>
          )}
          {editable ? (
            <Field label="Efectivo inicial en caja" hint={next != null ? "Monto cargado para este turno. Podés corregirlo." : undefined}><MoneyInput value={cash} onChange={setCash} /></Field>
          ) : pending ? (
            <div className="rounded-xl border border-warn/40 bg-warn/10 p-3 text-sm">
              <div className="font-bold text-warn">Caja inicial pendiente</div>
              <div className="text-text-2">El administrador todavía no cargó el efectivo inicial. Podés abrir y vender igual; lo completa después.</div>
            </div>
          ) : (
            <>
              <div className="rounded-xl bg-surface-2 p-3 text-center">
                <div className="text-sm text-muted">Efectivo inicial en caja (lo define el administrador)</div>
                <div className="text-3xl font-extrabold tabular-nums">{ars(next!)}</div>
              </div>
              <label className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-3 py-3 font-semibold">
                Conté la caja y está bien<input type="checkbox" className="size-5" checked={ok} onChange={(e) => setOk(e.target.checked)} />
              </label>
              {!ok && <Field label="Si no coincide, anotá qué encontraste"><Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="ej: hay $2.000 menos" /></Field>}
            </>
          )}
          {hours?.enabled && (hours.clocked_in
            ? <div className="rounded-xl bg-good/10 px-3 py-2.5 text-sm font-semibold text-good">✓ Ya fichaste tu entrada</div>
            : <label className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-3 font-semibold">Fichar mi entrada ahora<input type="checkbox" className="size-5" checked={clock} onChange={(e) => setClock(e.target.checked)} /></label>)}
          <Button size="lg" className="w-full" loading={loading} disabled={!canOpen} onClick={open}>Abrir turno</Button>
        </div>
      </Card>
    </div>
  );
}

type Mode = "simple" | "mixto" | "fiado";

function Checkout({ open, onClose, cart, total, methods, shiftId, allowFiado, allowOffline, onDone, onError }: {
  open: boolean; onClose: () => void; cart: CartLine[]; total: number; methods: PaymentMethod[]; shiftId: number;
  allowFiado: boolean; allowOffline: boolean;
  onDone: (r: { number?: number; change: number | null; queued: boolean; total: number }) => void; onError: (m: string) => void;
}) {
  const [mode, setMode] = useState<Mode>("simple");
  const [received, setReceived] = useState("");
  const [split, setSplit] = useState<Record<number, string>>({});
  const [customer, setCustomer] = useState<PickedCustomer | null>(null);
  const [partial, setPartial] = useState("");
  const [partialMethod, setPartialMethod] = useState<number | "">("");
  const [busy, setBusy] = useState(false);
  const [confirmM, setConfirmM] = useState<PaymentMethod | null>(null);

  useEffect(() => {
    if (open) {
      setMode("simple"); setReceived(""); setSplit({}); setCustomer(null); setPartial(""); setPartialMethod(""); setConfirmM(null);
    }
  }, [open]);
  // Recargo por comisión del medio de pago (se suma a lo que se cobra)
  const sc = (m: PaymentMethod | undefined, amount: number) => (m ? surchargeFor(amount, m.kind === "fiado" ? 0 : m.surcharge_pct) : 0);
  const byId = (id: number) => methods.find((m) => m.id === id);

  const payable = methods.filter((m) => m.kind !== "fiado");
  const fiadoMethod = methods.find((m) => m.kind === "fiado");
  const cash = methods.find((m) => m.kind === "efectivo");
  const cashTotal = total + sc(cash, total);
  const receivedN = Number(received || 0);
  const change = receivedN > 0 ? receivedN - cashTotal : null;

  const send = async (payments: { payment_method_id: number; amount: number }[], extra: Record<string, unknown> = {}) => {
    if (busy) return;
    setBusy(true);
    const cashAmount = payments.filter((p) => p.payment_method_id === cash?.id).reduce((a, p) => a + p.amount + sc(cash, p.amount), 0);
    const charged = payments.reduce((a, p) => a + p.amount + sc(byId(p.payment_method_id), p.amount), 0);
    const input = {
      id: uuid(),
      shift_id: shiftId,
      items: cart.map((l) => ({ product_id: l.product.id, qty: l.qty })),
      payments,
      cash_received: cashAmount > 0 && receivedN >= cashAmount ? receivedN : null,
      ...extra,
    };
    try {
      const r = await submitSale(input, allowOffline);
      onDone(r.queued ? { queued: true, total: charged, change: cashAmount > 0 && receivedN >= cashAmount ? receivedN - cashAmount : null }
        : { queued: false, number: r.number, total: r.charged ?? r.total, change: r.change });
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const splitSum = Object.values(split).reduce((a, v) => a + Number(v || 0), 0);
  const splitLeft = total - splitSum;
  const partialN = Number(partial || 0);

  const bills = [1000, 2000, 5000, 10000, 20000].filter((b) => b >= cashTotal).slice(0, 3);
  const quick = [...new Set([cashTotal, ...bills, Math.ceil(cashTotal / 1000) * 1000].filter((v) => v >= cashTotal))].sort((a, b) => a - b).slice(0, 4);
  const splitCharged = Object.entries(split).reduce((a, [id, v]) => a + Number(v || 0) + sc(byId(Number(id)), Number(v || 0)), 0);
  const splitSurcharge = splitCharged - splitSum;

  return (
    <Modal open={open} onClose={onClose} title={<span>Cobrar <span className="text-primary">{ars(total)}</span></span>}>
      <div className="mb-4 flex gap-1 rounded-xl bg-surface-2 p-1">
        {([["simple", "Un medio", Banknote], ["mixto", "Pago mixto", Split], ...(allowFiado && fiadoMethod ? [["fiado", "Fiado", UserRound]] : [])] as [Mode, string, typeof Banknote][]).map(([m, label, Icon]) => (
          <button key={m} onClick={() => setMode(m)} className={cx("flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold", mode === m ? "bg-surface shadow-sm" : "text-muted")}>
            <Icon className="size-4" />{label}
          </button>
        ))}
      </div>

      {mode === "simple" && confirmM && (() => {
        const extra = sc(confirmM, total);
        return (
          <div className="space-y-3">
            <div className="rounded-2xl border-2 p-4" style={{ borderColor: confirmM.color }}>
              <div className="flex justify-between text-sm"><span className="text-muted">Productos</span><span className="tabular-nums">{ars(total)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted">Recargo {confirmM.name} ({fmtPct(confirmM.surcharge_pct ?? 0)})</span><span className="tabular-nums">+ {ars(extra)}</span></div>
              <div className="mt-2 border-t border-border pt-2 text-center">
                <div className="text-sm font-semibold text-muted">Cobrar con {confirmM.name}</div>
                <div className="text-4xl font-extrabold tabular-nums text-primary">{ars(total + extra)}</div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setConfirmM(null)}>Volver</Button>
              <Button className="flex-[2]" size="lg" loading={busy} onClick={() => send([{ payment_method_id: confirmM.id, amount: total }])}>Cobré {ars(total + extra)} · Confirmar</Button>
            </div>
          </div>
        );
      })()}

      {mode === "simple" && !confirmM && (
        <div className="space-y-4">
          {cash && (
            <div className="rounded-2xl border border-border p-3">
              <div className="mb-2 text-sm font-semibold text-text-2">Si paga en efectivo, ¿con cuánto paga? <span className="font-normal text-muted">(opcional)</span></div>
              <MoneyInput value={received} onChange={setReceived} />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {quick.map((v) => (
                  <button key={v} onClick={() => setReceived(String(v))} className="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold">{v === cashTotal ? "Justo" : ars(v)}</button>
                ))}
              </div>
              {change != null && (
                <div className={cx("mt-2 text-lg font-bold", change < 0 ? "text-bad" : "text-good")}>
                  {change < 0 ? `Faltan ${ars(-change)}` : `Vuelto: ${ars(change)}`}
                </div>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            {payable.map((m) => (
              <button key={m.id} disabled={busy || (m.kind === "efectivo" && change != null && change < 0)}
                onClick={() => (m.kind !== "efectivo" && sc(m, total) > 0 ? setConfirmM(m) : send([{ payment_method_id: m.id, amount: total }]))}
                className="flex h-16 flex-col items-center justify-center rounded-2xl border-2 px-2 text-center text-base font-bold leading-tight transition active:scale-[0.97] disabled:opacity-40"
                style={{ borderColor: m.color }}>
                <span className="flex items-center gap-2"><span className="size-3 shrink-0 rounded-full" style={{ background: m.color }} />{m.name}</span>
                {sc(m, total) > 0 && <span className="text-xs font-semibold text-muted">Cobrar {ars(total + sc(m, total))}</span>}
              </button>
            ))}
          </div>
          <p className="text-center text-xs text-muted">Tocá el medio de pago para confirmar la venta.</p>
        </div>
      )}

      {mode === "mixto" && (
        <div className="space-y-2">
          {payable.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center gap-2">
              <span className="flex w-36 items-center gap-2 text-sm font-semibold"><span className="size-3 rounded-full" style={{ background: m.color }} />{m.name}</span>
              <MoneyInput className="flex-1" value={split[m.id] ?? ""} onChange={(v) => setSplit({ ...split, [m.id]: v })} />
              <button className="rounded-lg bg-surface-2 px-2 py-2 text-xs font-semibold" onClick={() => setSplit({ ...split, [m.id]: String(Math.max(0, Number(split[m.id] || 0) + splitLeft)) })}>Resto</button>
              {sc(m, Number(split[m.id] || 0)) > 0 && <div className="w-full pl-36 text-xs text-muted">+ recargo {ars(sc(m, Number(split[m.id] || 0)))} → cobrar <b className="text-text">{ars(Number(split[m.id]) + sc(m, Number(split[m.id] || 0)))}</b></div>}
            </div>
          ))}
          {splitSurcharge > 0 && splitLeft === 0 && <div className="text-center text-sm">Total a cobrar con recargos: <b className="text-lg tabular-nums">{ars(splitCharged)}</b></div>}
          <div className={cx("rounded-xl p-3 text-center font-bold", splitLeft === 0 ? "bg-good/10 text-good" : "bg-warn/10 text-warn")}>
            {splitLeft === 0 ? "¡Montos completos!" : splitLeft > 0 ? `Falta asignar ${ars(splitLeft)}` : `Sobran ${ars(-splitLeft)}`}
          </div>
          <Button size="lg" className="w-full" disabled={splitLeft !== 0} loading={busy}
            onClick={() => send(Object.entries(split).filter(([, v]) => Number(v) > 0).map(([id, v]) => ({ payment_method_id: Number(id), amount: Number(v) })))}>
            Confirmar venta
          </Button>
        </div>
      )}

      {mode === "fiado" && fiadoMethod && (
        <div className="space-y-3">
          <Field label="Cliente"><CustomerPicker value={customer} onChange={setCustomer} /></Field>
          <div className="rounded-2xl border border-border p-3">
            <div className="mb-2 text-sm font-semibold text-text-2">¿Paga una parte ahora? <span className="font-normal text-muted">(opcional)</span></div>
            <div className="flex gap-2">
              <MoneyInput className="flex-1" value={partial} onChange={setPartial} />
              <Select className="w-40" value={partialMethod} onChange={(e) => setPartialMethod(Number(e.target.value) || "")}>
                <option value="">Medio…</option>
                {payable.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </Select>
            </div>
          </div>
          {partialN > 0 && partialMethod && sc(byId(Number(partialMethod)), partialN) > 0 && (
            <div className="text-center text-sm">Cobrar ahora: <b>{ars(partialN + sc(byId(Number(partialMethod)), partialN))}</b> <span className="text-muted">(incluye recargo {ars(sc(byId(Number(partialMethod)), partialN))})</span></div>
          )}
          <div className="rounded-xl bg-accent/25 p-3 text-center font-bold">Queda debiendo: {ars(Math.max(0, total - partialN))}</div>
          <Button size="lg" className="w-full" loading={busy}
            disabled={!customer || partialN >= total || (partialN > 0 && !partialMethod)}
            onClick={() => send([
              ...(partialN > 0 ? [{ payment_method_id: Number(partialMethod), amount: partialN }] : []),
              { payment_method_id: fiadoMethod.id, amount: total - partialN },
            ], customer?.id ? { customer_id: customer.id } : { new_customer: { name: customer!.name, phone: customer!.phone ?? null } })}>
            Confirmar fiado
          </Button>
        </div>
      )}
    </Modal>
  );
}
