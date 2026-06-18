# Chekeo Admin security gate

## Estado actual

Chekeo Operación v1 sigue protegido por auth global. Al abrir la app, `InternalChekeoApp` consulta `GET /api/internal-v2-auth/status`; si no hay sesión válida, renderiza `InternalLogin` y no monta `Home`, `Pedidos`, `Cocina`, `Pagos` ni `Admin`.

El login usa `POST /api/internal-v2-auth/login` con el PIN ingresado por el operador. El backend valida ese PIN contra `BOG_INTERNAL_PIN`, crea una sesión firmada y responde con la cookie HttpOnly `bog_internal_session`. La sesión dura 12 horas y se valida en cada endpoint interno mediante `requireAdminToken`.

Logout usa `POST /api/internal-v2-auth/logout`, que expira `bog_internal_session`. En el cliente, logout también limpia pedidos cargados, errores, selección activa, avisos y vuelve al estado bloqueado por login global.

Si una llamada interna responde `401` o `UNAUTHORIZED`, `InternalChekeoApp` ejecuta expiración local de sesión, vuelve a datos mock no operables y muestra el login global.

## Endpoints protegidos

Los endpoints internos de pedidos, cocina, pagos, cierre, exportes, catálogo, ingredientes y sorteos dependen de la cookie de sesión actual. Entre ellos:

- `/api/orders-v2-admin*`
- `/api/kitchen-v2-admin/summary-k`
- `/api/menu-v2-admin*`
- `/api/ingredients-v2-admin*`
- `/api/raffles-v2-admin*`

Estos endpoints no deben quedar accesibles sin sesión mientras el sitio no tenga una capa externa confirmada.

## Preparación de PR-2

El cliente ahora reconoce el modo conceptual `VITE_INTERNAL_AUTH_MODE`, con `global` como default seguro. El modo futuro `admin-only` queda normalizado, pero no activa exposición directa de la app porque `shouldUseGlobalInternalAuthGate()` mantiene la compuerta global siempre encendida en este PR.

`AdminGate` queda conectado alrededor de `Admin` para marcar el punto de integración futuro. En el comportamiento actual no cambia nada: como la app completa sigue detrás del login global, `AdminGate` recibe `sessionActive=true` cuando Admin puede renderizar.

## Estado futuro previsto

El modo Admin-only solo debe activarse cuando exista una protección externa validada para la URL interna, por ejemplo Cloudflare Access. En ese escenario:

- Cloudflare Access protege la entrada a Chekeo.
- `Home`, `Pedidos`, `Cocina` y `Pagos` pueden abrir sin PIN interno, pero solo dentro de la URL ya protegida.
- `Admin` mantiene PIN interno o una sesión interna equivalente para módulos técnicos.
- Los endpoints internos siguen protegidos por backend; cualquier cambio de frontend debe acompañarse de una estrategia de endpoints compatible.

## Condiciones para activar Admin-only

No activar `admin-only` hasta cumplir todo esto:

- Cloudflare Access u otra capa externa está configurada y probada en preview.
- La URL interna no es pública sin esa protección.
- Hay QA que demuestre que `Admin` no renderiza módulos sin sesión interna.
- Los endpoints usados por `Home`, `Pedidos`, `Cocina` y `Pagos` tienen una política backend definida para el nuevo modelo.
- Logout y expiración dejan un estado claro y no exponen datos internos.

## Reglas de seguridad

- No hardcodear PIN.
- No reemplazar `BOG_INTERNAL_PIN` desde frontend.
- No exponer `bog_internal_session` a JavaScript.
- No usar `admin-only` como bypass del backend.
- No quitar el login global hasta que el PR de protección externa esté aprobado.
