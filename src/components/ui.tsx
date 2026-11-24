"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Loader2, X, CheckCircle2, AlertTriangle, Info } from "lucide-react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger" | "accent" | "dark";
const variants: Record<Variant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-hover shadow-sm",
  secondary: "bg-surface-2 text-text hover:brightness-95 border border-border",
  ghost: "text-text-2 hover:bg-surface-2",
  danger: "bg-bad text-white hover:brightness-110",
  accent: "bg-accent text-on-accent hover:brightness-95 shadow-sm",
  dark: "bg-brand-black text-white hover:brightness-125 dark:bg-white dark:text-brand-black",
};

export function Button({
  variant = "primary", size = "md", loading, className, children, disabled, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" | "lg" | "xl"; loading?: boolean }) {
  const sizes = { sm: "h-9 px-3 text-sm", md: "h-11 px-4 text-[15px]", lg: "h-13 px-5 text-base", xl: "h-16 px-6 text-lg" };
  return (
    <button
      className={cx("inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none select-none",
        variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Card({ className, children, title, action }: { className?: string; children: ReactNode; title?: ReactNode; action?: ReactNode }) {
  return (
    <section className={cx("rounded-2xl bg-surface border border-border shadow-sm print-area", className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 px-4 pt-4">
          {title && <h2 className="font-semibold text-text">{title}</h2>}
          {action}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1 block text-sm font-medium text-text-2">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

const inputCls = "w-full h-11 rounded-xl border border-border bg-surface px-3 text-text placeholder:text-muted outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";
export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(inputCls, props.className)} />;
}
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(inputCls, "pr-8", props.className)} />;
}
export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(inputCls, "h-auto min-h-20 py-2", props.className)} />;
}

/** Input de dinero: solo números, muestra separador de miles */
export function MoneyInput({ value, onChange, autoFocus, placeholder, className }: { value: string; onChange: (v: string) => void; autoFocus?: boolean; placeholder?: string; className?: string }) {
  const shown = value ? new Intl.NumberFormat("es-AR").format(Number(value)) : "";
  return (
    <div className={cx("relative", className)}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">$</span>
      <input
        inputMode="numeric"
        autoFocus={autoFocus}
        placeholder={placeholder ?? "0"}
        value={shown}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 10))}
        className={cx(inputCls, "pl-7 text-lg font-semibold tabular-nums")}
      />
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, size = "md" }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; size?: "md" | "lg" | "xl" }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open) return null;
  const w = { md: "sm:max-w-lg", lg: "sm:max-w-2xl", xl: "sm:max-w-4xl" }[size];
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center no-print" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} />
      <div className={cx("relative w-full max-h-[92dvh] flex flex-col rounded-t-3xl sm:rounded-2xl bg-surface border border-border shadow-2xl", w)}>
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <h3 className="text-lg font-bold text-text">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-2 text-muted hover:bg-surface-2" aria-label="Cerrar"><X className="size-5" /></button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t border-border px-5 py-3 safe-bottom">{footer}</div>}
      </div>
    </div>
  );
}

export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "good" | "bad" | "warn" | "brand" | "accent"; className?: string }) {
  const tones = {
    neutral: "bg-surface-2 text-text-2 border-border",
    good: "bg-good/10 text-good border-good/30",
    bad: "bg-bad/10 text-bad border-bad/30",
    warn: "bg-warn/10 text-warn border-warn/30",
    brand: "bg-primary/10 text-primary border-primary/30",
    accent: "bg-accent/25 text-text border-accent/50",
  };
  return <span className={cx("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold", tones[tone], className)}>{children}</span>;
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx("size-6 animate-spin text-primary", className)} />;
}

export function Loading() {
  return <div className="flex justify-center py-16"><Spinner /></div>;
}

export function Empty({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-muted">
      {icon}
      <div className="text-sm">{children}</div>
    </div>
  );
}

export function ErrorBox({ error }: { error: unknown }) {
  if (!error) return null;
  return <div className="rounded-xl border border-bad/30 bg-bad/10 p-3 text-sm text-bad">{(error as Error).message ?? "Error"}</div>;
}

export function PageTitle({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-3xl uppercase text-text">{title}</h1>
        {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2 no-print">{actions}</div>}
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, items, className }: { value: T; onChange: (v: T) => void; items: { value: T; label: ReactNode }[]; className?: string }) {
  return (
    <div className={cx("flex gap-1 overflow-x-auto no-scrollbar rounded-xl bg-surface-2 p-1 border border-border", className)}>
      {items.map((i) => (
        <button key={i.value} onClick={() => onChange(i.value)}
          className={cx("whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition",
            value === i.value ? "bg-surface text-text shadow-sm" : "text-muted hover:text-text")}>
          {i.label}
        </button>
      ))}
    </div>
  );
}

// ---------- Toasts ----------
type Toast = { id: number; msg: ReactNode; tone: "good" | "bad" | "info" };
const ToastCtx = createContext<(msg: ReactNode, tone?: Toast["tone"]) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((msg: ReactNode, tone: Toast["tone"] = "good") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "bad" ? 6000 : 3000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-3 no-print">
        {toasts.map((t) => (
          <div key={t.id} className={cx("pointer-events-auto flex max-w-md items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold shadow-lg",
            t.tone === "good" && "bg-good text-white", t.tone === "bad" && "bg-bad text-white", t.tone === "info" && "bg-brand-black text-white")}>
            {t.tone === "good" ? <CheckCircle2 className="size-5 shrink-0" /> : t.tone === "bad" ? <AlertTriangle className="size-5 shrink-0" /> : <Info className="size-5 shrink-0" />}
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function Stat({ label, value, sub, tone, icon }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "brand" | "accent"; icon?: ReactNode }) {
  return (
    <div className={cx("rounded-2xl border p-4 shadow-sm",
      tone === "brand" ? "bg-primary text-white border-primary" : tone === "accent" ? "bg-accent text-brand-black border-accent" : "bg-surface border-border")}>
      <div className={cx("flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide", tone ? "opacity-90" : "text-muted")}>{icon}{label}</div>
      <div className="mt-1 whitespace-nowrap text-[clamp(1.05rem,5.4vw,1.5rem)] font-extrabold tabular-nums">{value}</div>
      {sub && <div className={cx("mt-0.5 text-xs", tone ? "opacity-90" : "text-muted")}>{sub}</div>}
    </div>
  );
}
