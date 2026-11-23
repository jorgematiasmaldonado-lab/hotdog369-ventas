-- =====================================================================
-- HOT DOG 369 · Base de datos completa (estructura + datos iniciales)
-- Para un proyecto NUEVO y vacío. Supabase → SQL Editor → pegar TODO → Run.
-- Crea todas las tablas (ventas, stock, horas…), activa la seguridad (RLS) y
-- carga productos, medios de pago, roles y usuarios iniciales:
--   admin / PIN 3690 · empleado / PIN 1111 · dueno / PIN 2222
-- (cambiar los PIN desde Administración → Usuarios)
-- =====================================================================

BEGIN;

-- ---------- Estructura ----------
-- HOT DOG 369 · Esquema inicial
-- Montos en pesos enteros (numeric(12,2) para permitir centavos si algún día hiciera falta)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE branches (
  id          serial PRIMARY KEY,
  name        text NOT NULL,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE roles (
  id          serial PRIMARY KEY,
  key         text NOT NULL UNIQUE,
  name        text NOT NULL,
  description text,
  permissions text[] NOT NULL DEFAULT '{}',
  is_system   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id              serial PRIMARY KEY,
  name            text NOT NULL,
  username        text NOT NULL UNIQUE,
  pin_hash        text NOT NULL,
  role_id         int NOT NULL REFERENCES roles(id),
  branch_id       int REFERENCES branches(id),
  active          boolean NOT NULL DEFAULT true,
  failed_attempts int NOT NULL DEFAULT 0,
  locked_until    timestamptz,
  session_version int NOT NULL DEFAULT 1,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE shift_types (
  id      serial PRIMARY KEY,
  name    text NOT NULL,
  sort    int NOT NULL DEFAULT 0,
  active  boolean NOT NULL DEFAULT true
);

CREATE TABLE shifts (
  id             serial PRIMARY KEY,
  branch_id      int NOT NULL REFERENCES branches(id),
  user_id        int NOT NULL REFERENCES users(id),
  shift_type_id  int REFERENCES shift_types(id),
  status         text NOT NULL DEFAULT 'abierto' CHECK (status IN ('abierto','cerrado')),
  opened_at      timestamptz NOT NULL DEFAULT now(),
  closed_at      timestamptz,
  opening_cash   numeric(12,2) NOT NULL DEFAULT 0,
  expected_cash  numeric(12,2),
  counted_cash   numeric(12,2),
  difference     numeric(12,2),
  notes          text
);
CREATE UNIQUE INDEX shifts_one_open_per_user ON shifts(user_id) WHERE status = 'abierto';

CREATE TABLE categories (
  id      serial PRIMARY KEY,
  name    text NOT NULL,
  color   text NOT NULL DEFAULT '#D71B22',
  sort    int NOT NULL DEFAULT 0,
  active  boolean NOT NULL DEFAULT true
);

CREATE TABLE products (
  id           serial PRIMARY KEY,
  category_id  int NOT NULL REFERENCES categories(id),
  name         text NOT NULL,
  price        numeric(12,2) NOT NULL CHECK (price >= 0),
  color        text,
  sort         int NOT NULL DEFAULT 0,
  active       boolean NOT NULL DEFAULT true,
  is_combo     boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Componentes de un combo/promo (preparado para el futuro módulo de stock)
CREATE TABLE combo_items (
  combo_id    int NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_id  int NOT NULL REFERENCES products(id),
  qty         int NOT NULL DEFAULT 1,
  PRIMARY KEY (combo_id, product_id)
);

CREATE TABLE product_price_history (
  id          serial PRIMARY KEY,
  product_id  int NOT NULL REFERENCES products(id),
  old_price   numeric(12,2),
  new_price   numeric(12,2) NOT NULL,
  changed_by  int REFERENCES users(id),
  changed_at  timestamptz NOT NULL DEFAULT now()
);

-- kind: efectivo | transferencia | otro | fiado
CREATE TABLE payment_methods (
  id      serial PRIMARY KEY,
  name    text NOT NULL,
  kind    text NOT NULL DEFAULT 'otro' CHECK (kind IN ('efectivo','transferencia','otro','fiado')),
  color   text NOT NULL DEFAULT '#64748B',
  sort    int NOT NULL DEFAULT 0,
  active  boolean NOT NULL DEFAULT true
);

CREATE TABLE customers (
  id          serial PRIMARY KEY,
  name        text NOT NULL,
  phone       text,
  notes       text,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE void_reasons (
  id      serial PRIMARY KEY,
  label   text NOT NULL,
  sort    int NOT NULL DEFAULT 0,
  active  boolean NOT NULL DEFAULT true
);

CREATE TABLE sales (
  id             uuid PRIMARY KEY,            -- generado en el dispositivo (permite modo sin conexión sin duplicados)
  number         bigserial UNIQUE,
  branch_id      int NOT NULL REFERENCES branches(id),
  shift_id       int REFERENCES shifts(id),
  user_id        int NOT NULL REFERENCES users(id),
  customer_id    int REFERENCES customers(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  total          numeric(12,2) NOT NULL,
  cash_received  numeric(12,2),
  change_given   numeric(12,2),
  status         text NOT NULL DEFAULT 'confirmada' CHECK (status IN ('confirmada','anulada')),
  void_reason    text,
  voided_by      int REFERENCES users(id),
  voided_at      timestamptz,
  edited_at      timestamptz,
  edited_by      int REFERENCES users(id),
  offline        boolean NOT NULL DEFAULT false
);
CREATE INDEX sales_created_at_idx ON sales(created_at);
CREATE INDEX sales_shift_idx ON sales(shift_id);

CREATE TABLE sale_items (
  id            serial PRIMARY KEY,
  sale_id       uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id    int REFERENCES products(id),
  product_name  text NOT NULL,
  category_name text,
  unit_price    numeric(12,2) NOT NULL,
  qty           int NOT NULL CHECK (qty > 0),
  subtotal      numeric(12,2) NOT NULL
);
CREATE INDEX sale_items_sale_idx ON sale_items(sale_id);

CREATE TABLE sale_payments (
  id                 serial PRIMARY KEY,
  sale_id            uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  payment_method_id  int NOT NULL REFERENCES payment_methods(id),
  amount             numeric(12,2) NOT NULL CHECK (amount > 0)
);
CREATE INDEX sale_payments_sale_idx ON sale_payments(sale_id);

-- Cuenta corriente (fiados). cargo suma deuda; pago y anulacion la restan.
CREATE TABLE customer_movements (
  id                 serial PRIMARY KEY,
  customer_id        int NOT NULL REFERENCES customers(id),
  sale_id            uuid REFERENCES sales(id),
  shift_id           int REFERENCES shifts(id),
  type               text NOT NULL CHECK (type IN ('cargo','pago','anulacion','ajuste')),
  amount             numeric(12,2) NOT NULL CHECK (amount > 0),
  payment_method_id  int REFERENCES payment_methods(id),
  user_id            int REFERENCES users(id),
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX customer_movements_customer_idx ON customer_movements(customer_id);

CREATE TABLE expense_categories (
  id      serial PRIMARY KEY,
  name    text NOT NULL,
  sort    int NOT NULL DEFAULT 0,
  active  boolean NOT NULL DEFAULT true
);

CREATE TABLE expenses (
  id                 serial PRIMARY KEY,
  branch_id          int NOT NULL REFERENCES branches(id),
  date               date NOT NULL,
  supplier           text,
  category_id        int REFERENCES expense_categories(id),
  amount             numeric(12,2) NOT NULL CHECK (amount > 0),
  payment_method_id  int REFERENCES payment_methods(id),
  notes              text,
  receipt_image      text,               -- imagen comprimida (data URL)
  user_id            int REFERENCES users(id),
  created_at         timestamptz NOT NULL DEFAULT now(),
  deleted_at         timestamptz
);

CREATE TABLE cash_movements (
  id          serial PRIMARY KEY,
  branch_id   int NOT NULL REFERENCES branches(id),
  shift_id    int REFERENCES shifts(id),
  type        text NOT NULL CHECK (type IN ('ingreso','retiro')),
  amount      numeric(12,2) NOT NULL CHECK (amount > 0),
  reason      text NOT NULL,
  user_id     int REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE modules (
  key          text PRIMARY KEY,
  name         text NOT NULL,
  description  text,
  enabled      boolean NOT NULL DEFAULT false,
  available    boolean NOT NULL DEFAULT true,   -- false = "próximamente"
  config       jsonb NOT NULL DEFAULT '{}',
  sort         int NOT NULL DEFAULT 0
);

CREATE TABLE settings (
  key    text PRIMARY KEY,
  value  jsonb NOT NULL
);

CREATE TABLE audit_log (
  id          bigserial PRIMARY KEY,
  at          timestamptz NOT NULL DEFAULT now(),
  user_id     int REFERENCES users(id),
  action      text NOT NULL,
  entity      text NOT NULL,
  entity_id   text,
  before      jsonb,
  after       jsonb,
  notes       text
);
CREATE INDEX audit_log_at_idx ON audit_log(at DESC);

CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());

-- ---------- Seguridad (RLS) ----------
-- Seguridad para Supabase (y cualquier Postgres): activa Row Level Security en todas
-- las tablas del esquema public, sin políticas. Así la Data API de Supabase (roles anon /
-- authenticated) no puede leer ni modificar nada. La app se conecta como dueña de las
-- tablas, que no está alcanzada por RLS, por lo que sigue funcionando igual.
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;

-- ---------- Stock, horas y respaldos ----------
-- HOT DOG 369 · Stock, control de stock al abrir turno, horas del personal y respaldos.
-- Idempotente: se puede ejecutar más de una vez sin romper nada.

-- ---------- Stock ----------
CREATE TABLE IF NOT EXISTS stock_items (
  id              serial PRIMARY KEY,
  name            text NOT NULL,
  unit            text NOT NULL DEFAULT 'u',
  quantity        numeric(12,3) NOT NULL DEFAULT 0,
  min_quantity    numeric(12,3) NOT NULL DEFAULT 0,      -- alerta de stock bajo
  cost            numeric(12,2),                          -- último costo unitario
  count_on_shift  boolean NOT NULL DEFAULT true,          -- se cuenta al abrir turno
  sort            int NOT NULL DEFAULT 0,
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Qué artículos descuenta cada producto al venderse ("receta")
CREATE TABLE IF NOT EXISTS product_components (
  product_id     int NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  stock_item_id  int NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
  qty            numeric(12,3) NOT NULL CHECK (qty > 0),
  PRIMARY KEY (product_id, stock_item_id)
);

CREATE TABLE IF NOT EXISTS stock_counts (
  id           serial PRIMARY KEY,
  shift_id     int REFERENCES shifts(id),
  user_id      int REFERENCES users(id),
  notes        text,
  items_count  int NOT NULL DEFAULT 0,
  differences  int NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stock_count_lines (
  count_id       int NOT NULL REFERENCES stock_counts(id) ON DELETE CASCADE,
  stock_item_id  int NOT NULL REFERENCES stock_items(id),
  expected       numeric(12,3) NOT NULL,
  counted        numeric(12,3) NOT NULL,
  difference     numeric(12,3) NOT NULL,
  PRIMARY KEY (count_id, stock_item_id)
);

-- Cada cambio de stock queda registrado (qty con signo: + entra, − sale)
CREATE TABLE IF NOT EXISTS stock_movements (
  id             bigserial PRIMARY KEY,
  stock_item_id  int NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
  type           text NOT NULL CHECK (type IN ('ingreso','venta','anulacion','edicion','ajuste','control')),
  qty            numeric(12,3) NOT NULL,
  balance_after  numeric(12,3) NOT NULL,
  sale_id        uuid REFERENCES sales(id) ON DELETE SET NULL,
  count_id       int REFERENCES stock_counts(id) ON DELETE SET NULL,
  unit_cost      numeric(12,2),
  supplier       text,
  notes          text,
  user_id        int REFERENCES users(id),
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stock_movements_item_idx ON stock_movements(stock_item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS stock_movements_sale_idx ON stock_movements(sale_id);

-- ---------- Horas del personal ----------
CREATE TABLE IF NOT EXISTS time_entries (
  id          serial PRIMARY KEY,
  user_id     int NOT NULL REFERENCES users(id),
  clock_in    timestamptz NOT NULL,
  clock_out   timestamptz,
  shift_id    int REFERENCES shifts(id) ON DELETE SET NULL,
  source      text NOT NULL DEFAULT 'fichada' CHECK (source IN ('fichada','turno','manual')),
  notes       text,
  created_by  int REFERENCES users(id),
  edited_by   int REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (clock_out IS NULL OR clock_out > clock_in)
);
CREATE UNIQUE INDEX IF NOT EXISTS time_entries_one_open ON time_entries(user_id) WHERE clock_out IS NULL;
CREATE INDEX IF NOT EXISTS time_entries_user_idx ON time_entries(user_id, clock_in DESC);

CREATE TABLE IF NOT EXISTS time_off (
  id          serial PRIMARY KEY,
  user_id     int NOT NULL REFERENCES users(id),
  date        date NOT NULL,
  type        text NOT NULL CHECK (type IN ('franco','vacaciones','enfermedad','falta','licencia','otro')),
  notes       text,
  created_by  int REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

-- ---------- Módulos y configuración ----------
UPDATE modules SET available = true, enabled = true,
  description = 'Artículos de stock, ingresos de mercadería y descuento automático al vender.'
  WHERE key = 'stock';
INSERT INTO modules (key, name, description, enabled, available, sort) VALUES
  ('personal', 'Horas del personal', 'Fichadas de entrada y salida, francos, vacaciones y faltas.', true, true, 5)
  ON CONFLICT (key) DO NOTHING;

INSERT INTO settings (key, value) VALUES
  ('stock_control_on_open', '"obligatorio"'),
  ('backup_reminder_days', '3')
  ON CONFLICT (key) DO NOTHING;

-- ---------- Permisos nuevos por rol ----------
UPDATE roles SET permissions = ARRAY(SELECT DISTINCT unnest(permissions || ARRAY[
  'stock.ver','stock.gestionar','stock.contar','horas.fichar','horas.ver','horas.gestionar','respaldo.gestionar']))
  WHERE key = 'admin';
UPDATE roles SET permissions = ARRAY(SELECT DISTINCT unnest(permissions || ARRAY['stock.contar','horas.fichar']))
  WHERE key = 'empleado';
UPDATE roles SET permissions = ARRAY(SELECT DISTINCT unnest(permissions || ARRAY['stock.ver','horas.ver']))
  WHERE key = 'dueno';

-- ---------- Seguridad: RLS en las tablas nuevas ----------
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND NOT rowsecurity LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;

-- ---------- Avisos en el celular ----------
-- HOT DOG 369 · Notificaciones en el celular (Web Push) para avisos de stock bajo.
-- Idempotente.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          serial PRIMARY KEY,
  user_id     int NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint    text NOT NULL UNIQUE,
  p256dh      text NOT NULL,
  auth        text NOT NULL,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  last_ok_at  timestamptz
);
CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON push_subscriptions(user_id);

DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND NOT rowsecurity LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;

-- ---------- Datos iniciales ----------

INSERT INTO public.branches (id, name, active, created_at) VALUES (1, 'HOT DOG 369 - Local principal', true, '2026-11-23 22:57:48.293648+00') ON CONFLICT DO NOTHING;

INSERT INTO public.roles (id, key, name, description, permissions, is_system, created_at) VALUES (1, 'admin', 'Administrador', 'Acceso total: edita, configura, reportes, gastos y caja.', '{ventas.crear,ventas.anular,ventas.ver_todas,ventas.editar,turnos.operar,turnos.ver_todos,fiados.gestionar,fiados.ver,caja.gestionar,gastos.gestionar,gastos.ver,dashboard.ver,reportes.ver,productos.gestionar,usuarios.gestionar,config.gestionar,auditoria.ver,stock.ver,stock.gestionar,stock.contar,horas.fichar,horas.ver,horas.gestionar,respaldo.gestionar}', true, '2026-11-23 22:57:48.293648+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles (id, key, name, description, permissions, is_system, created_at) VALUES (2, 'empleado', 'Empleado', 'Registra ventas, fiados y puede anular sus ventas indicando el motivo.', '{ventas.crear,ventas.anular,turnos.operar,fiados.gestionar,fiados.ver,stock.contar,horas.fichar}', true, '2026-11-23 22:57:48.293648+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles (id, key, name, description, permissions, is_system, created_at) VALUES (3, 'dueno', 'Dueño (solo lectura)', 'Ve ventas, reportes y movimientos. No puede cargar ni modificar nada.', '{ventas.ver_todas,turnos.ver_todos,fiados.ver,gastos.ver,dashboard.ver,reportes.ver,auditoria.ver,stock.ver,horas.ver}', true, '2026-11-23 22:57:48.293648+00') ON CONFLICT DO NOTHING;

INSERT INTO public.users (id, name, username, pin_hash, role_id, branch_id, active, failed_attempts, locked_until, session_version, created_at) VALUES (1, 'Administrador', 'admin', '$2b$10$CV0vyJao.SJobTs8xDAPB.pEXONtOGNVI7aAGRjg0ky491A0jWPEO', 1, 1, true, 0, NULL, 1, '2026-11-23 22:57:48.293648+00') ON CONFLICT DO NOTHING;
INSERT INTO public.users (id, name, username, pin_hash, role_id, branch_id, active, failed_attempts, locked_until, session_version, created_at) VALUES (2, 'Empleado de prueba', 'empleado', '$2b$10$gs1pWyTkKsKH2HfC5FaBre7qfWqSciBJdImNg/PS96MMK8tHx.bzu', 2, 1, true, 0, NULL, 1, '2026-11-23 22:57:48.293648+00') ON CONFLICT DO NOTHING;
INSERT INTO public.users (id, name, username, pin_hash, role_id, branch_id, active, failed_attempts, locked_until, session_version, created_at) VALUES (3, 'Dueño', 'dueno', '$2b$10$SPpYKr14RtsaNHPESfkjrO42sBENHjZcnCqoRJHRPdpF8t2asx2DW', 3, 1, true, 0, NULL, 1, '2026-11-23 22:57:48.293648+00') ON CONFLICT DO NOTHING;

INSERT INTO public.shift_types (id, name, sort, active) VALUES (1, 'Mañana', 1, true) ON CONFLICT DO NOTHING;
INSERT INTO public.shift_types (id, name, sort, active) VALUES (2, 'Tarde', 2, true) ON CONFLICT DO NOTHING;
INSERT INTO public.shift_types (id, name, sort, active) VALUES (3, 'Noche', 3, true) ON CONFLICT DO NOTHING;

INSERT INTO public.categories (id, name, color, sort, active) VALUES (1, 'Panchería', '#D71B22', 1, true) ON CONFLICT DO NOTHING;
INSERT INTO public.categories (id, name, color, sort, active) VALUES (2, 'Cafetería', '#8B5A2B', 2, true) ON CONFLICT DO NOTHING;

INSERT INTO public.products (id, category_id, name, price, color, sort, active, is_combo, created_at) VALUES (1, 1, 'Pancho clásico', 5000.00, '#D71B22', 1, true, false, '2026-11-23 22:57:48.293648+00') ON CONFLICT DO NOTHING;
INSERT INTO public.products (id, category_id, name, price, color, sort, active, is_combo, created_at) VALUES (2, 1, 'Promo pancho + Coca 237 ml', 6800.00, '#D71B22', 2, true, true, '2026-11-23 22:57:48.293648+00') ON CONFLICT DO NOTHING;
INSERT INTO public.products (id, category_id, name, price, color, sort, active, is_combo, created_at) VALUES (3, 1, 'Promo pancho + jugo chico', 6000.00, '#D71B22', 3, true, true, '2026-11-23 22:57:48.293648+00') ON CONFLICT DO NOTHING;
INSERT INTO public.products (id, category_id, name, price, color, sort, active, is_combo, created_at) VALUES (4, 1, 'Pancho vegano', 8000.00, '#151A1D', 4, true, false, '2026-11-23 22:57:48.293648+00') ON CONFLICT DO NOTHING;
INSERT INTO public.products (id, category_id, name, price, color, sort, active, is_combo, created_at) VALUES (5, 1, 'Pancho alemán', 8000.00, '#D71B22', 5, true, false, '2026-11-23 22:57:48.293648+00') ON CONFLICT DO NOTHING;
INSERT INTO public.products (id, category_id, name, price, color, sort, active, is_combo, created_at) VALUES (6, 1, 'Tostado', 8000.00, '#151A1D', 6, true, false, '2026-11-23 22:57:48.293648+00') ON CONFLICT DO NOTHING;
INSERT INTO public.products (id, category_id, name, price, color, sort, active, is_combo, created_at) VALUES (7, 1, 'Postres', 4500.00, '#D71B22', 7, true, false, '2026-11-23 22:57:48.293648+00') ON CONFLICT DO NOTHING;
INSERT INTO public.products (id, category_id, name, price, color, sort, active, is_combo, created_at) VALUES (8, 1, 'Bebida 350 cc', 2100.00, '#151A1D', 8, true, false, '2026-11-23 22:57:48.293648+00') ON CONFLICT DO NOTHING;
INSERT INTO public.products (id, category_id, name, price, color, sort, active, is_combo, created_at) VALUES (9, 1, 'Coca 500 cc', 2500.00, '#D71B22', 9, true, false, '2026-11-23 22:57:48.293648+00') ON CONFLICT DO NOTHING;
INSERT INTO public.products (id, category_id, name, price, color, sort, active, is_combo, created_at) VALUES (10, 1, 'Agua 500 cc', 2500.00, '#151A1D', 10, true, false, '2026-11-23 22:57:48.293648+00') ON CONFLICT DO NOTHING;
INSERT INTO public.products (id, category_id, name, price, color, sort, active, is_combo, created_at) VALUES (11, 1, 'Latas', 2300.00, '#D71B22', 11, true, false, '2026-11-23 22:57:48.293648+00') ON CONFLICT DO NOTHING;
INSERT INTO public.products (id, category_id, name, price, color, sort, active, is_combo, created_at) VALUES (12, 1, 'Agua saborizada', 2500.00, '#151A1D', 12, true, false, '2026-11-23 22:57:48.293648+00') ON CONFLICT DO NOTHING;
INSERT INTO public.products (id, category_id, name, price, color, sort, active, is_combo, created_at) VALUES (13, 1, 'Coca 237 ml', 1800.00, '#D71B22', 13, true, false, '2026-11-23 22:57:48.293648+00') ON CONFLICT DO NOTHING;
INSERT INTO public.products (id, category_id, name, price, color, sort, active, is_combo, created_at) VALUES (14, 2, 'Café solo', 2500.00, '#8B5A2B', 1, true, false, '2026-11-23 22:57:48.293648+00') ON CONFLICT DO NOTHING;
INSERT INTO public.products (id, category_id, name, price, color, sort, active, is_combo, created_at) VALUES (15, 2, 'Café + 2 criollos', 4000.00, '#151A1D', 2, true, true, '2026-11-23 22:57:48.293648+00') ON CONFLICT DO NOTHING;
INSERT INTO public.products (id, category_id, name, price, color, sort, active, is_combo, created_at) VALUES (16, 2, 'Café + medialuna', 3500.00, '#8B5A2B', 3, true, true, '2026-11-23 22:57:48.293648+00') ON CONFLICT DO NOTHING;
INSERT INTO public.products (id, category_id, name, price, color, sort, active, is_combo, created_at) VALUES (17, 2, 'Café + medialuna + criollo', 4000.00, '#151A1D', 4, true, true, '2026-11-23 22:57:48.293648+00') ON CONFLICT DO NOTHING;
INSERT INTO public.products (id, category_id, name, price, color, sort, active, is_combo, created_at) VALUES (18, 2, 'Medialuna sola', 1000.00, '#8B5A2B', 5, true, false, '2026-11-23 22:57:48.293648+00') ON CONFLICT DO NOTHING;
INSERT INTO public.products (id, category_id, name, price, color, sort, active, is_combo, created_at) VALUES (19, 2, 'Criollo solo', 800.00, '#151A1D', 6, true, false, '2026-11-23 22:57:48.293648+00') ON CONFLICT DO NOTHING;
INSERT INTO public.products (id, category_id, name, price, color, sort, active, is_combo, created_at) VALUES (20, 2, 'Dulce solo', 500.00, '#8B5A2B', 7, true, false, '2026-11-23 22:57:48.293648+00') ON CONFLICT DO NOTHING;
INSERT INTO public.products (id, category_id, name, price, color, sort, active, is_combo, created_at) VALUES (21, 2, 'Manteca sola', 500.00, '#151A1D', 8, true, false, '2026-11-23 22:57:48.293648+00') ON CONFLICT DO NOTHING;
INSERT INTO public.products (id, category_id, name, price, color, sort, active, is_combo, created_at) VALUES (22, 2, 'Queso crema', 500.00, '#8B5A2B', 9, true, false, '2026-11-23 22:57:48.293648+00') ON CONFLICT DO NOTHING;
INSERT INTO public.products (id, category_id, name, price, color, sort, active, is_combo, created_at) VALUES (23, 2, 'Mermelada', 400.00, '#151A1D', 10, true, false, '2026-11-23 22:57:48.293648+00') ON CONFLICT DO NOTHING;
INSERT INTO public.products (id, category_id, name, price, color, sort, active, is_combo, created_at) VALUES (24, 2, 'Rockstar', 2500.00, '#8B5A2B', 11, true, false, '2026-11-23 22:57:48.293648+00') ON CONFLICT DO NOTHING;
INSERT INTO public.products (id, category_id, name, price, color, sort, active, is_combo, created_at) VALUES (25, 2, 'Powerade', 3000.00, '#151A1D', 12, true, false, '2026-11-23 22:57:48.293648+00') ON CONFLICT DO NOTHING;
INSERT INTO public.products (id, category_id, name, price, color, sort, active, is_combo, created_at) VALUES (26, 2, 'Monster', 4000.00, '#8B5A2B', 13, true, false, '2026-11-23 22:57:48.293648+00') ON CONFLICT DO NOTHING;
INSERT INTO public.products (id, category_id, name, price, color, sort, active, is_combo, created_at) VALUES (27, 2, 'Papas Lays', 4500.00, '#151A1D', 14, true, false, '2026-11-23 22:57:48.293648+00') ON CONFLICT DO NOTHING;
INSERT INTO public.products (id, category_id, name, price, color, sort, active, is_combo, created_at) VALUES (28, 2, 'Doritos', 4500.00, '#8B5A2B', 15, true, false, '2026-11-23 22:57:48.293648+00') ON CONFLICT DO NOTHING;
INSERT INTO public.products (id, category_id, name, price, color, sort, active, is_combo, created_at) VALUES (29, 2, 'Tostitos chicos', 4500.00, '#151A1D', 16, true, false, '2026-11-23 22:57:48.293648+00') ON CONFLICT DO NOTHING;
INSERT INTO public.products (id, category_id, name, price, color, sort, active, is_combo, created_at) VALUES (30, 2, 'Tostito grande', 6000.00, '#8B5A2B', 17, true, false, '2026-11-23 22:57:48.293648+00') ON CONFLICT DO NOTHING;
INSERT INTO public.products (id, category_id, name, price, color, sort, active, is_combo, created_at) VALUES (31, 2, 'Tortuguita de ternera', 6000.00, '#151A1D', 18, true, false, '2026-11-23 22:57:48.293648+00') ON CONFLICT DO NOTHING;
INSERT INTO public.products (id, category_id, name, price, color, sort, active, is_combo, created_at) VALUES (32, 2, 'Tortuguita de jamón y queso', 5000.00, '#8B5A2B', 19, true, false, '2026-11-23 22:57:48.293648+00') ON CONFLICT DO NOTHING;
INSERT INTO public.products (id, category_id, name, price, color, sort, active, is_combo, created_at) VALUES (33, 2, 'Alfajores premium', 3000.00, '#151A1D', 20, true, false, '2026-11-23 22:57:48.293648+00') ON CONFLICT DO NOTHING;
INSERT INTO public.products (id, category_id, name, price, color, sort, active, is_combo, created_at) VALUES (34, 2, 'Ramen', 4000.00, '#8B5A2B', 21, true, false, '2026-11-23 22:57:48.293648+00') ON CONFLICT DO NOTHING;
INSERT INTO public.products (id, category_id, name, price, color, sort, active, is_combo, created_at) VALUES (35, 2, 'Pizzetas', 4500.00, '#151A1D', 22, true, false, '2026-11-23 22:57:48.293648+00') ON CONFLICT DO NOTHING;

INSERT INTO public.payment_methods (id, name, kind, color, sort, active) VALUES (1, 'Efectivo', 'efectivo', '#16A34A', 1, true) ON CONFLICT DO NOTHING;
INSERT INTO public.payment_methods (id, name, kind, color, sort, active) VALUES (2, 'Transferencia', 'transferencia', '#2563EB', 2, true) ON CONFLICT DO NOTHING;
INSERT INTO public.payment_methods (id, name, kind, color, sort, active) VALUES (3, 'Mercado Pago / QR', 'otro', '#0EA5E9', 3, true) ON CONFLICT DO NOTHING;
INSERT INTO public.payment_methods (id, name, kind, color, sort, active) VALUES (4, 'Débito', 'otro', '#7C3AED', 4, true) ON CONFLICT DO NOTHING;
INSERT INTO public.payment_methods (id, name, kind, color, sort, active) VALUES (5, 'Crédito', 'otro', '#DB2777', 5, true) ON CONFLICT DO NOTHING;
INSERT INTO public.payment_methods (id, name, kind, color, sort, active) VALUES (6, 'Fiado', 'fiado', '#F59E0B', 6, true) ON CONFLICT DO NOTHING;

INSERT INTO public.expense_categories (id, name, sort, active) VALUES (1, 'Mercadería', 1, true) ON CONFLICT DO NOTHING;
INSERT INTO public.expense_categories (id, name, sort, active) VALUES (2, 'Bebidas', 2, true) ON CONFLICT DO NOTHING;
INSERT INTO public.expense_categories (id, name, sort, active) VALUES (3, 'Descartables', 3, true) ON CONFLICT DO NOTHING;
INSERT INTO public.expense_categories (id, name, sort, active) VALUES (4, 'Servicios', 4, true) ON CONFLICT DO NOTHING;
INSERT INTO public.expense_categories (id, name, sort, active) VALUES (5, 'Sueldos', 5, true) ON CONFLICT DO NOTHING;
INSERT INTO public.expense_categories (id, name, sort, active) VALUES (6, 'Otros', 6, true) ON CONFLICT DO NOTHING;

INSERT INTO public.modules (key, name, description, enabled, available, config, sort) VALUES ('personal', 'Horas del personal', 'Fichadas de entrada y salida, francos, vacaciones y faltas.', true, true, '{}', 5) ON CONFLICT DO NOTHING;
INSERT INTO public.modules (key, name, description, enabled, available, config, sort) VALUES ('fiados', 'Fiados / cuentas corrientes', 'Ventas a cuenta de clientes y cobro de deudas.', true, true, '{}', 1) ON CONFLICT DO NOTHING;
INSERT INTO public.modules (key, name, description, enabled, available, config, sort) VALUES ('gastos', 'Gastos y compras', 'Registro de compras de mercadería y otros gastos.', true, true, '{}', 2) ON CONFLICT DO NOTHING;
INSERT INTO public.modules (key, name, description, enabled, available, config, sort) VALUES ('caja', 'Movimientos de caja', 'Ingresos y retiros manuales de efectivo.', true, true, '{}', 3) ON CONFLICT DO NOTHING;
INSERT INTO public.modules (key, name, description, enabled, available, config, sort) VALUES ('sin_conexion', 'Modo sin conexión', 'Guarda las ventas si se corta internet y las sincroniza después.', true, true, '{}', 4) ON CONFLICT DO NOTHING;
INSERT INTO public.modules (key, name, description, enabled, available, config, sort) VALUES ('stock', 'Control de stock', 'Artículos de stock, ingresos de mercadería y descuento automático al vender.', true, true, '{}', 10) ON CONFLICT DO NOTHING;
INSERT INTO public.modules (key, name, description, enabled, available, config, sort) VALUES ('promos_horario', 'Promos por día y horario', 'Descuentos automáticos (ej. happy hour).', false, false, '{}', 11) ON CONFLICT DO NOTHING;
INSERT INTO public.modules (key, name, description, enabled, available, config, sort) VALUES ('delivery', 'Pedidos para llevar / delivery', 'Tomar pedidos con datos de entrega.', false, false, '{}', 12) ON CONFLICT DO NOTHING;
INSERT INTO public.modules (key, name, description, enabled, available, config, sort) VALUES ('sucursales', 'Varias sucursales', 'Administrar más de un local.', false, false, '{}', 13) ON CONFLICT DO NOTHING;
INSERT INTO public.modules (key, name, description, enabled, available, config, sort) VALUES ('impresion', 'Ticketera / facturación', 'Imprimir tickets o emitir factura electrónica.', false, false, '{}', 14) ON CONFLICT DO NOTHING;

INSERT INTO public.schema_migrations (name, applied_at) VALUES ('001_init.sql', '2026-11-23 22:57:48.103433+00') ON CONFLICT DO NOTHING;
INSERT INTO public.schema_migrations (name, applied_at) VALUES ('002_rls.sql', '2026-11-23 22:57:48.178253+00') ON CONFLICT DO NOTHING;
INSERT INTO public.schema_migrations (name, applied_at) VALUES ('003_stock_horas.sql', '2026-11-23 22:57:48.184766+00') ON CONFLICT DO NOTHING;
INSERT INTO public.schema_migrations (name, applied_at) VALUES ('004_push.sql', '2026-11-23 22:57:48.215911+00') ON CONFLICT DO NOTHING;

INSERT INTO public.settings (key, value) VALUES ('stock_control_on_open', '"obligatorio"') ON CONFLICT DO NOTHING;
INSERT INTO public.settings (key, value) VALUES ('backup_reminder_days', '3') ON CONFLICT DO NOTHING;
INSERT INTO public.settings (key, value) VALUES ('business_name', '"HOT DOG 369"') ON CONFLICT DO NOTHING;
INSERT INTO public.settings (key, value) VALUES ('fiado_alert_days', '15') ON CONFLICT DO NOTHING;
INSERT INTO public.settings (key, value) VALUES ('ticket_footer', '"¡Gracias por tu compra!"') ON CONFLICT DO NOTHING;

INSERT INTO public.void_reasons (id, label, sort, active) VALUES (1, 'Error de carga', 1, true) ON CONFLICT DO NOTHING;
INSERT INTO public.void_reasons (id, label, sort, active) VALUES (2, 'Cliente se arrepintió', 2, true) ON CONFLICT DO NOTHING;
INSERT INTO public.void_reasons (id, label, sort, active) VALUES (3, 'Producto faltante', 3, true) ON CONFLICT DO NOTHING;
INSERT INTO public.void_reasons (id, label, sort, active) VALUES (4, 'Venta duplicada', 4, true) ON CONFLICT DO NOTHING;

SELECT pg_catalog.setval('public.audit_log_id_seq', 1, false);

SELECT pg_catalog.setval('public.branches_id_seq', 1, true);

SELECT pg_catalog.setval('public.cash_movements_id_seq', 1, false);

SELECT pg_catalog.setval('public.categories_id_seq', 2, true);

SELECT pg_catalog.setval('public.customer_movements_id_seq', 1, false);

SELECT pg_catalog.setval('public.customers_id_seq', 1, false);

SELECT pg_catalog.setval('public.expense_categories_id_seq', 6, true);

SELECT pg_catalog.setval('public.expenses_id_seq', 1, false);

SELECT pg_catalog.setval('public.payment_methods_id_seq', 6, true);

SELECT pg_catalog.setval('public.product_price_history_id_seq', 1, false);

SELECT pg_catalog.setval('public.products_id_seq', 35, true);

SELECT pg_catalog.setval('public.push_subscriptions_id_seq', 1, false);

SELECT pg_catalog.setval('public.roles_id_seq', 3, true);

SELECT pg_catalog.setval('public.sale_items_id_seq', 1, false);

SELECT pg_catalog.setval('public.sale_payments_id_seq', 1, false);

SELECT pg_catalog.setval('public.sales_number_seq', 1, false);

SELECT pg_catalog.setval('public.shift_types_id_seq', 3, true);

SELECT pg_catalog.setval('public.shifts_id_seq', 1, false);

SELECT pg_catalog.setval('public.stock_counts_id_seq', 1, false);

SELECT pg_catalog.setval('public.stock_items_id_seq', 1, false);

SELECT pg_catalog.setval('public.stock_movements_id_seq', 1, false);

SELECT pg_catalog.setval('public.time_entries_id_seq', 1, false);

SELECT pg_catalog.setval('public.time_off_id_seq', 1, false);

SELECT pg_catalog.setval('public.users_id_seq', 3, true);

SELECT pg_catalog.setval('public.void_reasons_id_seq', 4, true);


COMMIT;
