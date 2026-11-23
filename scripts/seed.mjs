// Carga los datos iniciales (solo si la base está vacía).
import postgres from "postgres";
import { dbUrl } from "./db-url.mjs";
import { explainDbError } from "./db-error.mjs";
process.on("unhandledRejection", (e) => { explainDbError(e); process.exit(1); });
import bcrypt from "bcryptjs";
import { loadEnv } from "./env.mjs";

loadEnv();
const sql = postgres(dbUrl(), { prepare: false, onnotice: () => {} });

const [{ count }] = await sql`SELECT count(*)::int AS count FROM roles`;
if (count > 0) {
  console.log("La base ya tiene datos: no se cargó nada.");
  await sql.end();
  process.exit(0);
}

const ALL = [
  "ventas.crear", "ventas.anular", "ventas.ver_todas", "ventas.editar",
  "turnos.operar", "turnos.ver_todos", "fiados.gestionar", "fiados.ver",
  "caja.gestionar", "gastos.gestionar", "gastos.ver", "dashboard.ver", "reportes.ver",
  "productos.gestionar", "usuarios.gestionar", "config.gestionar", "auditoria.ver",
  "stock.ver", "stock.gestionar", "stock.contar", "horas.fichar", "horas.ver", "horas.gestionar", "respaldo.gestionar",
];

await sql.begin(async (tx) => {
  const [branch] = await tx`INSERT INTO branches (name) VALUES ('HOT DOG 369 - Local principal') RETURNING id`;

  const roles = [
    { key: "admin", name: "Administrador", description: "Acceso total: edita, configura, reportes, gastos y caja.", permissions: ALL },
    { key: "empleado", name: "Empleado", description: "Registra ventas, fiados y puede anular sus ventas indicando el motivo.",
      permissions: ["ventas.crear", "ventas.anular", "turnos.operar", "fiados.gestionar", "fiados.ver", "stock.contar", "horas.fichar"] },
    { key: "dueno", name: "Dueño (solo lectura)", description: "Ve ventas, reportes y movimientos. No puede cargar ni modificar nada.",
      permissions: ["ventas.ver_todas", "turnos.ver_todos", "fiados.ver", "gastos.ver", "dashboard.ver", "reportes.ver", "auditoria.ver", "stock.ver", "horas.ver"] },
  ];
  const roleIds = {};
  for (const r of roles) {
    const [row] = await tx`INSERT INTO roles (key, name, description, permissions, is_system)
      VALUES (${r.key}, ${r.name}, ${r.description}, ${r.permissions}, true) RETURNING id`;
    roleIds[r.key] = row.id;
  }

  const users = [
    { name: "Administrador", username: "admin", pin: "3690", role: "admin" },
    { name: "Empleado de prueba", username: "empleado", pin: "1111", role: "empleado" },
    { name: "Dueño", username: "dueno", pin: "2222", role: "dueno" },
  ];
  for (const u of users) {
    await tx`INSERT INTO users (name, username, pin_hash, role_id, branch_id)
      VALUES (${u.name}, ${u.username}, ${bcrypt.hashSync(u.pin, 10)}, ${roleIds[u.role]}, ${branch.id})`;
  }

  await tx`INSERT INTO shift_types (name, sort) VALUES ('Mañana', 1), ('Tarde', 2), ('Noche', 3)`;

  const [panch] = await tx`INSERT INTO categories (name, color, sort) VALUES ('Panchería', '#D71B22', 1) RETURNING id`;
  const [cafe] = await tx`INSERT INTO categories (name, color, sort) VALUES ('Cafetería', '#8B5A2B', 2) RETURNING id`;

  const panchos = [
    ["Pancho clásico", 5000, "#D71B22"], ["Promo pancho + Coca 237 ml", 6800, "#D71B22"],
    ["Promo pancho + jugo chico", 6000, "#D71B22"], ["Pancho vegano", 8000, "#151A1D"],
    ["Pancho alemán", 8000, "#D71B22"], ["Tostado", 8000, "#151A1D"], ["Postres", 4500, "#D71B22"],
    ["Bebida 350 cc", 2100, "#151A1D"], ["Coca 500 cc", 2500, "#D71B22"], ["Agua 500 cc", 2500, "#151A1D"],
    ["Latas", 2300, "#D71B22"], ["Agua saborizada", 2500, "#151A1D"], ["Coca 237 ml", 1800, "#D71B22"],
  ];
  const cafes = [
    ["Café solo", 2500], ["Café + 2 criollos", 4000], ["Café + medialuna", 3500],
    ["Café + medialuna + criollo", 4000], ["Medialuna sola", 1000], ["Criollo solo", 800],
    ["Dulce solo", 500], ["Manteca sola", 500], ["Queso crema", 500], ["Mermelada", 400],
    ["Rockstar", 2500], ["Powerade", 3000], ["Monster", 4000], ["Papas Lays", 4500],
    ["Doritos", 4500], ["Tostitos chicos", 4500], ["Tostito grande", 6000],
    ["Tortuguita de ternera", 6000], ["Tortuguita de jamón y queso", 5000],
    ["Alfajores premium", 3000], ["Ramen", 4000], ["Pizzetas", 4500],
  ];
  let i = 0;
  for (const [name, price, color] of panchos) {
    await tx`INSERT INTO products (category_id, name, price, color, sort, is_combo)
      VALUES (${panch.id}, ${name}, ${price}, ${color}, ${++i}, ${name.startsWith("Promo")})`;
  }
  i = 0;
  for (const [name, price] of cafes) {
    await tx`INSERT INTO products (category_id, name, price, color, sort, is_combo)
      VALUES (${cafe.id}, ${name}, ${price}, ${i % 2 ? "#151A1D" : "#8B5A2B"}, ${++i}, ${name.startsWith("Café +")})`;
  }

  await tx`INSERT INTO payment_methods (name, kind, color, sort) VALUES
    ('Efectivo', 'efectivo', '#16A34A', 1),
    ('Transferencia', 'transferencia', '#2563EB', 2),
    ('Mercado Pago / QR', 'otro', '#0EA5E9', 3),
    ('Débito', 'otro', '#7C3AED', 4),
    ('Crédito', 'otro', '#DB2777', 5),
    ('Fiado', 'fiado', '#F59E0B', 6)`;

  await tx`INSERT INTO void_reasons (label, sort) VALUES
    ('Error de carga', 1), ('Cliente se arrepintió', 2), ('Producto faltante', 3), ('Venta duplicada', 4)`;

  await tx`INSERT INTO expense_categories (name, sort) VALUES
    ('Mercadería', 1), ('Bebidas', 2), ('Descartables', 3), ('Servicios', 4), ('Sueldos', 5), ('Otros', 6)`;

  await tx`DELETE FROM modules WHERE key = 'stock'`;
  await tx`INSERT INTO modules (key, name, description, enabled, available, sort) VALUES
    ('fiados', 'Fiados / cuentas corrientes', 'Ventas a cuenta de clientes y cobro de deudas.', true, true, 1),
    ('gastos', 'Gastos y compras', 'Registro de compras de mercadería y otros gastos.', true, true, 2),
    ('caja', 'Movimientos de caja', 'Ingresos y retiros manuales de efectivo.', true, true, 3),
    ('sin_conexion', 'Modo sin conexión', 'Guarda las ventas si se corta internet y las sincroniza después.', true, true, 4),
    ('stock', 'Control de stock', 'Artículos de stock, ingresos de mercadería y descuento automático al vender.', true, true, 10),
    ('promos_horario', 'Promos por día y horario', 'Descuentos automáticos (ej. happy hour).', false, false, 11),
    ('delivery', 'Pedidos para llevar / delivery', 'Tomar pedidos con datos de entrega.', false, false, 12),
    ('sucursales', 'Varias sucursales', 'Administrar más de un local.', false, false, 13),
    ('impresion', 'Ticketera / facturación', 'Imprimir tickets o emitir factura electrónica.', false, false, 14)`;

  await tx`INSERT INTO settings (key, value) VALUES
    ('business_name', ${sql.json("HOT DOG 369")}),
    ('fiado_alert_days', ${sql.json(15)}),
    ('ticket_footer', ${sql.json("¡Gracias por tu compra!")})`;
});

console.log("Datos iniciales cargados.");
console.log("Usuarios de prueba → admin / PIN 3690 · empleado / PIN 1111 · dueno / PIN 2222");
await sql.end();
