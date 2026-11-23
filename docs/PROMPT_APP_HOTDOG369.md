# PROMPT – App de ventas "HOT DOG 369"

> Copiá todo lo que está debajo de la línea y pegalo en la herramienta con la que vayas a generar la app (Claude Code, Lovable, Bolt, v0, Cursor, etc.). Adjuntá también los dos logos: `logo-hotdog369.png` (incluido) y el logo de tu empresa.

---

## Rol y objetivo

Actuá como desarrollador full-stack senior. Construí una **aplicación web progresiva (PWA), mobile-first e instalable en el celular**, para la pancheria **HOT DOG 369**. Reemplaza la planilla en papel y Excel con la que hoy controlan las ventas por turno. Tiene que ser **muy simple y rápida de cargar** para el empleado detrás del mostrador, y le tiene que permitir al dueño **ver en tiempo real, desde el celular o desde su casa**, cuánto está vendiendo.

La app debe ser **expandible**: productos, categorías, medios de pago, precios, roles y módulos se administran desde un panel de administrador, sin tocar código.

## Stack sugerido

- **Frontend:** Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui. PWA con manifest e íconos generados a partir del logo.
- **Backend / base de datos / autenticación / tiempo real:** Supabase (PostgreSQL + Auth + Realtime + Storage), con **Row Level Security** para hacer cumplir los permisos de cada rol en la base de datos y no solo en la interfaz.
- **Gráficos:** Recharts.
- **Exportación:** CSV/Excel (SheetJS) y PDF.
- **Deploy:** Vercel + Supabase.
- Idioma de la interfaz: **español (Argentina)**. Moneda: **pesos argentinos**, con formato `$ 8.000` (punto de miles, sin decimales). Zona horaria: `America/Argentina/Buenos_Aires`.

Si elegís otro stack, mantené estos requisitos: multiusuario, tiempo real, permisos por rol del lado del servidor y una base de datos en la nube.

## Identidad visual

- Usar el **logo de HOT DOG 369** (adjunto) como protagonista: en la pantalla de login, en el encabezado, en el ícono de la PWA y en los reportes PDF.
- Usar el **logo de mi empresa (desarrollador)** de forma secundaria: pie del login, pie de página y sección "Acerca de" ("Desarrollado por …").
- Paleta tomada de la planilla y del logo del negocio:
  - Rojo principal: `#D71B22` (botones principales, pancheria)
  - Negro / carbón: `#151A1D` (encabezados, fondos en modo oscuro)
  - Amarillo / mostaza: `#F9C21B` (acentos, totales, medios de pago, resaltados)
  - Blanco `#FFFFFF` y grises neutros para fondos y textos.
- Tipografía sans-serif gruesa en títulos (estilo cartel de comida rápida) y legible en el resto.
- **Modo claro y modo oscuro**, con un interruptor visible en el encabezado. Por defecto sigue la configuración del sistema y recuerda lo que eligió cada usuario. En los dos modos el contraste tiene que ser alto: se va a usar con luz de local y con las manos ocupadas.

## Roles y permisos

Los permisos se definen en una tabla (rol → permisos), así el administrador puede crear nuevos roles o ajustar los existentes desde el panel. Los tres roles iniciales:

### 1. Empleado (cajero)
- Inicia sesión (usuario + PIN de 4 a 6 dígitos para que sea rápido) y **abre su turno** (mañana / tarde / noche, configurables) con el monto inicial de caja.
- **Registra ventas** desde la pantalla de carga rápida.
- **Puede anular una venta**, pero **está obligado a escribir el motivo**. La venta nunca se borra: queda marcada como "ANULADA", con usuario, fecha, hora y motivo. Solo ve sus ventas del turno actual.
- Registra **fiados** y **cobros de fiados**.
- **Cierra el turno** con un arqueo: la app muestra lo esperado por medio de pago, el empleado carga lo que contó en efectivo y la app calcula la diferencia (sobrante o faltante).
- No ve los reportes globales, ni los gastos, ni la configuración.

### 2. Administrador
- Todo lo del empleado, más:
- **ABM (alta, baja y modificación) de productos, categorías, precios, promos/combos y medios de pago.** Los cambios de precio guardan un historial: las ventas anteriores conservan el precio al que se vendieron.
- **Editar y corregir ventas** de cualquier turno. Cada edición queda en el registro de auditoría con el valor anterior y el nuevo.
- **Gestión de usuarios:** crear, desactivar, resetear el PIN y asignar el rol.
- **Gastos y compras de mercadería:** fecha, proveedor, categoría (mercadería, bebidas, descartables, servicios, sueldos, otros), monto, medio de pago, observación y foto del comprobante (opcional).
- **Movimientos de caja:** ingresos y retiros manuales con motivo.
- **Reportes y estadísticas** (ver la sección Reportes).
- **Configuración del negocio:** nombre, logos, turnos, medios de pago y activar/desactivar módulos.

### 3. Dueño / Solo lectura
- Pensado para mirar desde el celular **sin riesgo de cargar nada por error**: **no tiene ningún botón para crear, editar ni anular**, y la base de datos (RLS) tampoco se lo permite.
- Ve el **Dashboard en tiempo real**, el historial de ventas, las anulaciones con su motivo, los fiados pendientes, los gastos y los reportes. Puede exportar los reportes.

## Productos iniciales (precargar como datos semilla)

Todos se pueden editar desde el panel. Cada producto tiene: nombre, categoría, precio, color/ícono, orden de aparición, activo/inactivo y, opcionalmente, foto.

**Categoría PANCHERÍA**
| Producto | Precio |
|---|---|
| Pancho clásico | $ 5.000 |
| Promo pancho + Coca 237 ml | $ 6.800 |
| Promo pancho + jugo chico | $ 6.000 |
| Pancho vegano | $ 8.000 |
| Pancho alemán | $ 8.000 |
| Tostado | $ 8.000 |
| Postres | $ 4.500 |
| Bebida 350 cc | $ 2.100 |
| Coca 500 cc | $ 2.500 |
| Agua 500 cc | $ 2.500 |
| Latas | $ 2.300 |
| Agua saborizada | $ 2.500 |
| Coca 237 ml | $ 1.800 |

**Categoría CAFETERÍA**
| Producto | Precio |
|---|---|
| Café solo | $ 2.500 |
| Café + 2 criollos | $ 4.000 |
| Café + medialuna | $ 3.500 |
| Café + medialuna + criollo | $ 4.000 |
| Medialuna sola | $ 1.000 |
| Criollo solo | $ 800 |
| Dulce solo | $ 500 |
| Manteca sola | $ 500 |
| Queso crema | $ 500 |
| Mermelada | $ 400 |
| Rockstar | $ 2.500 |
| Powerade | $ 3.000 |
| Monster | $ 4.000 |
| Papas Lays | $ 4.500 |
| Doritos | $ 4.500 |
| Tostitos chicos | $ 4.500 |
| Tostito grande | $ 6.000 |
| Tortuguita de ternera | $ 6.000 |
| Tortuguita de jamón y queso | $ 5.000 |
| Alfajores premium | $ 3.000 |
| Ramen | $ 4.000 |
| Pizzetas | $ 4.500 |

## Pantalla de carga rápida (la más importante)

Tiene que replicar la lógica de la planilla ("marcar una venta en la columna del producto"), pero más rápida:

- Una **grilla de botones grandes** por producto (nombre + precio), con **pestañas por categoría** (Panchería / Cafetería / las que se agreguen) y un buscador.
- **Un toque suma una unidad** al ticket actual. Cada ítem tiene botones + / − y se puede quitar.
- El ticket muestra el total en grande, siempre visible abajo (en celular) o al costado (en tablet/PC).
- Botón **COBRAR**, que abre la elección del medio de pago:
  - **Efectivo:** se carga con cuánto paga el cliente y la app muestra el vuelto.
  - **Transferencia** (y Mercado Pago / QR / débito / crédito: la lista de medios de pago es configurable).
  - **Pago mixto:** dividir el total entre varios medios (por ejemplo, $ 3.000 en efectivo + $ 5.000 por transferencia). La app no deja confirmar hasta que la suma coincida con el total.
  - **Fiado:** se elige un cliente existente o se crea uno en el momento (nombre + teléfono opcional). También se permite un fiado parcial (paga una parte y el resto queda debiendo).
- Venta confirmada en **3 toques o menos** en el caso común: producto → cobrar → efectivo/transferencia.
- Feedback claro (sonido/vibración opcional y un mensaje de "Venta registrada #123").
- Lista de **últimas ventas del turno**, con el botón **Anular** (que pide el motivo obligatorio, con opciones rápidas como "error de carga", "cliente se arrepintió", "producto faltante" u "otro", donde se escribe el motivo).
- **Modo sin conexión:** si se corta internet, las ventas se guardan localmente y se sincronizan solas cuando vuelve la conexión, con un indicador visible del estado.

## Fiados (cuentas corrientes)

- Listado de clientes con saldo pendiente, ordenado por monto y antigüedad.
- Detalle por cliente: qué consumió, cuándo, qué pagó y cuánto debe.
- Registrar cobros (totales o parciales) con su medio de pago.
- Alerta para los fiados de más de X días (configurable).

## Dashboard (tiempo real)

Se actualiza solo, sin recargar la página, cada vez que se registra una venta. Pensado primero para la pantalla del celular.

- Tarjetas: **Vendido hoy**, **Cantidad de ventas**, **Ticket promedio**, **Efectivo**, **Transferencia**, **Otros medios**, **Fiado del día**, **Anulaciones (cantidad y monto)**.
- Comparación con el mismo día de la semana anterior (↑ / ↓ %).
- Ventas por hora del día de hoy (gráfico de barras).
- Top 5 de productos de hoy.
- Turno abierto: quién está atendiendo y desde qué hora.
- Filtro rápido: Hoy / Ayer / Esta semana / Este mes / Rango personalizado.

## Reportes y estadísticas (Administrador y Dueño)

- **Ventas por período**, con el total y el desglose por medio de pago.
- **Días y horarios con más ventas:** un mapa de calor de día de la semana × hora, más rankings de los mejores días y de las mejores franjas horarias.
- **Productos más y menos vendidos** (por unidades y por monto), y por categoría.
- **Ventas por turno y por empleado.**
- **Anulaciones:** listado con empleado, motivo y monto, y el porcentaje sobre las ventas (para detectar abusos).
- **Gastos vs. ingresos:** resultado bruto del período (ventas − gastos de mercadería y otros).
- **Arqueos de caja:** las diferencias de cada cierre de turno.
- **Fiados:** el total adeudado y su evolución.
- **Reporte de cierre de turno**, equivalente a la planilla en papel: fecha, turno, responsable, unidades por producto, total en efectivo, total por transferencia y total del turno. Se puede imprimir o compartir por WhatsApp como PDF.
- Exportar todo a **Excel/CSV y PDF**.

## Auditoría

Tabla `audit_log` que registra quién, qué, cuándo, el valor anterior y el nuevo de toda creación, edición o anulación de ventas, productos, precios, gastos, usuarios y configuración. Solo la ve el administrador (y el dueño, en lectura). Nada se borra físicamente: se hace borrado lógico.

## Expandibilidad (requisito clave)

- Todo lo que sea catálogo se **administra desde el panel**: productos, categorías, combos/promos (un producto compuesto por otros), medios de pago, turnos, categorías de gasto, motivos de anulación, roles y permisos.
- **Sistema de módulos activables** (tabla `modules` con un flag activo/inactivo y la configuración en JSON). El menú y las rutas se arman según los módulos activos y los permisos del usuario. Dejá la arquitectura preparada para sumar a futuro, sin reescribir:
  - Control de stock (descontar insumos por venta y alertar cuando hay poco).
  - Descuentos y promos por día/horario (por ejemplo, un happy hour).
  - Pedidos para llevar / delivery.
  - Varias sucursales (dejar `branch_id` en las tablas desde el inicio).
  - Impresora de tickets o facturación electrónica.
- Código ordenado por funcionalidad (`/features/ventas`, `/features/fiados`, `/features/gastos`, `/features/reportes`, `/features/admin`, …), tipado, con componentes reutilizables y con migraciones SQL versionadas.

## Modelo de datos mínimo (orientativo)

`users`, `roles`, `permissions`, `role_permissions`, `branches`, `shifts` (turnos abiertos/cerrados, con montos de apertura y cierre y la diferencia), `categories`, `products`, `product_price_history`, `combos`, `payment_methods`, `sales` (estado: confirmada/anulada, con el motivo de anulación, quién la anuló y cuándo), `sale_items` (con el precio unitario histórico), `sale_payments` (varios por venta, para los pagos mixtos), `customers`, `customer_account_movements` (fiados y cobros), `expenses`, `expense_categories`, `cash_movements`, `modules`, `settings`, `audit_log`.

## Requisitos no funcionales

- Mobile-first, botones grandes (mínimo 48 px), usable con una sola mano. También debe verse bien en tablet y en PC.
- Rápida: cargar una venta no puede tardar más de 1 segundo en la interfaz.
- Seguridad: contraseñas/PIN hasheados, sesiones con vencimiento, RLS en todas las tablas, y ninguna acción de escritura disponible para el rol de solo lectura.
- Backups automáticos de la base de datos.
- Accesibilidad básica: buen contraste en los dos temas y textos legibles.

## Entregables

1. El código completo del proyecto, con un README en español: cómo instalarlo, cómo configurar Supabase, las variables de entorno y cómo hacer el deploy.
2. Las migraciones SQL, las políticas RLS y los datos semilla (productos y precios de arriba, los medios de pago Efectivo / Transferencia / Mercado Pago / Débito / Crédito / Fiado, los turnos Mañana / Tarde / Noche y un usuario de prueba por cada rol).
3. La PWA instalable, con los íconos generados a partir del logo de HOT DOG 369.
4. Una guía corta de uso para el empleado (cómo cargar, cobrar, anular y cerrar el turno) y otra para el dueño (cómo instalar la app en el celular y ver las ventas).

Trabajá por etapas y mostrame el avance al final de cada una:
**Etapa 1:** autenticación, roles, productos y carga rápida de ventas con pagos y anulación →
**Etapa 2:** turnos y arqueo, fiados, gastos →
**Etapa 3:** dashboard en tiempo real y reportes →
**Etapa 4:** panel de administración, módulos, auditoría, modo sin conexión y pulido visual.
