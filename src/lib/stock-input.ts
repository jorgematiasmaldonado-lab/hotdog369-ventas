import { ApiError, bool, num, str } from "./api";

export function parseStockItem(b: Record<string, unknown>) {
  const unit = str(b.unit ?? "u", "unidad", { max: 12 })!;
  return {
    name: str(b.name, "nombre", { max: 80 })!,
    unit,
    min_quantity: num(b.min_quantity ?? 0, "stock mínimo", { min: 0 })!,
    cost: num(b.cost, "costo", { required: false, min: 0 }),
    count_on_shift: bool(b.count_on_shift, true),
    sort: num(b.sort ?? 0, "orden", { int: true })!,
    active: bool(b.active, true),
  };
}

export function parseQty(v: unknown, field = "cantidad", allowZero = false) {
  const n = num(v, field)!;
  if (!allowZero && n === 0) throw new ApiError(400, `"${field}" no puede ser 0`);
  if (Math.abs(n) > 1_000_000) throw new ApiError(400, `"${field}" es demasiado grande`);
  return Math.round(n * 1000) / 1000;
}
