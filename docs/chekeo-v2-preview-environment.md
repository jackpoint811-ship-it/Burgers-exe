# Chekeo V2 preview environment validation

Este flujo valida que Chekeo V2 y Burgers.exe Preview operen el mismo ambiente sin tocar produccion, D1, R2, schemas ni contratos API.

## URLs

- Public production: <https://burgers-exe.pages.dev/>
- Public preview: <https://burgers-exe-public-v2-preview.pages.dev/>
- Internal production: <https://chekeo2-0.pages.dev/>
- Internal preview esperado: <https://burgers-exe-internal-v2-preview.pages.dev/>

## Bindings requeridos en Internal preview

El proyecto Pages `burgers-exe-internal-v2-preview` necesita:

- `BOG_MENU_DB`
- `BOG_MENU_ASSETS`
- `BOG_INTERNAL_PIN`

Estos bindings se configuran en Cloudflare Pages. No se cambian desde codigo en este PR.

## Deteccion de ambiente

Chekeo detecta el ambiente desde `window.location.hostname`:

- `localhost`, `127.0.0.1` o `*.localhost`: `LOCAL`
- hostnames con `preview`, `internal-v2-preview` o `public-v2-preview`: `PREVIEW`
- otros hostnames, incluido `chekeo2-0.pages.dev`: `PRODUCCION`

La UI no ofrece un switch manual de ambiente. Las lecturas y escrituras admin siguen usando el binding del deployment actual; el parametro de ambiente enviado a endpoints de ordenes se deriva del hostname para filtrar `public-v2` vs `public-v2-preview`.

## Validar Chekeo preview

1. Abrir `https://burgers-exe-internal-v2-preview.pages.dev/`.
2. Confirmar que el login y el header muestran `PREVIEW`.
3. Confirmar el copy: `Estas editando datos de prueba / preview.` y `Puedes validar cambios sin afectar produccion.`
4. Confirmar que el CTA dice `Ver Burgers.exe Preview`.
5. Confirmar que el CTA abre en nueva pestana:
   `https://burgers-exe-public-v2-preview.pages.dev/`

## Validar Chekeo produccion por hostname esperado

1. Abrir `https://chekeo2-0.pages.dev/`.
2. Confirmar que el login y el header muestran `PRODUCCION`.
3. Confirmar el copy: `Produccion: los cambios pueden afectar el menu real.` y `Estas operando el menu real.`
4. Confirmar que el CTA dice `Ver Burgers.exe Produccion`.
5. Confirmar que el CTA abre en nueva pestana:
   `https://burgers-exe.pages.dev/`

No ejecutar cambios operativos si la validacion no esta en una ventana controlada.

## Validar local

1. Levantar Internal V2 local con `npm run dev:internal`.
2. Abrir la URL local de Vite.
3. Confirmar que el login y el header muestran `LOCAL`.
4. Confirmar el copy: `Local: entorno de desarrollo.`

## Validar que preview usa el mismo entorno

1. Abrir Public preview:
   `https://burgers-exe-public-v2-preview.pages.dev/`
2. Confirmar que la UI publica muestra modo preview antes de cualquier checkout.
3. Abrir Chekeo preview:
   `https://burgers-exe-internal-v2-preview.pages.dev/`
4. Confirmar que Chekeo muestra `PREVIEW`.
5. No crear pedidos reales para esta validacion. Si se necesita probar ordenes, hacerlo solo con datos de prueba y en una ventana de QA autorizada.

## Validar `/api/menu-v2` con D1

Public preview:

```bash
curl -s https://burgers-exe-public-v2-preview.pages.dev/api/menu-v2 | python -c "import json,sys; data=json.load(sys.stdin); assert data['source']=='d1', data.get('source'); print('OK', data['source'])"
```

Internal preview:

```bash
curl -s https://burgers-exe-internal-v2-preview.pages.dev/api/menu-v2 | python -c "import json,sys; data=json.load(sys.stdin); assert data['source']=='d1', data.get('source'); print('OK', data['source'])"
```

Ambos deben responder `source: "d1"` cuando `BOG_MENU_DB` esta correctamente vinculado.

## Validar assets por `/api/assets-v2/...`

Usar una key real devuelta por `/api/menu-v2` como `imageKey`. Ejemplo:

```bash
curl -I https://burgers-exe-public-v2-preview.pages.dev/api/assets-v2/menu/OG.png
curl -I https://burgers-exe-internal-v2-preview.pages.dev/api/assets-v2/menu/OG.png
```

Esperado:

- `200` si el objeto existe en `BOG_MENU_ASSETS`.
- `404` seguro si la key no existe.
- No se expone R2 directo al navegador.

## Checklist de seguridad

- No tocar `main`.
- No cambiar Cloudflare config desde codigo.
- No cambiar `BOG_ACTIVE_ENV`.
- No modificar D1, R2, migrations ni schemas.
- No cambiar contratos API.
- No enviar pedidos reales.
- No usar switch manual para cruzar preview/produccion.
