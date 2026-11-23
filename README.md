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

1. **Base de datos**: crear un proyecto en [Supabase](https://supabase.com) o [Neon](https://neon.tech) y copiar la cadena de conexión
   (en Supabase: *Project Settings → Database → Connection string*, modo **Transaction pooler**, puerto 6543).
2. Desde tu computadora, con esa cadena en `.env`, ejecutar `npm run db:migrate` y `npm run db:seed`.
3. **Hosting**: subir el proyecto a un repositorio de GitHub e importarlo en [Vercel](https://vercel.com).
   En *Environment Variables* cargar `DATABASE_URL` y `SESSION_SECRET` (una clave larga y aleatoria, por ejemplo la salida de `openssl rand -hex 32`).
4. Deploy. Abrir la URL desde el celular y elegir **"Agregar a pantalla de inicio"** para instalarla como app.

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
