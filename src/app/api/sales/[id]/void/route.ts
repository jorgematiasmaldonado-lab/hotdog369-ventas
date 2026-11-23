import { route, body, str, ApiError } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { voidSale } from "@/lib/sales";

export const POST = route(async (req, { params }) => {
  const user = await requireUser("ventas.anular", "ventas.editar");
  const { id } = await params;
  const b = await body(req);
  const reason = str(b.reason, "motivo de anulación", { max: 300 })!;
  if (reason.length < 3) throw new ApiError(400, "Escribí un motivo más claro.");
  return voidSale(user, id, reason);
});
