-- =====================================================================
-- HOT DOG 369 · Actualización: stock, control de stock, horas y respaldos
-- Para una base que YA está funcionando (creada con 01_estructura_y_datos.sql).
-- Cómo usar: Supabase → SQL Editor → New query → pegar TODO → Run.
-- No borra ni modifica ventas. Se puede ejecutar más de una vez sin problemas.
-- =====================================================================

BEGIN;

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

INSERT INTO schema_migrations (name) VALUES ('003_stock_horas.sql') ON CONFLICT (name) DO NOTHING;

COMMIT;

SELECT 'Actualización aplicada' AS resultado, (SELECT count(*) FROM schema_migrations) AS migraciones;
