# Prompt para Codex — mejorar Mini Ticket Preview

Actúa como front-end engineer senior y product designer para Burgers.exe.

## Objetivo

Mejora el Mini Ticket Preview sin integrarlo todavía a Chekeo ni a producción.

## Skills recomendadas

- Principal: Graphify, para entender el proyecto y ubicar dónde debería vivir después el ticket.
- Secundaria: UI UX Pro Max, para mejorar jerarquía visual, legibilidad y reducción de saturación.
- Secundaria: Playwright, para generar screenshots del preview en mobile y validar descarga/visual.
- No usar Figma ni Open Design para esta fase: esta etapa es preview funcional en código, no mockup manual.

## Alcance permitido

Solo tocar:

- `docs/assets/burgers-mini-ticket-preview/**`

No tocar:

- Chekeo;
- app pública;
- flujo de pago real;
- contratos de datos;
- Cloudflare production config.

## Reglas de diseño

- Mantener tamaño `640×1100`.
- Mantener formato vertical compacto.
- Mantenerlo minimalista y legible.
- No agregar QR.
- No agregar redes.
- No mostrar Torre Valcob y Torre GGA al mismo tiempo; solo el punto elegido.
- Fecha sin hora.
- Pedido con extras y precio.
- Sorteo abajo sin saturar.
- Mantener temas de color: OG, BBQ, Sorteo, Magenta.
- No meter dependencias externas ni CDNs.

## Criterios de aceptación

- El preview abre en navegador sin build step.
- Se puede cambiar de tema.
- Se puede editar JSON.
- Se puede descargar SVG.
- Se puede descargar PNG.
- 640×1100 confirmado.
- Capturas mobile y desktop documentadas en el PR.
- No se modifica producción.
