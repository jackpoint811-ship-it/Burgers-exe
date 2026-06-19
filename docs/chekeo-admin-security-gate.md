# Chekeo Admin security gate

## Estado actual

Chekeo Operación v1 ahora reconoce dos modos de auth:

- `global`: modo por defecto y seguro. Si no existe una sesión válida, `InternalChekeoApp` renderiza `InternalLogin` antes de montar `Home`, `Pedidos`, `Cocina`, `Pagos` o `Admin`.
- `admin-only`: bandera explícita y auditable reservada para el futuro flujo con protección externa real y política backend compatible.

El PIN usa `POST /api/internal-v2-auth/login`. El backend valida contra `BOG_INTERNAL_PIN`, crea una sesión firmada y responde con la cookie HttpOnly `bog_internal_session`. La sesión dura 12 horas y se valida en cada endpoint interno con `requireAdminToken`.

`GET /api/internal-v2-auth/status` revisa si la cookie actual sigue activa. `POST /api/internal-v2-auth/logout` expira `bog_internal_session`.

No se usa `localStorage` como fuente de verdad. El frontend solo refleja el estado de la cookie de sesión.

## Estado real de `admin-only`

Hoy `VITE_INTERNAL_AUTH_MODE=admin-only` no abre el shell sin PIN global.

Chekeo mantiene el gate global incluso con esa bandera porque:

- los endpoints internos siguen dependiendo de `bog_internal_session`;
- no existe todavía una política backend de external-auth que cree una sesión operativa real;
- abrir `Home`, `Pedidos`, `Cocina` o `Pagos` sin esa sesión dejaría una operación falsa o degradada.

En otras palabras: `admin-only` queda preparado, documentado y visible como intención de diseño, pero no es un modo operativo completo en este PR.

## Endpoints protegidos

Los endpoints internos de pedidos, cocina, pagos, cierre, exportes, catálogo, ingredientes y sorteos siguen protegidos por la sesión actual. Entre ellos:

- `/api/orders-v2-admin*`
- `/api/kitchen-v2-admin/summary-k`
- `/api/menu-v2-admin*`
- `/api/ingredients-v2-admin*`
- `/api/raffles-v2-admin*`

`admin-only` no debe entenderse como bypass del backend. Mientras no exista una política backend compatible, Chekeo conserva el PIN global.

## Cómo usar la bandera `admin-only`

Solo considerar `admin-only` cuando la URL interna ya tenga una capa externa confirmada, por ejemplo Cloudflare Access o un control equivalente.

Variable:

- `VITE_INTERNAL_AUTH_MODE=admin-only`

Ejemplo de configuración:

```powershell
$env:VITE_INTERNAL_AUTH_MODE = "admin-only"
npm run build:internal
```

Si la variable falta, tiene un valor desconocido o no se configura, Chekeo vuelve a `global`.

Importante:

- hoy esa bandera no desactiva el PIN global;
- no activarla en preview o prod esperando operación sin PIN;
- no marcarla como lista hasta que frontend y backend cierren el mismo modelo de sesión real.

## Condiciones antes de activarlo

- La URL interna ya no es pública sin protección externa.
- Existe una política backend explícita para external-auth que no dependa de headers spoofeables.
- Preview ya validó que la operación no cae a mock o fallback por falta de sesión real.
- El equipo entiende que no basta con un flag de frontend para operar sin PIN global.
- No se están usando secretos en frontend ni docs.

## Reglas de seguridad

- No hardcodear PIN.
- No reemplazar `BOG_INTERNAL_PIN` desde frontend.
- No exponer `bog_internal_session` a JavaScript.
- No activar `admin-only` sin protección externa confirmada.
- No usar `admin-only` como bypass de endpoints internos.
