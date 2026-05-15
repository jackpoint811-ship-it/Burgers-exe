# Cloudflare Internal Chekeo — Deploy Checklist

## 1. Predeploy
- [ ] Confirmar PRs Fase 0–7 mergeados.
- [ ] Confirmar Web App actual operativa.
- [ ] Confirmar `public-order` operativo.
- [ ] Confirmar `BOG_ACTIVE_ENV`.
- [ ] Confirmar Script Properties.

## 2. Cloudflare Pages
- [ ] Crear Pages project apuntando a repo.
- [ ] Root directory: `cloudflare/internal-chekeo`.
- [ ] Build command: `exit 0`.
- [ ] Output directory: `.`.
- [ ] Variables: `INTERNAL_PANEL_PIN`, `INTERNAL_SESSION_SECRET`, `APPS_SCRIPT_INTERNAL_ENDPOINT`, `INTERNAL_API_SHARED_SECRET`, `ALLOWED_IPS` (opcional).
- [ ] Dominio/subdominio sugerido.
- [ ] Confirmar `noindex,nofollow`.

## 3. Apps Script
- [ ] Deploy Web App.
- [ ] URL configurada en `APPS_SCRIPT_INTERNAL_ENDPOINT`.
- [ ] `INTERNAL_API_SHARED_SECRET` igual en Cloudflare y Apps Script.
- [ ] Probar health.

## 4. Smoke test
- [ ] Login PIN.
- [ ] Cargar panel.
- [ ] Abrir pedido.
- [ ] Acción operativa simple.
- [ ] Cierre preview.
- [ ] Histórico.
- [ ] Logout.

## 5. Rollback
- [ ] Deshabilitar ruta Cloudflare o no usarla.
- [ ] Usar Web App actual.
- [ ] No tocar Sheets.
- [ ] No cambiar `BOG_ACTIVE_ENV`.
