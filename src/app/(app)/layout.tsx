import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { MeProvider } from "@/components/me";
import { AppShell } from "@/components/app-shell";
import { ToastProvider } from "@/components/ui";
import type { Me } from "@/lib/client/types";
import { schemaOk } from "@/lib/schema";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/login");
  const modules = await sql`SELECT key, enabled FROM modules`;
  const settings = Object.fromEntries((await sql`SELECT key, value FROM settings WHERE key <> 'vapid_keys'`).map((r) => [r.key, r.value]));
  const me: Me = { user, modules: Object.fromEntries(modules.map((m) => [m.key, m.enabled])), settings, schema_ok: await schemaOk() };
  return (
    <MeProvider initial={me}>
      <ToastProvider>
        <AppShell>{children}</AppShell>
      </ToastProvider>
    </MeProvider>
  );
}
