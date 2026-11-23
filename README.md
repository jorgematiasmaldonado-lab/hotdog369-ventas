# HOT DOG 369 · Sistema de ventas

App web progresiva (PWA) para controlar las ventas de la panchería y cafetería **HOT DOG 369**.
Reemplaza la planilla en papel/Excel: carga rápida de ventas, medios de pago (efectivo, transferencia,
mixto, fiado y otros), turnos con arqueo de caja, gastos, reportes y un panel en tiempo real para el dueño.

Desarrollado por **JMM Gestiones & Tecnología**.

## Funciones

| Área | Qué hace |
|---|---|
| **Vender** | Botones grandes por producto y categoría, ticket, cobro en 3 toques, cálculo de vuelto, pago mixto, fiado (total o parcial), anulación con motivo obligatorio. |
| **Modo sin conexión** | Si se corta internet las ventas se guardan en el equipo y se envían solas al volver la conexión (sin duplicados). |
| **Turnos** | Apertura con efectivo inicial, cierre con arqueo (esperado vs. contado), reporte de cierre imprimible / PDF / WhatsApp. |
| **Panel** | Tiempo real (se actualiza cada 5 s): vendido, ventas, ticket promedio, efectivo, transferencia, fiado, anulaciones, ventas por hora, top 5, turnos abiertos. |
| **Reportes** | Resumen diario por medio de pago, mapa de calor día × hora, mejores días y horarios, productos, empleados, arqueos, anulaciones, gastos vs. ingresos, fiados. Exportación a Excel (CSV) e impresión/PDF. |
| **Fiados** | Cuenta corriente por cliente, cobros parciales, alerta de deudas viejas, recordatorio por WhatsApp. |
| **Gastos** | Compras de mercadería y otros gastos, con categoría, proveedor y foto del comprobante. |
| **Administración** | Productos, precios (con historial), categorías, medios de pago, turnos, motivos de anulación, categorías de gasto, usuarios, roles y permisos, módulos activables, configuración y auditoría. |
| **Tema** | Modo claro y oscuro (recuerda la elección en cada equipo). |

### Roles iniciales

| Rol | Puede |
|---|---|
| **Empleado** | Abrir/cerrar su turno, vender, registrar fiados y cobros, anular **sus** ventas del turno con motivo. |
| **Administrador** | Todo: editar/anular cualquier venta, productos y precios, usuarios, gastos, caja, reportes, módulos y auditoría. |
| **Dueño (solo lectura)** | Ver panel, ventas, turnos, fiados, gastos, reportes y auditoría. **No tiene ningún permiso de escritura** (lo valida el servidor, no solo la pantalla). |

Los roles se editan desde *Administración → Roles y permisos*, y se pueden crear roles nuevos combinando permisos.

## Tecnología

- Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS 4
- PostgreSQL (funciona con Supabase, Neon, Railway o un servidor propio)
- Sesiones firmadas (JWT en cookie httpOnly), PIN hasheado con bcrypt, bloqueo tras 5 intentos fallidos
- Todos los permisos se validan en el servidor en cada endpoint
- Recharts para gráficos, PWA instalable con service worker

## Puesta en marcha local

Requisitos: Node.js 20 o superior y una base PostgreSQL.

```bash
npm install
cp .env.example .env      # completar DATABASE_URL y SESSION_SECRET
npm run db:migrate        # crea las tablas
npm run db:seed           # carga productos, medios de pago, roles y usuarios iniciales
npm run dev               # http://localhost:3000
```

Opcional, solo para mostrar la app: `npm run db:demo -- --si` carga 30 días de ventas **ficticias**.
No lo ejecutes en la base real del negocio.

### Usuarios iniciales (¡cambiar los PIN al instalar!)

| Usuario | PIN | Rol |
|---|---|---|
| `admin` | 3690 | Administrador |
| `empleado` | 1111 | Empleado |
| `dueno` | 2222 | Dueño (solo lectura) |

## Publicarla en internet (gratis para empezar)

### 1. Base de datos en Supabase (con el SQL Editor)
1. *New project* → región a elección → contraseña **solo con letras y números** (anotarla).
2. **SQL Editor → New query** → pegar todo `db/supabase/01_estructura_y_datos.sql` → **Run**.
   Crea las tablas, activa RLS y carga productos, medios de pago, roles y usuarios.
3. *(Opcional, solo para mostrar la app)* repetir con `db/supabase/02_demo_opcional.sql`: 30 días de ventas ficticias.
4. **Connect → Direct → Transaction pooler** (puerto 6543) → copiar la URL y reemplazar `[YOUR-PASSWORD]`
   (sin corchetes). Debe empezar con `postgresql://postgres.` y terminar en `pooler.supabase.com:6543/postgres`.

La app solo usa la base de datos (no usa Supabase Auth ni Storage). Todas las tablas tienen Row Level Security
activado sin políticas, así la Data API pública de Supabase no puede leerlas; la app se conecta como dueña.

### 2. La app en Vercel
1. *Add New → Project* → importar este repositorio.
2. *Environment Variables*:
   - `DATABASE_URL` = la URL del paso 1.4
   - `SESSION_SECRET` = una clave larga y aleatoria (por ejemplo, la salida de `openssl rand -hex 32`)
3. **Deploy**. Vercel solo compila la app; no modifica la base.
4. Abrir la URL desde el celular → **"Agregar a pantalla de inicio"**; en la PC del local → *Instalar app*.

La región de las funciones está en `vercel.json` (`iad1`, Washington): conviene que coincida con la de Supabase
(`us-east-1` → `iad1`; São Paulo → `gru1`).

*Alternativa automática:* con `PREPARAR_BASE=si` (y opcionalmente `CARGAR_DEMO=si`) la publicación aplica
las migraciones y los datos iniciales por su cuenta, sin usar el SQL Editor.

### Cambios futuros en la base
Cada cambio de estructura se agrega como `db/migrations/00X_*.sql`: se ejecuta en el SQL Editor de Supabase
(y se registra en `schema_migrations`) o con `npm run db:migrate`.

## Cómo extenderla

- **Catálogos nuevos** (ej. "Proveedores"): crear la tabla en `db/migrations/00X_*.sql` y agregar su definición en
  `src/lib/catalogs.ts`; el panel de administración genera el ABM solo.
- **Permisos nuevos**: agregarlos en `src/lib/permissions.ts`; aparecen automáticamente en *Roles y permisos*.
- **Módulos**: la tabla `modules` controla qué secciones están activas. Ya están previstos (como "Próximamente"):
  control de stock, promos por horario, delivery, varias sucursales e impresión de tickets / facturación.
  Las tablas ya tienen `branch_id` y `combo_items` para esos módulos.
- **Configuración** del negocio: tabla `settings`, editable desde *Administración → Configuración*.

## Estructura

```
db/migrations/        SQL versionado
scripts/              migrar, datos iniciales, datos demo, íconos
src/lib/              lógica de servidor (ventas, turnos, reportes, permisos, auditoría)
src/app/api/          API (cada endpoint valida sesión y permisos)
src/app/(app)/        pantallas: vender, panel, turno, ventas, fiados, gastos, reportes, admin
src/components/       componentes de interfaz reutilizables
public/               logos, íconos de la PWA y service worker
docs/                 prompt original, guías de uso y capturas
```
