// Catálogo de permisos. Los roles se arman desde el panel combinando estos permisos.
export const PERMISSIONS = {
  "ventas.crear": "Registrar ventas",
  "ventas.anular": "Anular sus propias ventas del turno (con motivo)",
  "ventas.ver_todas": "Ver el historial completo de ventas",
  "ventas.editar": "Editar, corregir y anular cualquier venta",
  "turnos.operar": "Abrir y cerrar su turno (arqueo de caja)",
  "turnos.ver_todos": "Ver todos los turnos y arqueos",
  "fiados.gestionar": "Registrar fiados y cobros de fiados",
  "fiados.ver": "Ver fiados y saldos de clientes",
  "caja.gestionar": "Registrar ingresos y retiros de caja",
  "gastos.gestionar": "Registrar y editar gastos / compras",
  "gastos.ver": "Ver gastos",
  "dashboard.ver": "Ver el panel en tiempo real",
  "reportes.ver": "Ver reportes y estadísticas",
  "productos.gestionar": "Administrar productos, categorías, precios y catálogos",
  "usuarios.gestionar": "Administrar usuarios y roles",
  "config.gestionar": "Configurar el negocio y los módulos",
  "auditoria.ver": "Ver el registro de auditoría",
  "stock.ver": "Ver el stock y sus movimientos",
  "stock.gestionar": "Administrar artículos, ingresos y ajustes de stock",
  "stock.contar": "Hacer el control de stock al abrir el turno",
  "horas.fichar": "Fichar su entrada y salida",
  "horas.ver": "Ver las horas de todo el personal",
  "horas.gestionar": "Corregir fichadas y cargar francos, vacaciones y faltas",
  "respaldo.gestionar": "Descargar y restaurar respaldos de la base",
} as const;

export type Permission = keyof typeof PERMISSIONS;
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

/** Permisos que implican escritura: el rol "solo lectura" no debe tener ninguno. */
export const WRITE_PERMISSIONS: Permission[] = [
  "ventas.crear", "ventas.anular", "ventas.editar", "turnos.operar", "fiados.gestionar",
  "caja.gestionar", "gastos.gestionar", "productos.gestionar", "usuarios.gestionar", "config.gestionar",
  "stock.gestionar", "stock.contar", "horas.fichar", "horas.gestionar", "respaldo.gestionar",
];
