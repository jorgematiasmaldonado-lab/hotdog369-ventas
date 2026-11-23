import type { Permission } from "../permissions";

export type Me = {
  user: { id: number; name: string; username: string; branch_id: number; role: { id: number; key: string; name: string }; permissions: Permission[] };
  modules: Record<string, boolean>;
  settings: Record<string, unknown>;
  schema_ok?: boolean;
};

export type Category = { id: number; name: string; color: string; sort: number };
export type Product = { id: number; category_id: number; name: string; price: number; color: string; sort: number };
export type PaymentMethod = { id: number; name: string; kind: "efectivo" | "transferencia" | "otro" | "fiado"; color: string };
export type Catalog = {
  categories: Category[];
  products: Product[];
  paymentMethods: PaymentMethod[];
  voidReasons: { id: number; label: string }[];
  shiftTypes: { id: number; name: string }[];
  at: string;
};
export type Customer = { id: number; name: string; phone: string | null; notes: string | null; balance: number; first_debt_at: string | null; last_movement_at: string | null };
export type SaleRow = {
  id: string; number: number; created_at: string; total: number; status: "confirmada" | "anulada";
  void_reason: string | null; voided_at: string | null; edited_at: string | null; offline: boolean;
  cash_received: number | null; change_given: number | null;
  user_name: string; voided_by_name: string | null; customer_name: string | null;
  items: { name: string; qty: number; subtotal: number }[] | null;
  payments: { name: string; kind: string; amount: number }[] | null;
};
