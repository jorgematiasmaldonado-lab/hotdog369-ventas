import { NextResponse } from "next/server";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type Handler<C> = (req: Request, ctx: C) => Promise<unknown>;

/** Envuelve un route handler: convierte errores en JSON y respuestas en NextResponse. */
export function route<C = { params: Promise<Record<string, string>> }>(fn: Handler<C>) {
  return async (req: Request, ctx: C) => {
    try {
      const out = await fn(req, ctx);
      if (out instanceof Response) return out;
      return NextResponse.json(out ?? { ok: true });
    } catch (e) {
      if (e instanceof ApiError) return NextResponse.json({ error: e.message }, { status: e.status });
      const pgCode = (e as { code?: string })?.code;
      if (pgCode === "23505") return NextResponse.json({ error: "Ya existe un registro con esos datos." }, { status: 409 });
      if (pgCode === "23503") return NextResponse.json({ error: "El registro está en uso y no se puede eliminar." }, { status: 409 });
      console.error(e);
      return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
    }
  };
}

export async function body<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new ApiError(400, "Cuerpo de la solicitud inválido");
  }
}

// ---- Validaciones simples ----
export function str(v: unknown, field: string, opts: { required?: boolean; max?: number } = {}): string | null {
  const { required = true, max = 500 } = opts;
  if (v === undefined || v === null || (typeof v === "string" && v.trim() === "")) {
    if (required) throw new ApiError(400, `Falta el campo "${field}"`);
    return null;
  }
  if (typeof v !== "string") throw new ApiError(400, `"${field}" debe ser texto`);
  const s = v.trim();
  if (s.length > max) throw new ApiError(400, `"${field}" es demasiado largo`);
  return s;
}

export function num(v: unknown, field: string, opts: { required?: boolean; min?: number; int?: boolean } = {}): number | null {
  const { required = true, min, int } = opts;
  if (v === undefined || v === null || v === "") {
    if (required) throw new ApiError(400, `Falta el campo "${field}"`);
    return null;
  }
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) throw new ApiError(400, `"${field}" debe ser un número`);
  if (int && !Number.isInteger(n)) throw new ApiError(400, `"${field}" debe ser un número entero`);
  if (min !== undefined && n < min) throw new ApiError(400, `"${field}" debe ser mayor o igual a ${min}`);
  return n;
}

export function bool(v: unknown, fallback = false): boolean {
  return typeof v === "boolean" ? v : fallback;
}

export function color(v: unknown, field = "color"): string | null {
  const s = str(v, field, { required: false, max: 9 });
  if (s && !/^#[0-9a-fA-F]{6}$/.test(s)) throw new ApiError(400, `"${field}" debe ser un color #RRGGBB`);
  return s;
}

export function id(params: Record<string, string>, key = "id"): number {
  const n = Number(params[key]);
  if (!Number.isInteger(n) || n <= 0) throw new ApiError(400, "Identificador inválido");
  return n;
}
