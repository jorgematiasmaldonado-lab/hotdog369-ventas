// Traduce errores de conexión a mensajes claros (sin mostrar nunca la contraseña).
export function explainDbError(e) {
  const msg = String(e?.message ?? e);
  const code = e?.code;
  const hide = (s) => s.replace(/postgres(ql)?:\/\/[^\s"']+/gi, "postgresql://***");
  let hint = "";
  if (code === "28P01" || /password authentication failed/i.test(msg))
    hint = "La CONTRASEÑA de DATABASE_URL es incorrecta. Revisá que sea la actual de Supabase y que no tenga corchetes [ ].";
  else if (/tenant or user not found/i.test(msg))
    hint = "El USUARIO de DATABASE_URL no es válido. Con el Transaction pooler debe ser postgres.<id-del-proyecto> (copiá la URL de nuevo desde Connect).";
  else if (code === "ENOTFOUND" || code === "EAI_AGAIN")
    hint = "No se encuentra el servidor de la base. Revisá la parte después de la @ en DATABASE_URL.";
  else if (code === "ECONNREFUSED" || code === "ETIMEDOUT" || code === "CONNECT_TIMEOUT")
    hint = "No se pudo conectar (puerto o servidor). Usá la URL del Transaction pooler, puerto 6543.";
  else if (code === "ERR_INVALID_URL" || /invalid url/i.test(msg))
    hint = "DATABASE_URL no es una dirección válida. Debe empezar con postgresql:// y no tener espacios ni corchetes.";
  console.error("\n========== ERROR DE BASE DE DATOS ==========");
  console.error("Detalle:", hide(msg), code ? `(código ${code})` : "");
  if (hint) console.error("Qué revisar:", hint);
  console.error("============================================\n");
}
