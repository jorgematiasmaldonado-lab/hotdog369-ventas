import "server-only";
import webpush from "web-push";
import { sql } from "./db";
import type { Permission } from "./permissions";

export type LowItem = { id: number; name: string; unit: string; quantity: number; min_quantity: number };

/** Claves VAPID: se generan una sola vez y se guardan en la configuración. */
export async function vapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  const [row] = await sql`SELECT value FROM settings WHERE key = 'vapid_keys'`;
  if (row?.value?.publicKey) return row.value;
  const keys = webpush.generateVAPIDKeys();
  await sql`INSERT INTO settings (key, value) VALUES ('vapid_keys', ${sql.json({ publicKey: keys.publicKey, privateKey: keys.privateKey })}) ON CONFLICT (key) DO NOTHING`;
  const [again] = await sql`SELECT value FROM settings WHERE key = 'vapid_keys'`;
  return again.value;
}

type Payload = { title: string; body: string; url?: string; tag?: string };

/** Envía una notificación a todos los equipos de los usuarios con alguno de esos permisos (o a un usuario). */
export async function sendPush(payload: Payload, target: { perms?: Permission[]; userId?: number }) {
  try {
    const keys = await vapidKeys();
    webpush.setVapidDetails("mailto:avisos@hotdog369.app", keys.publicKey, keys.privateKey);
    const subs = target.userId
      ? await sql`SELECT ps.* FROM push_subscriptions ps JOIN users u ON u.id = ps.user_id WHERE u.active AND ps.user_id = ${target.userId}`
      : await sql`SELECT ps.* FROM push_subscriptions ps JOIN users u ON u.id = ps.user_id JOIN roles r ON r.id = u.role_id
          WHERE u.active AND r.permissions && ${target.perms ?? []}::text[]`;
    let sent = 0;
    await Promise.all(subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 60 * 60 * 12, urgency: "high" });
        sent++;
        await sql`UPDATE push_subscriptions SET last_ok_at = now() WHERE id = ${s.id}`;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await sql`DELETE FROM push_subscriptions WHERE id = ${s.id}`; // equipo dado de baja
        else console.error("push", code, (e as Error).message);
      }
    }));
    return { devices: subs.length, sent };
  } catch (e) {
    console.error("push", (e as Error).message); // p. ej. base sin la tabla de suscripciones
    return { devices: 0, sent: 0 };
  }
}

const fq = (n: number) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n);

/** Aviso de stock bajo para dueño y administrador. */
export async function notifyLowStock(items: LowItem[] | undefined) {
  if (!items?.length) return;
  const uniq = [...new Map(items.map((i) => [i.id, i])).values()];
  const line = (i: LowItem) => (i.quantity <= 0 ? `${i.name}: sin stock` : `${i.name}: quedan ${fq(i.quantity)} ${i.unit} (mínimo ${fq(i.min_quantity)})`);
  const payload = uniq.length === 1
    ? { title: `${uniq[0].quantity <= 0 ? "Sin stock" : "Stock bajo"}: ${uniq[0].name}`, body: line(uniq[0]), url: "/stock", tag: `stock-${uniq[0].id}` }
    : { title: `Stock bajo en ${uniq.length} artículos`, body: uniq.slice(0, 4).map(line).join("\n") + (uniq.length > 4 ? `\ny ${uniq.length - 4} más` : ""), url: "/stock", tag: "stock-varios" };
  await sendPush(payload, { perms: ["stock.ver", "stock.gestionar"] });
}
