import { sql } from "@/lib/db";
import { route, body, num, str, id, ApiError } from "@/lib/api";
import { requireUser, requireModule } from "@/lib/auth";
import { audit } from "@/lib/audit";

// Registrar un cobro (total o parcial) de un fiado
export const POST = route(async (req, { params }) => {
  const user = await requireUser("fiados.gestionar");
  await requireModule("fiados");
  const cid = id(await params);
  const b = await body(req);
  const amount = num(b.amount, "monto", { min: 1 })!;
  const pmId = num(b.payment_method_id, "medio de pago", { int: true })!;
  const notes = str(b.notes, "nota", { required: false, max: 300 });
  return sql.begin(async (tx) => {
    const [pm] = await tx`SELECT kind FROM payment_methods WHERE id = ${pmId}`;
    if (!pm || pm.kind === "fiado") throw new ApiError(400, "Medio de pago inválido para cobrar.");
    const [bal] = await tx`SELECT COALESCE(sum(CASE WHEN type='cargo' THEN amount ELSE -amount END),0) AS balance
      FROM customer_movements WHERE customer_id = ${cid}`;
    if (amount > bal.balance + 0.009) throw new ApiError(400, `El cobro supera la deuda (${bal.balance}).`);
    const [shift] = await tx`SELECT id FROM shifts WHERE user_id = ${user.id} AND status = 'abierto'`;
    const [m] = await tx`INSERT INTO customer_movements (customer_id, shift_id, type, amount, payment_method_id, user_id, notes)
      VALUES (${cid}, ${shift?.id ?? null}, 'pago', ${amount}, ${pmId}, ${user.id}, ${notes}) RETURNING *`;
    await audit(tx, user.id, "cobrar", "fiado", cid, { balance: bal.balance }, { balance: bal.balance - amount, amount });
    return m;
  });
});
