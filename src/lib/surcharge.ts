/**
 * Recargo por comisión del medio de pago (cálculo exacto):
 * se cobra un monto tal que, después de que la app de cobro descuente su porcentaje,
 * al local le quede el precio completo. Se redondea hacia arriba a $10.
 * Ej.: $8.000 con 6 % → 8.000 / 0,94 = 8.510,64 → se cobra $8.520 (recargo $520).
 */
export function surchargeFor(base: number, pct: number | null | undefined): number {
  const p = Number(pct ?? 0);
  if (!(base > 0) || !(p > 0) || p >= 50) return 0;
  const cents = Math.round((base * 100 * 100) / (100 - p)); // monto bruto en centavos
  const charged = Math.ceil(cents / 1000) * 10;              // hacia arriba a $10
  return Math.max(0, charged - base);
}

export const fmtPct = (p: number) => `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(p)} %`;
