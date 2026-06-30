# Fase 1 - Auditoria UX/UI real de Chekeo Burgers.exe

Fecha de revision: 2026-06-21
Preview usado: https://burgers-exe-internal-v2-preview.pages.dev/
PIN usado: `BOG_INTERNAL_PIN`
Carpeta de evidencia: `docs/assets/chekeo-phase-1-audit/`

## 1. Resumen ejecutivo brutal

Chekeo hoy no se siente como una consola operativa. Se siente como una interfaz de administracion inflada: mucha card, mucho borde, demasiados badges, demasiada explicacion y poca prioridad real para operar pedidos, cocina y cobros rapido.

El problema no es un boton aislado ni una paleta ligeramente sucia. El problema es estructural: la interfaz gasta el primer viewport movil en identidad, estado, entorno, sesion, tabs y copy explicativo antes de entregar trabajo accionable. En operacion real, un operador necesita saber en segundos que falta hacer, que pedido sigue, que pago esta pendiente y que accion toca. Hoy esa respuesta queda enterrada debajo de capas de UI.

Gravedad general: alta. El preview funciona y carga datos reales de D1 en varias areas, pero la experiencia mobile-first no esta lista para operacion rapida. En 320px hay clipping real de contenido aunque el scroll horizontal este oculto; Pedidos muestra dos empty states al mismo tiempo; Admin duplica navegacion y tarjetas; Sorteos y Catalogo son pantallas demasiado largas para una herramienta de piso; y la jerarquia visual hace que estados, botones, chips y decoracion compitan por la misma atencion.

La mayor oportunidad para Fase 2 es dejar de maquillar la interfaz actual y reconstruirla como una consola compacta: una pantalla principal de cola operativa, navegacion inferior o command bar persistente, estados reducidos a senales utiles, filtros colapsables, tarjetas de pedido mas densas, y modulos Admin sacados del flujo diario.

## 2. Evidencia usada

| Evidencia | Detalle |
| --- | --- |
| URL | `https://burgers-exe-internal-v2-preview.pages.dev/` |
| Login | PIN configurado en `BOG_INTERNAL_PIN`, captura `login-preview-mobile.png` |
| Fecha/hora | 2026-06-21, revision Playwright headless |
| Viewports | 320x844, 390x844, 430x844, 1440x1000 |
| Screenshots | 21 PNG reales en `docs/assets/chekeo-phase-1-audit/` |
| Datos | Home/Pedidos/Cocina/Pagos/Cierre muestran preview D1 activo con 0 pedidos; Catalogo y Sorteos muestran datos reales |
| Graphify | Ejecutado primero contra el grafo existente en `graphify-out/graph.json` |
| Playwright | Usado para login, navegacion, screenshots, consola y medicion de clipping |
| UI UX Pro Max | Usado para criterios de mobile-first, focus, empty states, loading, motion y dashboard dark |
| Taste Skill | Usado como filtro anti-slop visual; se aplico criticamente porque la propia skill indica que dashboards densos requieren otro criterio que landing pages |
| Open Design | Probado; no disponible. Error: no se pudo conectar al daemon `http://127.0.0.1:7456` |
| Axe | No disponible en dependencias (`axe-core` y `@axe-core/playwright` no instalados) |
| Limitaciones | No habia pedidos activos. No se inventaron pedidos. Modales de pedido/cancelacion no pudieron validarse con datos reales activos |

Estado Git inicial documentado: el repo `Preview` ya tenia cambios no relacionados antes de esta auditoria (`cloudflare/public-order/wrangler.toml`, `package.json`, `wrangler.example.toml`, `.wrangler/cache/`, `CLOUDFLARE-ENVIRONMENT.md`, `codex-tools/`, `graphify-out/`, `scripts/`). No se revirtieron.

## 3. Mapa real de pantallas

| Pantalla / area | Estado revisado | Viewport | Screenshot | Problema principal | Prioridad |
| --- | --- | --- | --- | --- | --- |
| Login | Acceso real con PIN | 390 | `login-preview-mobile.png` | Login claro, pero demasiado vertical y con copy de entorno antes de la accion | P2 |
| Home | D1 activo, 0 pedidos | 390 | `home-mobile-390.png` | Primer viewport ocupado por chrome operativo; Home repite estado y explicaciones | P1 |
| Home | D1 activo, 0 pedidos | 1440 | `home-desktop.png` | Desktop desperdicia altura con header/status/tabs antes del contenido | P1 |
| Pedidos | Empty state real | 390 | `pedidos-mobile-390.png` | Dos empty states simultaneos y filtros enormes para cero datos | P1 |
| Pedidos | Empty state real | 320 | `pedidos-mobile-320.png` | Clipping horizontal real en tabs, chips, filtros y empty states | P0 |
| Pedidos | Empty state real | 430 | `pedidos-mobile-430.png` | Mejora el ancho, pero sigue cargado de chrome antes de contenido | P1 |
| Pedidos | Empty state real | 1440 | `pedidos-desktop.png` | Layout mas usable, pero empty state duplicado y filtros dominan | P1 |
| Cocina | Empty production queue | 390 | `cocina-mobile-390.png` | Hero, metricas y sub-tabs empujan la accion principal hacia abajo | P1 |
| Cocina | Empty production queue | 1440 | `cocina-desktop.png` | Desktop compacta mejor, pero exceso de tarjetas y estados 0 | P2 |
| Resumen K | Estado vacio real | 390 | `resumen-k-mobile-390.png` | Mucho scroll para una lectura de ceros; no hay resumen compacto | P2 |
| Pagos | Empty state real | 390 | `pago-mobile-390.png` | Cinco metric cards verticales antes de filtros y empty state | P1 |
| Admin hub | Modulos disponibles | 390 | `admin-hub-mobile-390.png` | Navegacion Admin duplicada con tarjetas de modulo largas | P1 |
| Configuracion / Banco | Solo lectura | 390 | `configuracion-mobile-390.png` | Datos utiles, pero enterrados bajo header y nav duplicada | P2 |
| Corte | Cierre actual en cero | 390 | `corte-mobile-390.png` | Seccion larga con muchos bloques de cero; reporte y cierre compiten | P2 |
| Sorteos | Datos reales | 390 | `sorteo-mobile-390.png` | Pantalla extremadamente larga, 27,470 px en captura 2x; recursos de imagen 404 | P1 |
| Catalogo | Datos reales | 390 | `catalogo-mobile-390.png` | Lista de productos real, pero cards repetitivas y filtros altos | P1 |
| Historial | Empty state real | 390 | `historial-mobile-390.png` | Admin header y nav ocupan mas que el contenido real | P2 |
| Reportes | Exportes | 390 | `reportes-mobile-390.png` | Formulario util, pero metido bajo demasiada navegacion repetida | P2 |

Archivos clave mapeados con Graphify y lectura local:

| Archivo | Rol |
| --- | --- |
| `apps/internal-chekeo-v2/src/components/InternalChekeoApp.tsx` | Superficie principal: login, header, tabs, Home, Pedidos, Pagos, Admin, modales, estado global |
| `apps/internal-chekeo-v2/src/components/kitchen/KitchenQueue.tsx` | Cocina, sub-vistas Preparacion, Listos, Side Quest, Resumen K |
| `apps/internal-chekeo-v2/src/styles.css` | Sistema visual actual: dark theme, cards, tabs, chips, filtros, modal, motion |
| `apps/internal-chekeo-v2/src/lib/internal-auth.ts` | Login y sesion interna |
| `apps/internal-chekeo-v2/src/lib/orders-v2-admin.ts` | Pedidos, estados, pagos, exportes |
| `apps/internal-chekeo-v2/src/lib/ingredients-v2-admin.ts` | Resumen K e ingredientes |
| `apps/internal-chekeo-v2/src/lib/raffles-v2-admin.ts` | Sorteos |
| `packages/config/src/runtime-environment.ts` | Deteccion preview/produccion/local |
| `package.json` | React, Tailwind 3, Radix Tabs, Framer Motion, Lucide, Playwright ya presentes |

## 4. Hallazgos por pestana

### Login

Que hace hoy: valida acceso interno con PIN, muestra entorno preview, estado de sesion y enlace a la pagina publica.

Que necesita hacer realmente: dejar entrar rapido, confirmar entorno sin ocupar demasiado espacio y mostrar errores de PIN con claridad.

Que esta mal:

- Mucha altura vacia antes del card de login en mobile.
- El entorno preview ocupa un bloque grande antes del input.
- El CTA principal esta claro, pero la pantalla se siente mas ceremonial que operativa.

Que sobra:

- Copy largo sobre preview y D1 antes de iniciar sesion.
- Link publico como bloque grande dentro del login.

Que falta:

- Indicacion mas directa de intento fallido y sesion expirada en primer plano.
- Tratamiento mas compacto para teclado movil.

Fase 2: login compacto, card menos alta, entorno como small status, CTA primario inmediato.

Severidad: P2. Screenshot: `login-preview-mobile.png`.

### Home

Que hace hoy: muestra resumen del dia, mini Resumen K, accesos directos y pedidos por resolver.

Que necesita hacer realmente: ser el tablero inicial de operacion. Debe contestar en 5 segundos: hay pedidos, hay pagos, hay cocina pendiente, que accion sigue.

Que esta mal:

- El primer viewport movil se consume por header, estado operativo y tabs. En `home-mobile-390.png`, el usuario ve mucho marco antes de llegar a acciones.
- Home repite estados que ya aparecen en header/status: preview, D1, sesion, operable.
- Los accesos directos son otra navegacion dentro de la navegacion.
- La frase "Base operativa para Home" no ayuda a operar.

Que sobra:

- Eyebrows repetidos: "OPERACION DE HOY", "MINI RESUMEN K", "ACCESOS DIRECTOS", "RESUMEN DE OPERACION".
- Cards de metricas con 0 que ocupan demasiado espacio.
- Accesos directos a tabs ya visibles.

Que falta:

- Una cola unica de "siguiente accion".
- Prioridad visual para pagos pendientes, cocina pendiente o pedido listo.
- Una version compacta para hora pico.

Fase 2: Home debe convertirse en "Hoy" o "Operacion" con un command strip de 3 a 5 indicadores y una lista accionable. Los accesos secundarios deben ir a una barra persistente o a Admin.

Severidad: P1. Screenshots: `home-mobile-390.png`, `home-desktop.png`.

### Pedidos

Que hace hoy: lista pedidos, permite buscar, filtrar por estado/rango, abrir ticket, entregar o cancelar.

Que necesita hacer realmente: mostrar cola de pedidos y permitir resolver el siguiente movimiento rapido.

Que esta mal:

- En 320px hay clipping visual real: `pedidos-mobile-320.png` corta tabs, chips, filtros y empty states. La medicion Playwright encontro elementos hasta 287px fuera del viewport.
- Muestra dos empty states a la vez: "Todavia no hay pedidos para revisar" y "No hay pedidos para ese filtro".
- En empty state, los filtros y summary chips ocupan mas que la informacion util.
- "Command Center" es decorativo y no aporta al operador.
- Los chips de estado parecen CTAs y los CTAs parecen chips.

Que sobra:

- Empty state duplicado.
- Summary chips si todos estan en cero.
- Texto explicativo largo cuando no hay pedidos.
- Filtros visibles completos cuando no hay datos.

Que falta:

- Un empty state unico.
- Filtros colapsables o modo compacto.
- Indicador claro de "ultima sincronizacion" sin repetir todo el source panel.
- Accion primaria persistente para refrescar/crear seguimiento si aplica.

Fase 2: Pedidos debe ser una cola compacta. En cero pedidos, mostrar un unico estado vacio con ultima sync y refresh. En pedidos activos, cards densas por folio/cliente/estado/proxima accion.

Severidad: P0 en 320px, P1 en 390/430/desktop. Screenshots: `pedidos-mobile-320.png`, `pedidos-mobile-390.png`, `pedidos-mobile-430.png`, `pedidos-desktop.png`.

### Cocina

Que hace hoy: separa produccion por item, pedidos listos, Side Quest y Resumen K.

Que necesita hacer realmente: decirle a cocina que preparar ahora, que ya esta hecho y que pedido se puede cerrar.

Que esta mal:

- La pantalla abre con hero, actualizacion, cuatro metricas y cuatro sub-tabs antes de llegar a "Produccion accionable".
- En estado vacio, ocho contadores en cero ocupan mucho espacio.
- "Siguiente en cocina" aparece despues de una estructura larga, cuando deberia ser el centro de la pantalla.
- En mobile, los sub-tabs son tarjetas grandes, no controles rapidos.

Que sobra:

- Metric cards duplicadas con los mismos ceros.
- Texto "Produccion actual por item, ordenada por llegada" si la lista esta vacia.
- Sub-tabs gigantes con hint y contador.

Que falta:

- Un modo cocina compacto de una mano.
- Priorizacion por item siguiente.
- Estados distinguibles sin depender de verde/amarillo/cyan.
- Empty state que indique si la sync fue exitosa.

Fase 2: Cocina debe abrir en "Siguiente". Los contadores deben ser una barra compacta. Resumen K debe existir como drill-down, no como tarjeta igual a preparacion.

Severidad: P1. Screenshots: `cocina-mobile-390.png`, `cocina-desktop.png`, `resumen-k-mobile-390.png`.

### Resumen K

Que hace hoy: muestra totales de burgers, guarniciones, combos, Side Quest, extras, costo e ingredientes estimados.

Que necesita hacer realmente: resumir produccion y costos para cocina/corte sin obligar a leer una lista larga de ceros.

Que esta mal:

- En estado sin datos, la pantalla tiene scroll muy largo para comunicar "0".
- Usa cards grandes para cada metrica, incluso cuando todas estan vacias.
- Las secciones "Preview - burgers", "Preview - guarniciones" e "Ingredientes estimados" repiten empty states.

Que sobra:

- Cards individuales para ceros.
- Empty states por subseccion cuando no hay nada en todo el resumen.

Que falta:

- Resumen compacto superior.
- Agrupacion de vacios.
- Relacion con Corte si se usa para costos.

Fase 2: Resumen K debe ser un panel de lectura, no otro dashboard de cards. Usar tabla compacta o lista agrupada solo cuando haya datos.

Severidad: P2. Screenshot: `resumen-k-mobile-390.png`.

### Pagos

Que hace hoy: lista pagos, permite filtrar, marcar pagado, copiar mensaje y abrir WhatsApp.

Que necesita hacer realmente: enfocar pagos pendientes y confirmar cobros con minima friccion.

Que esta mal:

- Cinco metric cards verticales antes del buscador y filtros en mobile.
- Estado vacio dice "No hay coincidencias con este filtro" aunque el estado inicial tambien puede ser simplemente "no hay pagos".
- El boton "Limpiar vista" aparece aun cuando la vista inicial ya esta limpia.
- El source panel repite preview/sesion/capacidad igual que Pedidos.

Que sobra:

- Total visible y transferencia como cards grandes cuando todo es cero.
- Explicacion larga del modulo en el hero.
- Filtros siempre expandidos en vacio.

Que falta:

- Prioridad "pendientes primero".
- Accion de confirmar visible solo cuando hay pago.
- Copy de empty state que no culpe al filtro si no hubo interaccion.

Fase 2: Pagos debe ser una bandeja de pendientes. Mostrar pagados y todos como filtros secundarios. Banco debe aparecer solo en detalle/accion de transferencia, no como navegacion repetida.

Severidad: P1. Screenshot: `pago-mobile-390.png`.

### Admin / Configuracion

Que hace hoy: agrupa Datos bancarios, Historial, Cierre, Catalogo, Sorteos, Reportes y enlace publico.

Que necesita hacer realmente: contener tareas no diarias sin contaminar Pedidos/Cocina/Pagos.

Que esta mal:

- Admin hub duplica navegacion: lista de navegacion superior y cards de modulo.
- En cada modulo, la navegacion Admin completa se repite antes del contenido.
- Las cards de modulo son muy altas y tienen status badges que compiten con el CTA.
- "Modo seguro global activo..." aparece repetido y bajo en prioridad.

Que sobra:

- Navegacion Admin dentro de cada modulo en mobile.
- Cards del hub con descripcion extensa.
- Status "Base lista", "Basico", "Solo lectura" como elementos visuales principales.

Que falta:

- Menu de Admin compacto o drawer.
- Separacion entre configuracion operativa y datos tecnicos.
- Modo de busqueda dentro de Admin si los modulos crecen.

Fase 2: Admin debe ser un area secundaria. En mobile, usar un selector compacto o drawer. No repetir hub completo en cada subpantalla.

Severidad: P1. Screenshots: `admin-hub-mobile-390.png`, `configuracion-mobile-390.png`.

### Corte

Que hace hoy: descarga reporte, filtra rango, incluye terminales y muestra metricas de cierre.

Que necesita hacer realmente: cerrar caja/operacion con confianza y exportar datos.

Que esta mal:

- Con ceros, la pantalla muestra muchas cards vacias: venta, ordenes, estados, tiempos, metodo de pago, productos, recientes.
- El formulario y las metricas compiten por prioridad.
- La confirmacion "Cierre actualizado" esta visualmente muy pequeña respecto al resto.

Que sobra:

- Bloques vacios separados cuando todo el rango esta sin datos.
- Texto repetido de "sin metodos", "sin modos", "sin productos".

Que falta:

- Estado de cierre unico para rango sin ventas.
- Resumen de rango mas compacto.
- CTA claro de exportar vs actualizar.

Fase 2: Corte debe tener un header de cierre con fecha, total, ordenes, pago y exportar. El detalle debe expandirse por seccion solo si hay datos.

Severidad: P2. Screenshot: `corte-mobile-390.png`.

### Sorteos

Que hace hoy: administra campanas, participantes, referidos, tickets extra, imagenes y estados.

Que necesita hacer realmente: permitir revisar campana activa y editar datos sin perderse.

Que esta mal:

- Es la pantalla mas larga: `sorteo-mobile-390.png` mide 27,470 px de alto en captura 2x.
- Dos recursos reales fallan con 404:
  - `/api/assets-v2/raffles/banners/raffle-peimer-gran-sorte-202606-20260603T071818Z.png`
  - `/api/assets-v2/raffles/details/raffle-peimer-gran-sorte-202606-20260603T153634Z.png`
- La pantalla mezcla campanas, participantes, referral codes, ajustes y formularios en un solo scroll.
- El status visual verde domina demasiados elementos.

Que sobra:

- Listas completas siempre abiertas.
- Cards repetidas para datos secundarios.
- Controles de subida/imagen compitiendo con resumen de campana.

Que falta:

- IA por tabs internas o acordeones reales.
- Tratamiento de error visual para imagen faltante.
- Resumen fijo de campana activa.

Fase 2: Sorteos debe ser una herramienta modular: Campana, Participantes, Referidos, Ajustes, Assets. Los assets 404 deben tener fallback claro.

Severidad: P1. Screenshot: `sorteo-mobile-390.png`.

### Catalogo

Que hace hoy: muestra productos, promos, banners e ingredientes con stock y acciones.

Que necesita hacer realmente: editar menu/stock sin afectar operacion diaria.

Que esta mal:

- La lista de productos se vuelve un scroll largo de cards casi identicas.
- Filtros y categorias ocupan mucho espacio antes de items.
- Cada producto repite botones "Disponible", "Agotado", "Editar detalle" con la misma jerarquia.

Que sobra:

- Cards completas para productos cuando se necesita escaneo por stock.
- Texto de assets/ruta visible para operador no tecnico.

Que falta:

- Tabla/lista compacta para stock.
- Agrupacion por categoria con contador.
- Bulk actions o filtros de agotados.

Fase 2: Catalogo debe ser una pantalla de configuracion densa, no cards grandes. Considerar tabla compacta o lista con rows.

Severidad: P1. Screenshot: `catalogo-mobile-390.png`.

### Historial

Que hace hoy: muestra entregados/cancelados, vacio en el preview revisado.

Que necesita hacer realmente: recuperar pedidos terminales sin saturar Pedidos.

Que esta mal:

- Admin header y nav ocupan casi todo antes del contenido.
- Empty state llega tarde y es demasiado pobre para historial.

Que sobra:

- Navegacion Admin completa en esta subvista.

Que falta:

- Filtros de fecha/estado si hay historial.
- Explicacion de rango consultado.

Fase 2: Historial debe ser una lista compacta filtrable, no una subpagina enterrada bajo hub repetido.

Severidad: P2. Screenshot: `historial-mobile-390.png`.

### Reportes

Que hace hoy: exporta pedidos filtrados y muestra contexto tecnico del backend.

Que necesita hacer realmente: bajar CSV sin molestar al flujo diario.

Que esta mal:

- El formulario es util, pero llega despues de header Admin y navegacion repetida.
- "Estado tecnico" podria estar oculto bajo detalle, no visible por defecto.

Que sobra:

- Contexto tecnico visible para cada visita.
- Navegacion Admin completa.

Que falta:

- Presets de reporte: hoy, semana, corte completo.
- Confirmacion de rango antes de exportar.

Fase 2: Reportes debe ser un modulo de exportes con presets y menos decoracion.

Severidad: P2. Screenshot: `reportes-mobile-390.png`.

## 5. Matriz de severidad

| Severidad | Hallazgo | Pantalla | Evidencia | Impacto | Recomendacion Fase 2 |
| --- | --- | --- | --- | --- | --- |
| P0 | Clipping en 320px aunque no haya scroll horizontal visible | Pedidos | `pedidos-mobile-320.png`; medicion de elementos 80-287px fuera del viewport | Operacion movil en ancho minimo queda parcialmente ilegible/inusable | Redisenar layout mobile con ancho real fluido, sin cards de 405px y sin tabs min-width que dependan de scroll oculto |
| P1 | Primer viewport movil dominado por chrome operativo | Home, Pedidos, Cocina, Pagos | `home-mobile-390.png`, `pedidos-mobile-390.png`, `cocina-mobile-390.png`, `pago-mobile-390.png` | El operador tarda demasiado en llegar a la accion | Compactar header/status en una command bar y priorizar cola/accion |
| P1 | Empty state duplicado | Pedidos | `pedidos-mobile-390.png`, `pedidos-desktop.png` | Confunde si no hay datos o si el filtro oculto resultados | Unificar logica de empty state: sin datos vs sin coincidencias |
| P1 | Navegacion principal no es thumb-first ni persistente | Todas | Capturas mobile | En pantallas largas se pierde navegacion y acciones | Bottom nav o command bar sticky con tabs clave |
| P1 | Source/status panel repetido por modulo | Pedidos, Pagos, Historial | `pedidos-mobile-390.png`, `pago-mobile-390.png`, `historial-mobile-390.png` | Ruido antes del trabajo | Reducir a una linea de sync/entorno solo cuando sea relevante |
| P1 | Sorteos tiene assets 404 | Sorteos | `sorteo-mobile-390.png`; consola/network 404 | Pierde confianza y puede romper gestion visual de campana | Fallback de asset, validacion de URLs y estado de error visible |
| P1 | Sorteos y Catalogo son scrolls largos de cards | Sorteos, Catalogo | `sorteo-mobile-390.png`, `catalogo-mobile-390.png` | Baja escaneabilidad y edicion lenta | Convertir a modulos/tabs internas y rows compactas |
| P1 | Estados, badges y CTAs compiten visualmente | Todas | Todas las capturas | El usuario no distingue accion vs estado | Definir lenguaje de componentes: status pasivo, accion primaria, accion secundaria |
| P2 | Tipografia muy pesada y uppercase excesivo | Todas | Capturas mobile/desktop | Fatiga visual y poco ritmo operativo | Reducir display weight, usar mono solo para folios/numeros |
| P2 | Motion actual es generico de hover, no comunica cambios operativos | Todas | CSS `styles.css` | No ayuda a entender entrada de pedido, pago o cambio de estado | Motion funcional para cambios de estado, con reduced motion |
| P2 | Admin duplica hub y navegacion en cada modulo | Admin | `admin-hub-mobile-390.png`, submodulos | Mucho scroll antes del contenido | Admin selector compacto/drawer |
| P2 | Corte muestra demasiados bloques vacios | Corte | `corte-mobile-390.png` | Cierre en cero se ve mas complejo de lo que es | Estado de cierre unico con detalle expandible |
| P3 | Login demasiado alto y ceremonial | Login | `login-preview-mobile.png` | Menor velocidad de entrada | Login compacto con entorno reducido |

## 6. Lista de eliminacion

| Elemento | Ubicacion | Por que debe quitarse | Reemplazo | Prioridad |
| --- | --- | --- | --- | --- |
| Segundo empty state de Pedidos | Pedidos | Duplica mensaje y contradice estado inicial | Unico empty state contextual | P1 |
| Source panel completo por modulo | Pedidos, Pagos, Historial | Repite preview/sesion/capacidad antes del contenido | Mini sync line o icono de entorno | P1 |
| Accesos directos duplicados | Home | Repiten tabs principales | Bottom nav/command bar persistente | P1 |
| Eyebrows repetidos en cada card | Todas | Crean ritmo de landing, no de herramienta | Titulos compactos y labels solo donde agreguen contexto | P1 |
| Cards para todos los ceros | Home, Cocina, Pagos, Corte, Resumen K | Ocupan espacio sin informacion | Strip de contadores o estado unico | P1 |
| Navegacion Admin completa en cada subvista | Admin | Empuja contenido real hacia abajo | Selector compacto o drawer | P1 |
| Status badges de modulo como foco principal | Admin hub | Compiten con acciones | Status discreto en metadata | P2 |
| Texto tecnico de assets/rutas | Catalogo, Sorteos | No ayuda al operador general | Detalle expandible tecnico | P2 |
| "Command Center" como label | Pedidos | Decorativo y generico | "Pedidos" o nombre funcional | P2 |
| Hover global en cards enteras | CSS | Hace parecer clicables elementos que no siempre son acciones | Hover solo en elementos interactivos | P2 |

## 7. Lista de reacomodo

| Elemento | Ubicacion actual | Ubicacion sugerida | Motivo | Impacto esperado |
| --- | --- | --- | --- | --- |
| Entorno/sesion/D1 | Header y source panels | Command bar compacta superior | Evitar repeticion y ahorrar altura | Primer viewport mas util |
| Refresh | Header/status/source/hero | Boton unico persistente contextual | Reducir duplicidad | Menos duda sobre que actualiza |
| Home metricas | Cards grandes | Strip compacto de indicadores | Escaneo mas rapido | Mayor densidad |
| Pedidos filtros | Siempre visibles | Sheet/segmento colapsable | No estorbar cola | Accion mas rapida |
| Cocina "Siguiente" | Bajo hero y tabs | Primer bloque de Cocina | Cocina necesita prioridad inmediata | Menos scroll |
| Resumen K | Subtab con cards | Panel de lectura compacto | Evitar dashboard vacio | Menos ruido |
| Pagos pendientes | Igual jerarquia que todo | Bandeja principal | Confirmar pagos es tarea critica | Flujo mas directo |
| Admin modules | Cards largas + nav | Lista compacta/drawer | Admin es secundario | Menos scroll |
| Corte detalle | Muchas cards visibles | Acordeones por seccion | Solo mostrar datos cuando existan | Cierre mas claro |
| Sorteos assets | Mezclados en scroll | Tab Assets dentro de Sorteos | Aislar fallos de imagen | Gestion mas limpia |
| Catalogo stock | Cards por producto | Rows compactas o tabla responsive | Escaneo de stock | Edicion mas eficiente |

## 8. Recomendacion de arquitectura UX para Fase 2

Nueva estructura propuesta:

1. **Operacion** como pantalla principal. Sustituye Home por una vista de trabajo: pedidos activos, cocina pendiente, pagos pendientes y alertas.
2. **Pedidos** como cola de pedidos. Lista compacta, filtros bajo demanda, detalle en drawer/modal con foco gestionado.
3. **Cocina** como cola por item. El primer bloque debe ser "Siguiente en cocina"; Resumen K queda como subvista de lectura.
4. **Pagos** como bandeja de pendientes. Pagado/todos son filtros secundarios. WhatsApp y banco aparecen en contexto.
5. **Corte** como cierre de caja. Debe estar fuera de la navegacion diaria o dentro de Admin/Operacion secundaria, con CTA claro para exportar.
6. **Admin** como area secundaria. Contiene Banco, Historial, Catalogo, Sorteos y Reportes sin contaminar las tabs principales.
7. **Sorteos** separado por tareas: Campana, Participantes, Referidos, Assets, Ajustes.
8. **Catalogo** con rows compactas, filtros y acciones de stock.

Acciones siempre visibles:

- Refresh/sync contextual.
- Navegacion principal mobile.
- Indicador de entorno cuando sea preview/produccion.
- Conteo de pendientes reales: pedidos, cocina, pagos.

Acciones en detalle:

- Cancelar pedido.
- Descargar/compartir ticket.
- Editar nota de pago.
- Cambios de stock/catalogo.
- Ajustes de sorteo.

Secciones a fusionar:

- Home + estado operativo + quick actions deben fusionarse en Operacion.
- Historial y Reportes pueden vivir bajo Admin/Exportes.
- Datos bancarios debe estar bajo Configuracion/Pagos, no como modulo prominente.

Secciones a separar:

- Sorteos por tareas internas.
- Catalogo por productos/promos/banners/ingredientes si permanecen juntos.

## 9. Direccion visual sugerida

### Ruta 1: Control Room Dark

Concepto: consola operativa premium, sobria, legible, con densidad alta y senales de estado claras.

| Criterio | Direccion |
| --- | --- |
| Paleta | Fondo near-black `#05070b`, superficies `#101216`, lineas `#272a33`, texto `#f5f7fb` |
| Acento principal | Lima/verde solo para accion positiva o listo |
| Acentos secundarios | Cyan para informacion, amber para pendiente, rose para riesgo |
| Cards | Menos cards, mas rows y divisores finos |
| Navegacion | Bottom nav mobile, rail/toolbar desktop |
| Botones | Primario solido, secundarios silenciosos, status pasivo |
| Tipografia | Sans compacta; mono solo para folios, totales y timestamps |
| Motion | Transiciones de estado, entrada de pedido, pago confirmado |
| Personalidad | Operacion nocturna, premium, confiable |
| Riesgos | Puede sentirse demasiado sobria si se elimina todo el caracter Burgers.exe |
| Viabilidad | Alta. Encaja con dark actual y no exige dependencia nueva |

Recomendacion: ruta principal para Fase 2.

### Ruta 2: Neon Kitchen Ops

Concepto: energia Burgers.exe con acentos neon controlados, enfocada en cocina y estado vivo.

| Criterio | Direccion |
| --- | --- |
| Paleta | Off-black, verde lima, cyan electrico, amber caliente |
| Fondo | Dark con gradientes muy sutiles por area |
| Acento principal | Lima para acciones de cocina |
| Acentos secundarios | Cyan pagos/info, amber pendientes |
| Cards | Compactas con borde de estado lateral, no glow exterior constante |
| Navegacion | Tabs con iconos fuertes y labels cortos |
| Botones | Acciones tactiles, alto contraste |
| Iconografia | Lucide actual puede mantenerse con stroke consistente |
| Motion | Nuevo pedido, item hecho, pedido listo, pago confirmado |
| Ventajas | Mas personalidad Burgers.exe |
| Riesgos | Si se exagera, vuelve al ruido neon actual |
| Viabilidad | Media-alta. Requiere disciplina fuerte de color |

### Ruta 3: Compact SaaS Admin

Concepto: herramienta administrativa compacta, mas clara que expresiva.

| Criterio | Direccion |
| --- | --- |
| Paleta | Slate/zinc oscuro, azul/cyan moderado, verde para exito |
| Fondo | Menos gradiente, mas superficies planas |
| Acento principal | Cyan o verde moderado |
| Acentos secundarios | Minimos |
| Cards | Rows, tablas responsive y paneles compactos |
| Navegacion | Sidebar desktop, bottom nav mobile |
| Botones | Convencionales, muy accesibles |
| Iconografia | Lucide o Radix Icons |
| Motion | Minima y funcional |
| Ventajas | Rapida de mantener y accesible |
| Riesgos | Puede perder personalidad Burgers.exe |
| Viabilidad | Alta |

Ruta descartada como principal: Dark Glass Console. El preview ya abusa de superficies, bordes y efectos; agregar glassmorphism probablemente empeora la inflacion visual.

## 10. Motion recomendado para Fase 2

| Interaccion | Animacion recomendada | Proposito | Duracion | Reduced motion | Riesgo |
| --- | --- | --- | --- | --- | --- |
| Entrada de pedido nuevo | Highlight lateral + fade de row | Avisar cambio real sin toast invasivo | 180-240ms | Cambio instantaneo de borde | Si parpadea mucho, distrae |
| Cambio de tab | Crossfade corto sin desplazamiento vertical grande | Mantener contexto | 120-180ms | Sin animacion | Motion actual ya existe, evitar exceso |
| Item de cocina hecho | Check micro-scale + row reduce/transition a hechos | Confirmar accion | 160-220ms | Texto cambia y status visible | No ocultar demasiado rapido |
| Pedido listo | Cambio de estado con color + icono | Senal a cocina/entrega | 180ms | Sin movimiento | Depender solo de color |
| Pago confirmado | Success flash discreto y mover a pagados | Feedback de cobro | 180-240ms | Cambio inmediato | Perder registro si se mueve brusco |
| Refresh | Skeleton/linear loading en zona actual | Mostrar que actualiza la lista correcta | Mientras carga | Texto "Actualizando" | Spinner global confuso |
| Filtro aplicado | Result count update + collapse opcional | Confirmar que filtro actuo | 120ms | Sin animacion | Animar cada chip |
| Empty state | Entrada simple del mensaje unico | Orientar sin dramatizar | 150ms | Esttico | Empty state decorativo |
| Error | Inline shake no; usar borde/color + icono | Evitar mareo y comunicar riesgo | 0-120ms | Sin motion | Shake innecesario |

## 11. Accesibilidad

Problemas detectados:

- 320px muestra clipping real de contenido, aunque el documento no reporte overflow porque `overflow-x-hidden` lo oculta.
- La navegacion horizontal de tabs no comunica claramente que hay mas opciones fuera de viewport.
- Estados activos dependen mucho de color + borde; falta un patron mas claro con icono/texto persistente.
- Los modales existentes en codigo (`OrderDetailModal`, `CancellationReasonDialog`) tienen `role="dialog"` y Escape, pero no se observo focus trap ni retorno de foco. Se debe corregir en Fase 2.
- Muchas etiquetas uppercase con letter spacing alto reducen legibilidad en mobile.
- Varios bloques usan texto pequeno `10px-11px` para informacion operativa.
- Los empty states duplicados pueden confundir a lectores de pantalla y usuarios cognitivos.
- Hover/active se aplica a muchas cards, lo que puede sugerir interactividad donde no siempre corresponde.

Aspectos positivos:

- Inputs principales tienen labels visibles.
- Botones usan altura minima de 44px en CSS.
- Focus visible existe con `focus-visible`.
- `prefers-reduced-motion` esta considerado en CSS y `useReducedMotion` se usa en transicion de tabs.
- Algunos mensajes usan `aria-live`.

Recomendaciones:

- Eliminar clipping en 320px como requisito de aceptacion.
- Usar bottom nav o nav sticky con labels visibles y targets de 44px.
- En modales, implementar focus trap, foco inicial y retorno de foco.
- No depender solo de color: agregar iconos/labels semanticos para estado.
- Reducir uppercase y tracking en labels operativos.
- Unificar empty states por pantalla.
- Agregar axe-core a QA si se autoriza dependencia.

## 12. Librerias y patrones recomendados

| Libreria / patron | Problema que resolveria | Conviene | Riesgo | Alternativa sin dependencia | Requiere autorizacion |
| --- | --- | --- | --- | --- | --- |
| Motion / Framer Motion | Transiciones funcionales de estado, tab, pedido nuevo | Si, ya esta instalado como `framer-motion` | Exceso decorativo o jank si se anima todo | CSS transitions con `prefers-reduced-motion` | No para uso actual; si se cambia a `motion/react`, si |
| CSS animations vanilla | Feedback ligero sin bundle extra | Si | Dificil coordinar estados complejos | Transiciones CSS simples | No |
| Radix UI primitives | Dialog, Popover, Tabs accesibles | Si para Dialog/Popover si se aprueba instalar paquetes especificos; Tabs ya esta | Mezclar muchos primitives sin sistema | Implementacion propia con foco probado | Si para paquetes nuevos |
| Headless UI | Componentes accesibles alternativos | No por ahora | Redundante con Radix y React actual | Radix o nativo | Si |
| shadcn/ui como inspiracion | Buenas recetas de componentes owned-code | Si como referencia, no como dependencia automatica | Default shadcn sin identidad | Copiar patrones conceptuales y tokens propios | Si si se instala/genera |
| Tailwind CSS | Sistema responsive existente | Si, ya esta | Seguir acumulando utility slop sin tokens | CSS modules o clases semanticas actuales | No |
| Design tokens CSS / DTCG | Ordenar color, spacing, radius, estados | Si | Overengineering si se vuelve burocratico | CSS variables semanticas simples | No |
| Lucide icons | Iconografia consistente ya instalada | Si | Iconos usados como decoracion excesiva | Mantener solo iconos funcionales | No |
| Floating UI | Popovers/tooltips complejos | Solo si aparecen menus flotantes reales | Dependencia sin necesidad | CSS + Radix Popover | Si |
| axe-core | Auditoria a11y automatizada | Si para QA | Falsos negativos si se toma como verdad total | Checklist manual Playwright | Si |
| Playwright visual QA | Regression de viewports y screenshots | Si, ya esta | Snapshots fragiles si no se estabilizan datos | Capturas manuales por release | No |
| Storybook | Sistema de componentes de Fase 2 | Todavia no | Costo de setup alto | Pagina interna de componentes | Si |
| TanStack Table | Catalogo/Corte si se vuelven tablas densas | Solo como posible referencia | Meter tabla pesada para cards simples | Rows responsive nativas | Si |
| State machines | Estados pedido/pago/cocina mas auditables | Como patron primero, libreria no ahora | XState puede ser demasiado para esta fase | Reducer tipado y mapas de transicion | Si para dependencia |
| Carbon/Fluent como referencia | Densidad enterprise y estados | Si como referencia visual/IA, no dependencia | Perder marca Burgers.exe si se adopta completo | Sistema propio inspirado en patrones | Si si se instala |

## 13. Brief listo para Fase 2

Objetivo: redisenar Chekeo Burgers.exe como una consola operativa premium, mobile-first, rapida y clara. No maquillar la UI actual. Mantener contratos de datos, endpoints y logica critica.

Direccion visual recomendada: **Control Room Dark** con caracter Burgers.exe medido. Fondo near-black, superficies compactas, verde/lima solo para accion o listo, cyan para informacion, amber para pendiente, rose para riesgo. Reducir cards grandes y bordes. Usar rows, command bars y paneles densos.

Pantallas a transformar:

- Login compacto.
- Operacion/Home como tablero principal accionable.
- Pedidos como cola compacta con filtro bajo demanda.
- Cocina con "Siguiente en cocina" primero y Resumen K como drill-down.
- Pagos como bandeja de pendientes.
- Corte como cierre claro con detalles expandibles.
- Admin como area secundaria con navegacion compacta.
- Catalogo como lista/tabla compacta.
- Sorteos por submodulos: Campana, Participantes, Referidos, Assets, Ajustes.

Componentes a redisenar desde cero:

- Header/command bar.
- Navegacion mobile.
- Status/source panel.
- Cards de pedido.
- Filtros.
- Empty states.
- Admin hub.
- Dialog/drawer de pedido.
- Rows de Catalogo.
- Panel de Sorteos.

Cosas a eliminar:

- Empty state duplicado de Pedidos.
- Repeticion de preview/sesion/capacidad en cada modulo.
- Cards de metricas con cero sin valor.
- Eyebrows uppercase por todos lados.
- Navegacion Admin repetida.
- Copy decorativo tipo "Command Center".

Cosas a reacomodar:

- Refresh a command bar contextual.
- Accesos directos de Home a bottom nav.
- Datos bancarios bajo Configuracion/Pagos.
- Historial/Reportes bajo Admin.
- Resumen K como lectura secundaria.

Motion:

- Solo animacion funcional: pedido nuevo, item hecho, pago confirmado, cambio de estado, refresh.
- Respetar `prefers-reduced-motion`.
- No scroll hijack ni motion decorativo.

Accesibilidad:

- Corregir 320px sin clipping.
- Focus trap en modales/drawers.
- Estados no dependientes solo de color.
- Targets tactiles minimos 44px.
- Reducir texto pequeno y uppercase.
- Agregar axe-core si se autoriza.

QA:

- Playwright screenshots 320, 390, 430, desktop.
- Pruebas manuales con datos reales del preview.
- Validar login real con PIN temporal.
- Validar que no se toquen endpoints ni contratos de datos.
- Validar no usar servidor falso ni datos inventados.

Flujo Git:

- Trabajar en rama de Fase 2.
- Implementar por componentes pequenos pero con redisenio estructural.
- Ejecutar `npm run typecheck` y checks existentes.
- Capturar screenshots antes/despues.
- Actualizar Graphify con `graphify update .`.
- Commit y PR.

## 14. Checklist QA de la auditoria

- [x] Preview real usado.
- [x] Login real con `BOG_INTERNAL_PIN`.
- [x] Graphify ejecutado primero.
- [x] Playwright usado.
- [x] UI UX Pro Max usado.
- [x] Taste Skill usado.
- [x] Open Design probado y documentado como no disponible.
- [x] Mobile 320 revisado.
- [x] Mobile 390 revisado.
- [x] Mobile 430 revisado.
- [x] Desktop revisado.
- [x] Todas las pestanas reales disponibles revisadas: Login, Home, Pedidos, Cocina, Resumen K, Pagos, Admin, Datos bancarios, Historial, Cierre, Catalogo, Sorteos, Reportes.
- [x] Screenshots reales guardados.
- [x] Sin servidor falso.
- [x] Sin paginas fake.
- [x] Sin mocks falsos.
- [x] Sin redisenio implementado todavia.
- [x] PR creado.

## Screenshots finales

| Archivo | Contenido |
| --- | --- |
| `login-preview-mobile.png` | Login real |
| `home-mobile-390.png` | Home mobile |
| `home-desktop.png` | Home desktop |
| `pedidos-mobile-320.png` | Pedidos mobile 320 |
| `pedidos-mobile-390.png` | Pedidos mobile 390 |
| `pedidos-mobile-430.png` | Pedidos mobile 430 |
| `pedidos-desktop.png` | Pedidos desktop |
| `estado-vacio-mobile.png` | Empty state real de Pedidos |
| `cocina-mobile-390.png` | Cocina mobile |
| `cocina-desktop.png` | Cocina desktop |
| `resumen-k-mobile-390.png` | Resumen K |
| `pago-mobile-390.png` | Pagos |
| `pagos-mobile-390.png` | Alias de Pagos |
| `admin-hub-mobile-390.png` | Admin hub |
| `configuracion-mobile-390.png` | Datos bancarios / Configuracion |
| `historial-mobile-390.png` | Historial |
| `corte-mobile-390.png` | Corte |
| `catalogo-mobile-390.png` | Catalogo |
| `sorteo-mobile-390.png` | Sorteos |
| `sorteos-mobile-390.png` | Alias de Sorteos |
| `reportes-mobile-390.png` | Reportes |
