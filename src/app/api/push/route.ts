import { sql } from "@/lib/db";
import { route, body, str, ApiError } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { vapidKeys } from "@/lib/push";

// Clave pública para suscribir este equipo a los avisos
export const GET = route(async () => {
  await requireUser("stock.ver", "stock.gestionar");
  return { publicKey: (await vapidKeys()).publicKey };
});

// Activar avisos en este equipo
export const POST = route(async (req) => {
  const user = await requireUser("stock.ver", "stock.gestionar");
  const b = await body<{ subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } } }>(req);
  const s = b.subscription;
  const endpoint = str(s?.endpoint, "endpoint", { max: 1000 })!;
  if (!/^https:\/\//.test(endpoint)) throw new ApiError(400, "Suscripción inválida.");
  const p256dh = str(s?.keys?.p256dh, "p256dh", { max: 200 })!;
  const auth = str(s?.keys?.auth, "auth", { max: 100 })!;
  await sql`INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
    VALUES (${user.id}, ${endpoint}, ${p256dh}, ${auth}, ${req.headers.get("user-agent")?.slice(0, 300) ?? null})
    ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, created_at = now()`;
  return { ok: true };
});

// Desactivar avisos en este equipo
export const DELETE = route(async (req) => {
  const user = await requireUser();
  const b = await body<{ endpoint?: string }>(req);
  await sql`DELETE FROM push_subscriptions WHERE endpoint = ${str(b.endpoint, "endpoint", { max: 1000 })} AND user_id = ${user.id}`;
  return { ok: true };
});
