"use client";
import { useState } from "react";
import useSWR from "swr";
import { Search, UserPlus } from "lucide-react";
import { Input, cx } from "./ui";
import { fetcher } from "@/lib/client/fetcher";
import type { Customer } from "@/lib/client/types";
import { ars } from "@/lib/format";

export type PickedCustomer = { id?: number; name: string; phone?: string };

export function CustomerPicker({ value, onChange }: { value: PickedCustomer | null; onChange: (c: PickedCustomer | null) => void }) {
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [phone, setPhone] = useState("");
  const { data } = useSWR<Customer[]>("/api/customers", fetcher);
  const list = (data ?? []).filter((c) => c.name.toLowerCase().includes(q.toLowerCase())).slice(0, 8);

  if (value)
    return (
      <div className="flex items-center justify-between rounded-xl border border-primary bg-primary/5 px-3 py-2">
        <div>
          <div className="font-semibold">{value.name}{!value.id && <span className="ml-2 text-xs text-primary">(nuevo)</span>}</div>
          {value.phone && <div className="text-xs text-muted">{value.phone}</div>}
        </div>
        <button className="text-sm font-semibold text-primary" onClick={() => onChange(null)}>Cambiar</button>
      </div>
    );

  if (creating)
    return (
      <div className="space-y-2 rounded-xl border border-border p-3">
        <Input autoFocus placeholder="Nombre del cliente" value={q} onChange={(e) => setQ(e.target.value)} />
        <Input placeholder="Teléfono (opcional)" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <div className="flex gap-2">
          <button className="flex-1 rounded-xl bg-primary py-2.5 font-semibold text-white disabled:opacity-40" disabled={q.trim().length < 2}
            onClick={() => onChange({ name: q.trim(), phone: phone.trim() || undefined })}>Usar este cliente</button>
          <button className="rounded-xl bg-surface-2 px-4 font-semibold" onClick={() => setCreating(false)}>Volver</button>
        </div>
      </div>
    );

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <Input className="pl-9" placeholder="Buscar cliente…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="max-h-48 space-y-1 overflow-y-auto">
        {list.map((c) => (
          <button key={c.id} onClick={() => onChange({ id: c.id, name: c.name, phone: c.phone ?? undefined })}
            className="flex w-full items-center justify-between rounded-xl bg-surface-2 px-3 py-2 text-left">
            <span className="font-semibold">{c.name}</span>
            <span className={cx("text-sm", c.balance > 0 ? "text-bad font-semibold" : "text-muted")}>{c.balance > 0 ? `debe ${ars(c.balance)}` : "sin deuda"}</span>
          </button>
        ))}
      </div>
      <button onClick={() => setCreating(true)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary py-2.5 font-semibold text-primary">
        <UserPlus className="size-4" />Cliente nuevo{q ? `: “${q}”` : ""}
      </button>
    </div>
  );
}
