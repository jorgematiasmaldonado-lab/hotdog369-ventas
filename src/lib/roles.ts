import { ApiError, str } from "./api";
import { ALL_PERMISSIONS, WRITE_PERMISSIONS, type Permission } from "./permissions";

export function parseRole(b: Record<string, unknown>, existingKey: string | null) {
  const perms = Array.isArray(b.permissions) ? (b.permissions as string[]) : [];
  const valid = perms.filter((p): p is Permission => (ALL_PERMISSIONS as string[]).includes(p));
  if (existingKey === "admin") {
    // El administrador conserva siempre todos los permisos (evita quedar sin acceso al panel)
    return { name: str(b.name, "nombre", { max: 60 })!, description: str(b.description, "descripción", { required: false }), permissions: ALL_PERMISSIONS };
  }
  if (existingKey === "dueno" && valid.some((p) => WRITE_PERMISSIONS.includes(p)))
    throw new ApiError(400, "El rol de solo lectura no puede tener permisos para cargar o modificar.");
  return { name: str(b.name, "nombre", { max: 60 })!, description: str(b.description, "descripción", { required: false }), permissions: valid };
}
