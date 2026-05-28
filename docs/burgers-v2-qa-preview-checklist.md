# Burgers.exe V2 QA Preview Checklist

Checklist para validar V2 en URL de preview (Cloudflare Pages o local preview), sin impacto a producción.

## Preconditions
- Build y typecheck en verde.
- URL de preview accesible.
- Confirmado que entorno es mock-only.

## Public Order V2 (`public-order-v2`)
- [ ] Carga inicial correcta (sin pantalla en blanco/errores críticos).
- [ ] Hero visible y consistente con diseño V2.
- [ ] Sección de promos renderiza correctamente.
- [ ] Menú muestra items esperados.
- [ ] Carrito abre/actualiza correctamente.
- [ ] Cantidades (+/-) actualizan subtotal y estado visual.
- [ ] Checkout mock completa flujo sin bloquear.
- [ ] Success mock aparece con mensaje esperado.
- [ ] `prefers-reduced-motion` respetado.
- [ ] Mobile 320px usable.
- [ ] Mobile 390px usable.
- [ ] Desktop usable.
- [ ] Sin llamadas productivas (`/api/order`, `/api/rpc`, dominios productivos).

## Internal Chekeo V2 (`internal-chekeo-v2`)
- [ ] PIN mock permite entrar al shell.
- [ ] Tabs principales cambian correctamente.
- [ ] Dashboard mock renderiza KPIs/estado esperado.
- [ ] Vista de pedidos carga y permite interacción mock.
- [ ] Vista de cocina muestra estado esperado.
- [ ] Mover estado de pedido funciona en mock.
- [ ] Modal de detalle abre/cierra sin errores.
- [ ] Pagos/notas mock editables según flujo definido.
- [ ] Historial mock visible y consistente.
- [ ] Logout mock regresa al estado inicial.
- [ ] `prefers-reduced-motion` respetado.
- [ ] Mobile 320px usable.
- [ ] Mobile 390px usable.
- [ ] Sin llamadas productivas (`/api/order`, `/api/rpc`, dominios productivos).

## Evidencia mínima sugerida
- Capturas de pantalla mobile + desktop por app.
- Registro de consola sin errores críticos.
- Registro de red validando ausencia de endpoints productivos.

## Criterio de bloqueo
Si aparece conexión real a backend productivo o dependencia operativa (auth/sheets/rpc real), el preview se considera bloqueado para aprobación.

## V2-5 polish validation (2026-05-26)
- Hero/promos/menu/cart were refined to feel commercial and brand-forward on 320/390 widths.
- Internal console header/tabs/cards/kitchen/modal were compacted for higher operator density.
- Confirmed all actions remain local mock interactions.

## V2-5.2 final preview polish validation (2026-05-26)
- Header interno validado como barra operativa compacta (no hero) en mobile 320/390.
- Tabs internas validadas sin overflow horizontal a 320px y active state claro.
- Dashboard/KPIs internos validados en versión compacta de alta densidad.
- Kitchen queue/modal validados sin acciones operativas en estados terminales (`delivered`, `cancelled`).
- Public V2 validado con micro ajustes de legibilidad/spacing en iPhone SE sin cambiar flujo.
- Confirmación explícita: mock-only, sin tocar V1/backend/producción.
- Gate de avance: con screenshots QA aprobados, iniciar V2-6 datos reales.

## QA catálogo admin V2 (internal preview)
- Abrir internal preview.
- Entrar con PIN mock.
- Ir a tab **Catálogo**.
- Confirmar carga de catálogo live (`source=d1`).
- Ingresar token admin preview y activar edición.
- Editar descripción/precio/disponibilidad de un item.
- Guardar y confirmar feedback "Producto actualizado".
- Confirmar que `GET /api/menu-v2` refleja cambios.
- Confirmar que public preview refleja cambios de catálogo.
- Confirmar que sin token no permite editar.
- Confirmar que con token incorrecto muestra error Unauthorized.
