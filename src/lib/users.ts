import bcrypt from "bcryptjs";
import { ApiError, str, num, bool } from "./api";

export function parseUser(b: Record<string, unknown>, creating: boolean) {
  const username = str(b.username, "usuario", { max: 40 })!.toLowerCase();
  if (!/^[a-z0-9._-]{3,40}$/.test(username)) throw new ApiError(400, "El usuario solo puede tener letras, números, punto o guion (mín. 3).");
  const pin = str(b.pin, "PIN", { required: creating, max: 12 });
  if (pin && !/^\d{4,6}$/.test(pin)) throw new ApiError(400, "El PIN debe tener de 4 a 6 números.");
  return {
    name: str(b.name, "nombre", { max: 80 })!,
    username,
    role_id: num(b.role_id, "rol", { int: true })!,
    active: bool(b.active, true),
    pin_hash: pin ? bcrypt.hashSync(pin, 10) : undefined,
  };
}
