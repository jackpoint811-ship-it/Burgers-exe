# Preview QA Fase 9A - 2026-07-06

## Autorizacion

El usuario autorizo la Fase 9A como QA funcional/visual preview read-only despues de mergear PR #347.

Autorizado:

- QA contra URLs preview base.
- Playwright contra URLs preview base.
- Evidencia/screenshot/logs de QA preview.
- Documentacion de QA.
- Commit, push y PR.

No autorizado y no ejecutado:

- Produccion real.
- Deploys.
- Seeds.
- Migrations.
- D1/R2 writes.
- Secrets, PINs o bindings.
- Cambios de Pages settings.
- Formularios que escriban datos.

## Targets

| Superficie | URL | Resultado |
| --- | --- | --- |
| Public preview | `https://burgers-exe-public-v2-preview.pages.dev` | `200 OK` |
| Public menu API | `https://burgers-exe-public-v2-preview.pages.dev/api/menu-v2` | `200 OK`, `source=d1`, `items=15`, `categories=4` |
| Internal preview | `https://burgers-exe-internal-v2-preview.pages.dev` | `200 OK` |
| Internal auth status | `https://burgers-exe-internal-v2-preview.pages.dev/api/internal-v2-auth/status` | `200 OK`, `authenticated=false` |

## Comandos ejecutados

```powershell
git checkout main
git pull origin main
git status --short
git branch --show-current
git checkout -b qa/phase-9a-preview-functional-visual
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\codex\verify-local-tooling.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\codex\verify-skills.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\codex\verify-preview-readiness.ps1
npm run typecheck
npm run build:public
npm run build:internal
curl.exe -I https://burgers-exe-public-v2-preview.pages.dev
curl.exe https://burgers-exe-public-v2-preview.pages.dev/api/menu-v2
curl.exe -I https://burgers-exe-internal-v2-preview.pages.dev
curl.exe https://burgers-exe-internal-v2-preview.pages.dev/api/internal-v2-auth/status
npx playwright test tests/preview/phase-9a-preview-smoke.spec.ts --workers=1 --reporter=list
```

## Playwright

Spec creada:

- `tests/preview/phase-9a-preview-smoke.spec.ts`

Resultado final:

- `2 passed`.
- No se enviaron formularios.
- No se uso PIN.
- Guard read-only: no se detectaron requests `POST`, `PUT`, `PATCH` ni `DELETE`.
- Public preview: pagina renderizada, CTA visible, menu desde D1 validado por API.
- Internal preview: pantalla de acceso visible, auth status `authenticated=false`.

Evidencia:

- `docs/operations/phase-9a-preview-qa/public-preview-desktop-1440.png`
- `docs/operations/phase-9a-preview-qa/public-preview-mobile-390.png`
- `docs/operations/phase-9a-preview-qa/public-preview-result.json`
- `docs/operations/phase-9a-preview-qa/internal-preview-desktop-1440.png`
- `docs/operations/phase-9a-preview-qa/internal-preview-mobile-390.png`
- `docs/operations/phase-9a-preview-qa/internal-preview-result.json`

## Hallazgos

### OK

- Public preview no muestra blank screen.
- Public preview carga menu desde D1.
- Public `/api/menu-v2` responde `source=d1`, `items=15`, `categories=4`.
- Public preview muestra modo preview y CTA visible sin completar pedido.
- Internal preview no muestra blank screen.
- Internal `/api/internal-v2-auth/status` responde `200` con `authenticated=false`.
- Internal preview muestra pantalla de acceso sin usar PIN.
- Layout mobile 390 y desktop 1440 cargan sin errores visuales bloqueantes.

### Riesgos / follow-up

- Public preview registra 404 de assets version preview:
  - `api/assets-v2/raffles/details/raffle-peimer-gran-sorte-202606-20260603T153634Z.png`
  - `api/assets-v2/raffles/banners/raffle-peimer-gran-sorte-202606-20260603T071818Z.png`
  - `api/assets-v2/menu/combo-bbq-20260611T214022Z.png`
- Estos 404 no bloquearon render, CTA ni menu D1, pero quedan como riesgo visual/asset antes de produccion.
- No se hizo click en CTA ni se completo checkout por alcance read-only.
- No se valido login interno ni flujos autenticados porque no se uso PIN.

## No-go

- No se detecto `source=fallback`.
- No se detecto auth `503`.
- No se detectaron writes D1/R2.
- No se detecto uso de produccion.
- Queda pendiente decidir si los assets 404 de preview son no-go visual antes de produccion o follow-up de hardening.

## Confirmaciones de seguridad

- Produccion no se toco.
- No hubo deploys.
- No hubo seeds.
- No hubo migrations.
- No hubo writes D1/R2.
- No se usaron secrets ni PINs.
- No se cambiaron bindings ni Pages settings.
