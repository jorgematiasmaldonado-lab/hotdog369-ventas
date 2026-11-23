import { str, num, ApiError } from "./api";

export function parseExpense(b: Record<string, unknown>) {
  const date = str(b.date, "fecha", { max: 10 })!;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ApiError(400, "Fecha inválida.");
  const img = str(b.receipt_image, "comprobante", { required: false, max: 1_500_000 });
  if (img && !img.startsWith("data:image/")) throw new ApiError(400, "El comprobante debe ser una imagen.");
  return {
    date,
    supplier: str(b.supplier, "proveedor", { required: false, max: 120 }),
    category_id: num(b.category_id, "categoría", { required: false, int: true }),
    amount: num(b.amount, "monto", { min: 1 })!,
    payment_method_id: num(b.payment_method_id, "medio de pago", { required: false, int: true }),
    notes: str(b.notes, "observación", { required: false, max: 1000 }),
    receipt_image: img,
  };
}
