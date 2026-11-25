import { sql } from "@/lib/db";
import { route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { schemaOk } from "@/lib/schema";

// Catálogo para la pantalla de venta (se guarda también en el dispositivo para el modo sin conexión)
export const GET = route(async () => {
  await requireUser();
  const v2 = await schemaOk();
  const [categories, products, paymentMethods, voidReasons, shiftTypes] = await Promise.all([
    sql`SELECT id, name, color, sort FROM categories WHERE active ORDER BY sort, name`,
    sql`SELECT p.id, p.category_id, p.name, p.price, COALESCE(p.color, c.color) AS color, p.sort
        FROM products p JOIN categories c ON c.id = p.category_id
        WHERE p.active AND c.active ORDER BY c.sort, p.sort, p.name`,
    v2 ? sql`SELECT id, name, kind, color, surcharge_pct::float AS surcharge_pct FROM payment_methods WHERE active ORDER BY sort, name`
      : sql`SELECT id, name, kind, color FROM payment_methods WHERE active ORDER BY sort, name`,
    sql`SELECT id, label FROM void_reasons WHERE active ORDER BY sort, label`,
    v2 ? sql`SELECT id, name, to_char(start_time, 'HH24:MI') AS start_time, days FROM shift_types WHERE active ORDER BY sort, name`
      : sql`SELECT id, name FROM shift_types WHERE active ORDER BY sort, name`,
  ]);
  return { categories, products, paymentMethods, voidReasons, shiftTypes, at: new Date().toISOString() };
});
