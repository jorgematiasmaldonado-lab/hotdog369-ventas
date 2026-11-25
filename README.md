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
| **Stock** | Artículos (bebidas, pan, salchichas…), recetas por producto, ingresos de mercadería (opcionalmente como gasto), ajustes con motivo, alertas de stock bajo. Cada venta descuenta y cada anulación repone. |
| **Control de stock** | Al abrir el turno el empleado cuenta "a ciegas"; se registran las diferencias y el stock queda corregido. Obligatorio, opcional o desactivado desde Configuración. |
| **Horas del personal** | Fichar entrada y salida (también al abrir/cerrar el turno), francos, vacaciones, enfermedad, faltas y licencias, planilla por día, resumen por empleado y exportación CSV. |
| **Avisos de stock bajo** | Aviso en el encabezado de todas las pantallas y notificación en el celular/PC (Web Push, sin servicios pagos) cuando un artículo cruza su mínimo. Se activa en cada equipo desde el Panel o Stock. En iPhone requiere la app agregada a la pantalla de inicio. |
| **Respaldo** | Descarga de un respaldo completo (.json.gz), restauración con confirmación y aviso a los administradores cada 3 días. |
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

### Actualizar una base existente
Cuando una versión nueva necesita cambios en la base, se agrega un archivo `db/supabase/0X_actualizacion_*.sql`:
se ejecuta una vez en el SQL Editor. Si falta, los administradores ven un aviso en la app y las funciones nuevas
quedan ocultas (lo demás sigue funcionando).
- `04_actualizacion_stock_horas.sql`: stock, control de stock, horas del personal y respaldos.
- `05_actualizacion_avisos.sql`: avisos de stock bajo en el celular.
- `06_actualizacion_caja_horas.sql`: caja inicial que carga el administrador, cierre de turno a ciegas
  (el empleado cuenta el efectivo sin ver lo esperado; los demás medios son opcionales), control de stock por paquetes y sueltas
  (Salchicha Paty, Salchicha Alemana y Pan de pancho), valor hora del personal con quincenas, horario de cada
  turno, aviso de apertura tarde y recargo por medio de pago (comisión de QR / tarjetas, cálculo exacto
  redondeado hacia arriba a $10; ver `src/lib/surcharge.ts`).
- `07_avisos_automaticos.sql` (después del 06): programa en Supabase (pg_cron + pg_net) un control cada 10 minutos
  que llama a `/api/cron/turnos`; si un turno no se abrió a tiempo, la app avisa al celular del dueño y del
  administrador. La llamada lleva una clave aleatoria guardada en la base (`settings.cron_secret`). Si la app cambia
  de dirección, editar la URL del archivo y volver a ejecutarlo. *Administración → Configuración* muestra si el
  control está funcionando.

### Respaldo y restauración
*Administración → Respaldo* descarga todos los datos en un archivo `.json.gz`. Para restaurar desde la app el
archivo debe pesar menos de 4 MB (aprox. un año de ventas); para uno más grande, pedir asistencia técnica.

### Borrar los datos de prueba
Antes de empezar a usarla en serio: `db/supabase/03_borrar_datos_de_prueba.sql` en el SQL Editor.
Borra ventas, turnos, fiados, clientes, gastos, caja y auditoría (la numeración vuelve a 1) y conserva
productos, precios, medios de pago, usuarios y configuración. No se puede deshacer.

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
