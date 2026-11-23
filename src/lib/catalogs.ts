// Definición de los catálogos administrables desde el panel.
// Para sumar un catálogo nuevo: crear la tabla en una migración y agregar su entrada aquí.
import { ApiError, str, num, bool, color } from "./api";

type FieldType = "text" | "int" | "money" | "color" | "bool" | "select";
export type FieldDef = { type: FieldType; label: string; required?: boolean; options?: string[]; ref?: string };
export type CatalogDef = { table: string; label: string; order: string; fields: Record<string, FieldDef> };

export const CATALOGS: Record<string, CatalogDef> = {
  products: {
    table: "products", label: "Productos", order: "category_id, sort, name",
    fields: {
      name: { type: "text", label: "Nombre", required: true },
      category_id: { type: "select", label: "Categoría", required: true, ref: "categories" },
      price: { type: "money", label: "Precio", required: true },
      color: { type: "color", label: "Color del botón" },
      sort: { type: "int", label: "Orden" },
      is_combo: { type: "bool", label: "Es promo / combo" },
      active: { type: "bool", label: "Activo" },
    },
  },
  categories: {
    table: "categories", label: "Categorías", order: "sort, name",
    fields: {
      name: { type: "text", label: "Nombre", required: true },
      color: { type: "color", label: "Color" },
      sort: { type: "int", label: "Orden" },
      active: { type: "bool", label: "Activa" },
    },
  },
  payment_methods: {
    table: "payment_methods", label: "Medios de pago", order: "sort, name",
    fields: {
      name: { type: "text", label: "Nombre", required: true },
      kind: { type: "select", label: "Tipo", required: true, options: ["efectivo", "transferencia", "otro", "fiado"] },
      color: { type: "color", label: "Color" },
      sort: { type: "int", label: "Orden" },
      active: { type: "bool", label: "Activo" },
    },
  },
  shift_types: {
    table: "shift_types", label: "Turnos", order: "sort, name",
    fields: {
      name: { type: "text", label: "Nombre", required: true },
      sort: { type: "int", label: "Orden" },
      active: { type: "bool", label: "Activo" },
    },
  },
  void_reasons: {
    table: "void_reasons", label: "Motivos de anulación", order: "sort, label",
    fields: {
      label: { type: "text", label: "Motivo", required: true },
      sort: { type: "int", label: "Orden" },
      active: { type: "bool", label: "Activo" },
    },
  },
  expense_categories: {
    table: "expense_categories", label: "Categorías de gasto", order: "sort, name",
    fields: {
      name: { type: "text", label: "Nombre", required: true },
      sort: { type: "int", label: "Orden" },
      active: { type: "bool", label: "Activa" },
    },
  },
};

export function getCatalog(entity: string) {
  const def = CATALOGS[entity];
  if (!def) throw new ApiError(404, "Catálogo inexistente.");
  return def;
}

export function parseCatalog(def: CatalogDef, b: Record<string, unknown>, partial = false) {
  const out: Record<string, unknown> = {};
  for (const [k, f] of Object.entries(def.fields)) {
    if (partial && !(k in b)) continue;
    const v = b[k];
    switch (f.type) {
      case "text": out[k] = str(v, f.label, { required: !!f.required, max: 120 }); break;
      case "int": out[k] = num(v ?? 0, f.label, { int: true }); break;
      case "money": out[k] = num(v, f.label, { required: !!f.required, min: 0 }); break;
      case "color": out[k] = color(v, f.label); break;
      case "bool": out[k] = bool(v, k === "active"); break;
      case "select":
        if (f.options) {
          if (typeof v !== "string" || !f.options.includes(v)) throw new ApiError(400, `"${f.label}" inválido`);
          out[k] = v;
        } else out[k] = num(v, f.label, { required: !!f.required, int: true });
        break;
    }
  }
  return out;
}
