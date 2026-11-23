-- =====================================================================
-- HOT DOG 369 · Ventas de DEMOSTRACIÓN (opcional, datos ficticios)
-- Genera ~30 días de ventas, turnos, fiados y gastos para mostrar la app.
-- Cómo usar: Supabase → SQL Editor → New query → pegar TODO → Run.
-- Ejecutar DESPUÉS de 01_estructura_y_datos.sql.
-- Si ya hay ventas cargadas no hace nada (no duplica).
-- NO usar en la base real del negocio.
-- =====================================================================
DO $$
DECLARE
  tz constant text := 'America/Argentina/Buenos_Aires';
  hour_w constant numeric[] := '{2,2,2,2,2,2,2,2,3,5,4,5,9,10,5,3,4,6,6,8,11,12,9,4}'; -- índice = hora + 1
  dow_f constant numeric[] := '{1.5,0.8,0.85,0.9,1.0,1.4,1.7}';                         -- índice = día (0=dom) + 1
  suppliers constant text[] := '{"Distribuidora Norte","Panificadora Sol","Coca-Cola FEMSA","Fiambrería Don José"}';
  reasons constant text[] := '{"Error de carga","Cliente se arrepintió","Venta duplicada"}';
  p_id int[]; p_name text[]; p_price numeric[]; p_cat text[];
  cafe_idx int[]; panch_idx int[]; all_idx int[];
  users_ids int[]; cust int[] := '{}';
  pm_cash int; pm_transfer int; pm_fiado int; pm_others int[];
  v_branch int; t_morning int; t_afternoon int; exp_cats int[];
  today date := (now() AT TIME ZONE tz)::date;
  d int; day date; ti int; h0 int; h1 int; h int; n int; k int; j int; nitems int; q int; idx int;
  v_user int; v_shift int; v_open timestamptz; v_close timestamptz; v_at timestamptz;
  v_sale uuid; v_total numeric; v_cash numeric; v_cashin numeric; r numeric; v_void boolean; v_cust int; v_diff numeric;
  pool int[];
  items_idx int[]; items_q int[];
BEGIN
  IF EXISTS (SELECT 1 FROM sales) THEN
    RAISE NOTICE 'Ya hay ventas cargadas: no se generan datos de demostración.';
    RETURN;
  END IF;

  SELECT array_agg(p.id ORDER BY p.id), array_agg(p.name ORDER BY p.id), array_agg(p.price ORDER BY p.id), array_agg(c.name ORDER BY p.id)
    INTO p_id, p_name, p_price, p_cat
    FROM products p JOIN categories c ON c.id = p.category_id WHERE p.active;
  FOR j IN 1 .. array_length(p_id, 1) LOOP
    all_idx := all_idx || j;
    IF p_cat[j] = 'Cafetería' THEN cafe_idx := cafe_idx || j; ELSE panch_idx := panch_idx || j; END IF;
  END LOOP;

  SELECT array_agg(u.id) INTO users_ids FROM users u JOIN roles ro ON ro.id = u.role_id WHERE ro.key IN ('empleado', 'admin');
  SELECT id INTO pm_cash FROM payment_methods WHERE kind = 'efectivo' ORDER BY sort LIMIT 1;
  SELECT id INTO pm_transfer FROM payment_methods WHERE kind = 'transferencia' ORDER BY sort LIMIT 1;
  SELECT id INTO pm_fiado FROM payment_methods WHERE kind = 'fiado' ORDER BY sort LIMIT 1;
  SELECT array_agg(id) INTO pm_others FROM payment_methods WHERE kind = 'otro';
  SELECT min(id) INTO v_branch FROM branches;
  SELECT id INTO t_morning FROM shift_types ORDER BY sort LIMIT 1;
  SELECT id INTO t_afternoon FROM shift_types ORDER BY sort OFFSET 1 LIMIT 1;
  SELECT array_agg(id) INTO exp_cats FROM expense_categories;

  INSERT INTO customers (name, phone)
    SELECT nm, '351' || (1000000 + floor(random() * 8999999))::int
    FROM unnest('{"María Gómez","Lucas Fernández","Sofía Díaz","Kiosco La Esquina","Martín López"}'::text[]) nm;
  SELECT array_agg(id ORDER BY id) INTO cust FROM customers;

  FOR d IN REVERSE 30 .. 0 LOOP
    day := today - d;
    FOR ti IN 1 .. 2 LOOP
      IF ti = 1 THEN h0 := 8; h1 := 15; ELSE h0 := 16; h1 := 23; END IF;
      v_open := (day + make_interval(hours => h0)) AT TIME ZONE tz;
      v_close := (day + make_interval(hours => h1, mins => 59)) AT TIME ZONE tz;
      CONTINUE WHEN v_open > now();
      v_user := users_ids[1 + floor(random() * array_length(users_ids, 1))::int];
      INSERT INTO shifts (branch_id, user_id, shift_type_id, status, opened_at, closed_at, opening_cash)
        VALUES (v_branch, v_user, CASE WHEN ti = 1 THEN t_morning ELSE t_afternoon END, 'cerrado', v_open, v_close, 10000)
        RETURNING id INTO v_shift;
      v_cashin := 0;

      FOR h IN h0 .. h1 LOOP
        n := round(hour_w[h + 1] * dow_f[extract(dow FROM day)::int + 1] * (0.6 + random() * 0.8));
        FOR k IN 1 .. n LOOP
          v_at := v_open + make_interval(hours => h - h0, secs => floor(random() * 3540));
          CONTINUE WHEN v_at > now();
          pool := CASE WHEN h < 12 THEN cafe_idx WHEN h < 16 THEN all_idx WHEN random() < 0.3 THEN all_idx ELSE panch_idx END;
          nitems := 1 + floor(random() * 3)::int;
          items_idx := '{}'; items_q := '{}'; v_total := 0;
          FOR j IN 1 .. nitems LOOP
            idx := pool[1 + floor(random() * array_length(pool, 1))::int];
            q := CASE WHEN random() < 0.8 THEN 1 ELSE 2 END;
            items_idx := items_idx || idx; items_q := items_q || q;
            v_total := v_total + p_price[idx] * q;
          END LOOP;

          v_sale := gen_random_uuid();
          v_void := random() < 0.02;
          r := random(); v_cust := NULL;
          IF r >= 0.97 THEN v_cust := cust[1 + floor(random() * array_length(cust, 1))::int]; END IF;

          INSERT INTO sales (id, branch_id, shift_id, user_id, customer_id, created_at, total, status, void_reason, voided_by, voided_at)
            VALUES (v_sale, v_branch, v_shift, v_user, v_cust, v_at, v_total,
                    CASE WHEN v_void THEN 'anulada' ELSE 'confirmada' END,
                    CASE WHEN v_void THEN reasons[1 + floor(random() * 3)::int] END,
                    CASE WHEN v_void THEN v_user END, CASE WHEN v_void THEN v_at END);
          FOR j IN 1 .. nitems LOOP
            idx := items_idx[j];
            INSERT INTO sale_items (sale_id, product_id, product_name, category_name, unit_price, qty, subtotal)
              VALUES (v_sale, p_id[idx], p_name[idx], p_cat[idx], p_price[idx], items_q[j], p_price[idx] * items_q[j]);
          END LOOP;

          v_cash := 0;
          IF r < 0.45 THEN
            INSERT INTO sale_payments (sale_id, payment_method_id, amount) VALUES (v_sale, pm_cash, v_total); v_cash := v_total;
          ELSIF r < 0.82 THEN
            INSERT INTO sale_payments (sale_id, payment_method_id, amount) VALUES (v_sale, pm_transfer, v_total);
          ELSIF r < 0.92 THEN
            INSERT INTO sale_payments (sale_id, payment_method_id, amount)
              VALUES (v_sale, pm_others[1 + floor(random() * array_length(pm_others, 1))::int], v_total);
          ELSIF r < 0.97 THEN
            v_cash := round(v_total / 2 / 100) * 100;
            INSERT INTO sale_payments (sale_id, payment_method_id, amount) VALUES (v_sale, pm_cash, v_cash), (v_sale, pm_transfer, v_total - v_cash);
          ELSE
            INSERT INTO sale_payments (sale_id, payment_method_id, amount) VALUES (v_sale, pm_fiado, v_total);
            IF NOT v_void THEN
              INSERT INTO customer_movements (customer_id, sale_id, shift_id, type, amount, user_id, created_at)
                VALUES (v_cust, v_sale, v_shift, 'cargo', v_total, v_user, v_at);
            END IF;
          END IF;
          IF NOT v_void THEN v_cashin := v_cashin + v_cash; END IF;
        END LOOP;
      END LOOP;

      IF v_close > now() THEN
        UPDATE shifts SET status = 'abierto', closed_at = NULL WHERE id = v_shift;  -- turno en curso
      ELSE
        v_diff := CASE WHEN random() < 0.7 THEN 0 ELSE (ARRAY[-500, -1000, 200, 500, -2000])[1 + floor(random() * 5)::int] END;
        UPDATE shifts SET expected_cash = 10000 + v_cashin, counted_cash = 10000 + v_cashin + v_diff, difference = v_diff WHERE id = v_shift;
      END IF;
    END LOOP;

    IF d % 3 = 0 THEN
      INSERT INTO expenses (branch_id, date, supplier, category_id, amount, payment_method_id, user_id)
        VALUES (v_branch, day, suppliers[1 + floor(random() * 4)::int], exp_cats[1 + floor(random() * array_length(exp_cats, 1))::int],
                (20 + floor(random() * 100)) * 1000, pm_cash, users_ids[1]);
    END IF;
  END LOOP;

  -- algunos cobros de fiado
  INSERT INTO customer_movements (customer_id, type, amount, payment_method_id, user_id, created_at)
    SELECT c, 'pago', LEAST(5000, s), pm_transfer, users_ids[1], now() - interval '2 days'
    FROM (SELECT customer_id AS c, sum(amount) AS s FROM customer_movements GROUP BY customer_id ORDER BY customer_id LIMIT 2) x
    WHERE s > 0;

  RAISE NOTICE 'Listo: % ventas de demostración generadas.', (SELECT count(*) FROM sales);
END $$;
