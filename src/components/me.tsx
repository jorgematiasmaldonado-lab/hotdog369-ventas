"use client";
import { createContext, useContext, type ReactNode } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/client/fetcher";
import type { Me } from "@/lib/client/types";
import type { Permission } from "@/lib/permissions";

const Ctx = createContext<{ me: Me | undefined; can: (...p: Permission[]) => boolean; mod: (k: string) => boolean; reload: () => void }>({
  me: undefined, can: () => false, mod: () => false, reload: () => {},
});

export function MeProvider({ children, initial }: { children: ReactNode; initial: Me }) {
  const { data, mutate } = useSWR<Me>("/api/me", fetcher, { fallbackData: initial, refreshInterval: 60000 });
  const me = data ?? initial;
  const can = (...p: Permission[]) => !!me && p.some((x) => me.user.permissions.includes(x));
  const mod = (k: string) => !!me?.modules[k];
  return <Ctx.Provider value={{ me, can, mod, reload: () => mutate() }}>{children}</Ctx.Provider>;
}

export const useMe = () => useContext(Ctx);
