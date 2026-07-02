# Public V2 Premium Redesign Spec

## Estado

Propuesta documental para la V2 oficial. Este PR no implementa UI, no agrega librerias y no modifica codigo de produccion.

## 1. Alcance confirmado

- Superficie objetivo: `apps/public-order-v2`
- App oficial: V2 publica de pedidos y consulta de tickets
- Fuera de alcance: `legacy/cloudflare/public-order/**`
- Fuera de alcance: cambios de backend, contratos, payloads, precios, promociones, reglas comerciales, deploy y produccion

La spec define direccion visual, prioridades de UX y plan incremental para futuras implementaciones en PRs separados.

## 2. Vision de producto

`public-order-v2` debe sentirse como una experiencia premium de pedido mobile-first: rapida, segura, altamente legible y con personalidad Burgers.exe.

La experiencia deseada no es la de una landing de marketing ni la de una app generica de comida. Debe combinar:

- identidad cyberpunk/gaming,
- claridad operativa para pedir sin friccion,
- confianza al revisar cantidades, extras y total,
- sensacion de progreso continuo desde menu hasta confirmacion.

La aplicacion debe ayudar a una persona a completar su pedido con el menor esfuerzo cognitivo posible, incluso en pantalla chica, brillo alto, conexion inestable o uso con una sola mano.

## 3. Principios de diseno

1. Mobile-first real: la prioridad es 320px a 430px antes que desktop.
2. Claridad antes que ornamento: la marca suma, pero nunca tapa el flujo.
3. CTA dominante: cada paso debe dejar evidente cual es la siguiente accion correcta.
4. Jerarquia de compra: burgers, customizacion, extras, datos y total deben escanearse de inmediato.
5. Marca Burgers.exe: oscuro, neon, gaming, con energia y control.
6. Feedback continuo: loading, error, exito y progreso deben sentirse consistentes.
7. Accesibilidad por defecto: foco visible, targets tactiles robustos, contraste y semantica.
8. Performance consciente: look premium sin volver pesada la app.
9. Sin deuda de producto escondida: la spec no debe exigir librerias ni cambios de arquitectura.

## 4. Arquitectura visual

La arquitectura visual propuesta para `apps/public-order-v2` se organiza en seis capas:

### 4.1 Chrome de aplicacion

- fondo global oscuro con textura muy sutil o gradiente controlado,
- header compacto con identidad de marca,
- stepper/progreso fijo o semi-fijo sin estorbar el contenido,
- contenedor principal centrado con ancho legible en desktop.

### 4.2 Flujo de compra

- bloques por etapa con separacion visual clara,
- CTA principal persistente o facil de reencontrar,
- resumen parcial visible cuando realmente ayude,
- transiciones de etapa que refuercen continuidad, no sorpresa.

### 4.3 Sistema de superficies

- panel principal para contenido activo,
- panel secundario para soporte y contexto,
- cards de producto con capas visuales predecibles,
- ticket/resumen con estilo de "receipt premium" pero muy legible.

### 4.4 Densidad de informacion

- datos criticos arriba,
- microcopy breve,
- detalles opcionales colapsables o visualmente subordinados,
- precios, cantidades y acciones alineados para lectura rapida.

### 4.5 Estados de sistema

- loading orientado a continuidad,
- errores inline cerca del campo o bloque afectado,
- success claro y celebratorio sin perder legibilidad,
- estados vacios y de fallback con tono de marca pero accionables.

### 4.6 Superficie de tickets

- `TicketsLookupPage` debe alinearse con el mismo lenguaje visual,
- lookup y resultado deben sentirse parte del mismo producto,
- el ticket debe priorizar lectura, estatus y datos utiles antes que decoracion.

## 5. Sistema visual y tokens

La implementacion futura debe normalizar un sistema de tokens para `apps/public-order-v2`, sin introducir tooling nuevo.

### 5.1 Color

- `--bg-base`: negro carbon o verde-negro profundo
- `--bg-surface`: panel principal oscuro
- `--bg-surface-alt`: panel alterno para jerarquia secundaria
- `--fg-primary`: texto casi blanco de alto contraste
- `--fg-muted`: texto de soporte y metadatos
- `--brand-primary`: verde neon principal
- `--brand-secondary`: cyan o lima secundaria muy controlada
- `--accent-warning`: ambar para alertas
- `--accent-danger`: rojo para errores
- `--accent-success`: verde de confirmacion
- `--focus-ring`: color dedicado de foco visible

### 5.2 Tipografia

- titulos con identidad monospace o techno legible,
- texto funcional con soporte system UI si mejora escaneo,
- escala tipografica compacta pero respirable,
- numeros y totales con contraste y peso altos.

### 5.3 Espaciado

- escala corta y consistente,
- separaciones verticales muy claras entre pasos,
- minima altura tactil de 44px en controles interactivos.

### 5.4 Bordes y radios

- radios pequenos o medianos, no blandos,
- borde visible como parte de la identidad terminal,
- glow de marca controlado solo en puntos de enfasis.

### 5.5 Elevacion y glow

- sombras discretas,
- glow reservado para CTA, foco, progreso o estados premium,
- evitar halos permanentes en demasiados elementos.

### 5.6 Motion tokens

- duracion corta,
- easing estable,
- reduced motion con degradacion real.

## 6. Componentes propuestos

Los siguientes componentes o patrones deben guiar PRs futuros dentro de `apps/public-order-v2`:

1. Hero compacto de producto:
   identidad, contexto y CTA inicial sin convertirse en landing.
2. Stepper premium:
   progreso claro, usable en touch y estable en widths pequenos.
3. Product card:
   foto o arte, nombre, precio, descripcion corta, acciones de cantidad.
4. Modifier group:
   opciones e ingredientes con seleccion obvia y errores claros.
5. Quantity control:
   botones tactiles, estado claro y lectura rapida.
6. Extras/add-ons card:
   seleccion simple, sin ruido visual.
7. Data form block:
   labels persistentes, helper text corto y errores inline.
8. Payment selector:
   metodos visualmente distintos, faciles de comparar.
9. Order summary panel:
   resumen premium, confiable y compacto.
10. Sticky action bar:
   CTA principal, total y estado de avance sin tapar contenido.
11. Success state:
   confirmacion clara, calmada y con proxima accion evidente.
12. Ticket lookup result:
   vista consistente con ticket, sorteo y estado de pedido.

## 7. Assets recomendados

La propuesta premium necesita assets, pero todos deben ser locales, livianos y opcionales por fase.

### Recomendados

- fotografia real de burger hero en formato optimizado,
- texturas oscuras sutiles comprimidas,
- iconografia local consistente,
- badges o sellos visuales para estados del pedido,
- ilustraciones muy contenidas para success o empty states.

### No recomendados

- video background,
- imagenes gigantes por paso,
- assets remotos,
- ilustraciones decorativas que tapen el contenido,
- efectos pesados tipo particle field o canvas continuo.

## 8. Motion y animaciones

La animacion debe aportar orientacion y calidad percibida, no ruido.

### Permitido

- transiciones suaves entre pasos,
- microfeedback en CTA y quantity controls,
- aparicion progresiva de paneles secundarios,
- feedback corto en success,
- shimmer o skeleton ligero en loading.

### Restricciones

- nada de animaciones largas o bloqueantes,
- nada de parallax fuerte,
- nada de loop ornamental permanente,
- respetar `prefers-reduced-motion`,
- evitar que la animacion cambie layout o cause reflow costoso.

## 9. Accesibilidad

Esta spec debe implementarse luego con WCAG 2.2 AA como piso minimo.

- foco visible y consistente en todos los pasos,
- contraste AA en texto, iconos y controles,
- labels persistentes en formularios,
- errores asociados semanticamente,
- stepper navegable y comprensible,
- targets tactiles de 44px minimo,
- estados no dependientes solo del color,
- orden de lectura coherente para lectores de pantalla,
- reduced motion funcional,
- resumen y total legibles aun con zoom y texto largo.

## 10. Performance budget

El look premium debe entrar dentro de un budget claro:

- sin nuevas librerias runtime,
- sin frameworks nuevos,
- sin CDNs,
- sin cambios de build system,
- sin fuentes remotas,
- imagen hero principal optimizada y con tamano acotado,
- iconografia preferentemente vector local,
- CSS y animaciones sin costo excesivo,
- evitar layout shift en hero, cards, resumen y sticky CTA,
- mantener la experiencia usable en dispositivos moviles medios.

## 11. Roadmap por fases

### Fase 0 - Spec y alineacion

- crear esta spec,
- validar alcance y limites,
- alinear stakeholders sobre la V2 oficial.

### Fase 1 - Tokenizacion visual base

- mapear colores, spacing, tipografia y estados en `styles.css`,
- sin alterar todavia toda la composicion.

### Fase 2 - Shell y progreso

- redisenar header, hero compacto, stepper y layout principal,
- asegurar estabilidad de sticky CTA.

### Fase 3 - Producto y customizacion

- evolucionar product cards, modifiers, extras y quantity controls,
- reforzar jerarquia de cantidades, precios y seleccion.

### Fase 4 - Datos, pago y resumen

- mejorar formulario, metodos de pago y panel de resumen,
- reforzar confianza antes de submit.

### Fase 5 - Success y ticket lookup

- alinear `TicketsLookupPage` con el sistema premium,
- pulir estados de exito, vacio y error.

### Fase 6 - QA visual y hardening

- validar 320, 390, 430 y desktop,
- revisar contraste, foco, reduced motion y performance,
- cerrar solo con evidencia visual real.

## 12. Plan de PRs futuros

Los cambios deben separarse para que cada PR siga siendo pequeno y revisable.

### PR 1 - Tokens base de Public V2

- archivos esperados: `apps/public-order-v2/src/styles.css`
- objetivo: colores, tipografia, spacing, focus y estados base

### PR 2 - Shell, hero y stepper

- archivos esperados: `apps/public-order-v2/src/components/PublicOrderApp.tsx`, `styles.css`
- objetivo: estructura premium del flujo

### PR 3 - Product cards y customizacion

- objetivo: cards, modifiers, extras y quantity controls

### PR 4 - Datos, pago y resumen

- objetivo: formulario, resumen, CTA sticky y feedback de submit

### PR 5 - Ticket lookup premium

- archivos esperados: `apps/public-order-v2/src/components/TicketsLookupPage.tsx`, `tickets.css`
- objetivo: unificar la experiencia de consulta y ticket con la V2 oficial

### PR 6 - QA, accesibilidad y performance

- objetivo: polish final, fixes visuales y evidencias

## 13. Criterios de aceptacion

Esta fase documental se considera aceptada si:

- se crea `docs/public-v2-premium-redesign-spec.md`,
- el alcance deja claro que el objetivo es `apps/public-order-v2`,
- queda explicito que `legacy/cloudflare/public-order/**` no es el target,
- no se toca codigo de produccion,
- no se agregan librerias,
- no se tocan backend, payloads, contratos ni precios,
- queda definido un roadmap incremental,
- quedan definidos PRs futuros pequenos y separados,
- se documentan accesibilidad y performance budget,
- la spec deja criterios suficientes para arrancar implementacion en un siguiente PR.

## 14. Referencias del repo

- `apps/public-order-v2/src/components/PublicOrderApp.tsx`
- `apps/public-order-v2/src/components/TicketsLookupPage.tsx`
- `apps/public-order-v2/src/styles.css`
- `apps/public-order-v2/src/tickets.css`
- `apps/public-order-v2/src/lib/menu-v2.ts`
- `apps/public-order-v2/src/lib/orders-v2.ts`
- `apps/public-order-v2/src/lib/raffles-v2.ts`
- `docs/ui-visual-system-v1.md`
- `docs/ui-redesign-release-readiness.md`
- `docs/public-order-mobile-qa.md`
