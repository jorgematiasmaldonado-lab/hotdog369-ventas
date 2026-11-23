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
