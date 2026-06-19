# Chekeo Admin security gate

## Estado actual

Chekeo Operación v1 ahora reconoce dos modos de auth:

- `global`: modo por defecto y seguro. Si no existe una sesión válida, `InternalChekeoApp` renderiza `InternalLogin` antes de montar `Home`, `Pedidos`, `Cocina`, `Pagos` o `Admin`.
- `admin-only`: modo explícito para una URL interna que ya esté protegida externamente. `Home`, `Pedidos`, `Cocina` y `Pagos` pueden abrir sin PIN global, pero `Admin` sigue pidiendo PIN interno antes de mostrar sus módulos.

El PIN usa `POST /api/internal-v2-auth/login`. El backend valida contra `BOG_INTERNAL_PIN`, crea una sesión firmada y responde con la cookie HttpOnly `bog_internal_session`. La sesión dura 12 horas y se valida en cada endpoint interno con `requireAdminToken`.

`GET /api/internal-v2-auth/status` revisa si la cookie actual sigue activa. `POST /api/internal-v2-auth/logout` expira `bog_internal_session`.

No se usa `localStorage` como fuente de verdad. El frontend solo refleja el estado de la cookie de sesión.

## Qué cambia en `admin-only`

Cuando `VITE_INTERNAL_AUTH_MODE=admin-only`:

- el shell principal puede renderizar sin login global;
- `Admin` muestra un bloqueo propio con `PIN Admin`;
- al desbloquear `Admin`, la sesión interna queda activa para el resto de la navegación actual;
- si logout o una respuesta `401` / `UNAUTHORIZED` expiran la sesión, `Admin` vuelve a bloquearse y pide PIN otra vez.

Este modo no relaja la protección backend. Los endpoints internos siguen dependiendo de `bog_internal_session`.

## Endpoints protegidos

Los endpoints internos de pedidos, cocina, pagos, cierre, exportes, catálogo, ingredientes y sorteos siguen protegidos por la sesión actual. Entre ellos:

- `/api/orders-v2-admin*`
- `/api/kitchen-v2-admin/summary-k`
- `/api/menu-v2-admin*`
- `/api/ingredients-v2-admin*`
- `/api/raffles-v2-admin*`

`admin-only` no debe entenderse como bypass del backend. Solo mueve el punto de entrada del PIN interno para que `Admin` siga protegido dentro de una URL ya cerrada al público.

## Cómo activar `admin-only`

Solo activar `admin-only` cuando la URL interna ya tenga una capa externa confirmada, por ejemplo Cloudflare Access o un control equivalente.

Variable:

- `VITE_INTERNAL_AUTH_MODE=admin-only`

Ejemplo local o preview:

```powershell
$env:VITE_INTERNAL_AUTH_MODE = "admin-only"
npm run preview:internal -- --host 127.0.0.1 --port 4174 --strictPort
```

También puede inyectarse en el build interno:

```powershell
$env:VITE_INTERNAL_AUTH_MODE = "admin-only"
npm run build:internal
```

Si la variable falta, tiene un valor desconocido o no se configura, Chekeo vuelve a `global`.

## Condiciones antes de activarlo

- La URL interna ya no es pública sin protección externa.
- Preview ya validó que `Admin` no abre módulos sin PIN.
- El equipo entiende que `Admin` conserva PIN interno aunque la URL ya esté protegida.
- No se están usando secretos en frontend ni docs.

## Reglas de seguridad

- No hardcodear PIN.
- No reemplazar `BOG_INTERNAL_PIN` desde frontend.
- No exponer `bog_internal_session` a JavaScript.
- No activar `admin-only` sin protección externa confirmada.
- No usar `admin-only` como bypass de endpoints internos.
