# UI Live Validation Evidence — Burgers.exe

**Estado:** Validación live parcial completada

## Resumen

Se realizó una validación live post-rediseño sobre las dos aplicaciones públicas desplegadas de Burgers.exe.

### Qué se validó
- Carga y visual inicial de `public-order` en su URL productiva.
- Flujo observado de pedido en `public-order` desde hero/boot hasta la sección DATOS.
- Comportamiento de stepper, selección de burger OG, botones de cantidad (+/−), navegación por secciones y validaciones inline en DATOS.
- Foco visible sobre el primer campo inválido al intentar avanzar con DATOS vacío.
- Comportamiento observado de sticky nav sin bloqueo del flujo.
- Carga y pantalla de acceso (PIN) de `internal-chekeo` en su URL productiva.
- Revisión visual del acceso interno (operator console) en estado inicial.

### Qué no se validó
- Submit final del pedido en `public-order`.
- Flujo completo de “Pagar Antes”.
- Flujo interno completo de `internal-chekeo` (requiere PIN interno).
- Acciones de escritura (write actions) sobre backends/sistemas reales.
- Evidencia en dispositivos físicos iOS/Android (solo navegador/desktop).

### Por qué Chekeo queda parcial
La validación de `internal-chekeo` queda parcial porque el flujo funcional completo depende de PIN interno operativo, no disponible dentro de esta corrida documental.

### Resultado general observado
No se detectaron bugs bloqueantes en el recorrido observado.

## Evidencia por app

## Public-order
- **URL validada:** https://burgers-exe.pages.dev/

### Resultado por sección
- **hero:** visible correctamente.
- **stepper:** visible y funcional.
- **burger selection:** se pudo iniciar pedido y agregar burger OG.
- **custom:** se pudo avanzar en la sección.
- **extras:** se pudo avanzar en la sección.
- **guarniciones:** se pudo avanzar en la sección.
- **DATOS/errors/focus:** al intentar avanzar con DATOS vacío, aparecen errores inline y el primer campo inválido recibe foco visible.
- **sticky nav:** no bloqueó el flujo durante la prueba observada.
- **submit final:** no ejecutado (para evitar crear pedido real).

## Internal-chekeo
- **URL validada:** https://chekeo2-0.pages.dev/

### Resultado
- **PIN screen visible:** OK.
- **visual operator console:** OK en pantalla de acceso interno.
- **flujo interno completo:** pendiente por PIN interno.

## Limitaciones
- No se ejecutó submit final.
- No se validó Pagar Antes completo.
- No se validó Chekeo interno por PIN.
- No se validaron write actions.
- No se capturó evidencia en dispositivos físicos iOS/Android, solo navegador/desktop.

## Riesgos residuales
- Comportamiento de teclado virtual en móvil real.
- Posible focus trap en modales de Chekeo.
- Write actions en ambiente seguro.
- Validación visual final en dispositivos reales.
- Submit real de pedido.

## Veredicto
**Listo para validación final con usuario/operador**

> Nota: no se declara “listo para producción final” en esta fase.

## Próximos pasos
- Usuario valida `public-order` en celular real.
- Usuario/operador valida Chekeo con PIN.
- Si aparece bug real, abrir PR pequeño.
- Si no aparece bug, cerrar rediseño UI/UX.
