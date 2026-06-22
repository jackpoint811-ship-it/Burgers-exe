const screens = [
  { id: "login", label: "PIN", code: "00" },
  { id: "operacion", label: "Operacion", code: "01" },
  { id: "pedidos", label: "Pedidos", code: "02" },
  { id: "detalle", label: "Detalle pedido", code: "03" },
  { id: "cocina", label: "Cocina", code: "04" },
  { id: "resumen", label: "Resumen K", code: "05" },
  { id: "pagos", label: "Pagos", code: "06" },
  { id: "pago-detalle", label: "Detalle pago", code: "07" },
  { id: "corte", label: "Corte", code: "08" },
  { id: "admin", label: "Admin", code: "09" },
  { id: "catalogo", label: "Catalogo", code: "10" },
  { id: "sorteos", label: "Sorteos", code: "11" },
  { id: "desktop", label: "Desktop overview", code: "12" },
];

const bottom = [
  ["operacion", "OPS"],
  ["pedidos", "PED"],
  ["cocina", "KDS"],
  ["pagos", "PAG"],
  ["admin", "ADM"],
];

const orders = [
  {
    folio: "PVW-04R1SN7KPM",
    customer: "QA-UIUX-PHASE2-1 01 Nuevo Cash",
    status: "new",
    pay: "pending",
    method: "cash",
    mode: "pickup",
    amount: 102,
    items: "OG",
    note: "Validar efectivo al entregar.",
  },
  {
    folio: "PVW-04R1SN8FLO",
    customer: "QA-UIUX-PHASE2-1 02 Preparando Transfer",
    status: "preparing",
    pay: "paid",
    method: "transfer",
    mode: "delivery",
    amount: 117,
    items: "BBQ + Papas Especiales",
    note: "Comprobante recibido. Ruta delivery activa.",
  },
  {
    folio: "PVW-04R1SNB2TA",
    customer: "QA-UIUX-PHASE2-1 03 Listo Transfer",
    status: "ready",
    pay: "pending",
    method: "transfer",
    mode: "pickup",
    amount: 146,
    items: "OG Full Loaded + Aros + Papas Especiales",
    note: "Esperando confirmacion de transferencia.",
  },
  {
    folio: "PVW-04R1SNNMPC",
    customer: "QA-UIUX-PHASE2-1 06 Nuevo Paid",
    status: "new",
    pay: "paid",
    method: "transfer",
    mode: "delivery",
    amount: 132,
    items: "BBQ + Aros",
    note: "Prioridad normal, ya pagado.",
  },
  {
    folio: "PVW-04R1SNPQKI",
    customer: "QA-UIUX-PHASE2-1 07 Preparando Cash",
    status: "preparing",
    pay: "pending",
    method: "cash",
    mode: "pickup",
    amount: 92,
    items: "OG",
    note: "Nota larga del cliente: sin cebolla, confirmar cambio antes de sellar.",
  },
  {
    folio: "PVW-04R1SNRCWM",
    customer: "QA-UIUX-PHASE2-1 08 Listo Paid",
    status: "ready",
    pay: "paid",
    method: "transfer",
    mode: "delivery",
    amount: 146,
    items: "Combo BBQ + Papas Lemon + Aros",
    note: "Pedido listo. Preparar evidencia para entrega.",
  },
];

const historyOrders = [
  ["PVW-04R1SNE43Z", "delivered", "paid", "cash", 120],
  ["PVW-04R1SNW2QN", "delivered", "pending", "transfer", 99],
  ["PVW-04R1SNKP1D", "cancelled", "cancelled", "transfer", 100],
  ["PVW-04R1SO1VNU", "cancelled", "pending", "cash", 115],
];

const topItems = [
  ["OG", 4, "$388"],
  ["BBQ", 2, "$194"],
  ["Combo BBQ", 1, "$146"],
  ["Aros", 1, "$30"],
  ["Papas Especiales", 1, "$25"],
];

const participants = [
  ["Gemma", "GEMMA-COMBO-35", 6],
  ["Sashenka", "SASHENKA-4TX", 4],
  ["Liam Romero Flores", "LIAM-DELIVERY", 4],
  ["Andrea", "ANDREA-OG", 3],
];

const menu = [
  ["OG", "$99", "Activo", "4 vendidos"],
  ["BBQ", "$97", "Activo", "2 vendidos"],
  ["Combo BBQ", "$146", "Activo", "1 vendido"],
  ["Aros", "$30", "Activo", "Upsell"],
  ["Papas Lemon", "$25", "Activo", "Guarnicion"],
  ["Papas Especiales", "$25", "Activo", "Guarnicion"],
];

const state = {
  variant: new URLSearchParams(location.search).get("variant") || "A",
  screen: new URLSearchParams(location.search).get("screen") || "operacion",
  capture: new URLSearchParams(location.search).get("capture") === "1",
  width: Number(new URLSearchParams(location.search).get("vw") || 390),
};

const root = document.getElementById("screenRoot");
const prototype = document.getElementById("prototype");
const list = document.getElementById("screenList");

if (state.capture) {
  prototype.classList.add("capture-mode");
}

document.documentElement.style.setProperty("--screen-w", `${state.width}px`);

function money(value) {
  return `$${value.toLocaleString("es-MX")}`;
}

function chip(text, tone = "") {
  return `<span class="chip ${tone}">${text}</span>`;
}

function statusChip(status) {
  const map = {
    new: ["Nuevo", "green"],
    preparing: ["Preparando", "yellow"],
    ready: ["Listo", "cyan"],
    delivered: ["Entregado", "green"],
    cancelled: ["Cancelado", "pink"],
  };
  const [label, tone] = map[status] || [status, ""];
  return chip(label, tone);
}

function payChip(pay) {
  const map = {
    pending: ["Pago pendiente", "yellow"],
    paid: ["Pagado", "green"],
    cancelled: ["Pago cancelado", "pink"],
  };
  const [label, tone] = map[pay] || [pay, ""];
  return chip(label, tone);
}

function navTarget(id) {
  if (id === "detalle") return "pedidos";
  if (id === "resumen") return "cocina";
  if (id === "pago-detalle" || id === "corte") return "pagos";
  if (id === "catalogo" || id === "sorteos") return "admin";
  return id;
}

function header(title, subtitle, actions = "") {
  return `
    <header class="app-header">
      <div class="status-line">
        <span>CHEKEO V2</span>
        <span>QA-UIUX-PHASE2-1</span>
      </div>
      <div class="header-main">
        <div>
          <h1>${title}</h1>
          <p>${subtitle}</p>
        </div>
        <div class="header-actions">
          ${actions || '<button class="icon-button" title="Sincronizar">SYNC</button><button class="icon-button" title="PIN">0485</button>'}
        </div>
      </div>
    </header>
  `;
}

function bottomNav(active) {
  const target = navTarget(active);
  return `
    <nav class="bottom-nav" aria-label="Navegacion principal">
      ${bottom
        .map(([id, label]) => `<button type="button" data-screen="${id}" class="${target === id ? "active" : ""}">${label}</button>`)
        .join("")}
    </nav>
  `;
}

function phone(title, subtitle, active, content, actions = "") {
  return `
    <article class="phone-shell variant-${state.variant.toLowerCase()}">
      <div class="phone-app">
        ${header(title, subtitle, actions)}
        <section class="screen-body">${content}</section>
        ${bottomNav(active)}
      </div>
    </article>
  `;
}

function metric(label, value, sub = "") {
  return `<div class="metric"><small>${label}</small><strong>${value}</strong><span>${sub}</span></div>`;
}

function orderCard(order, target = "detalle") {
  return `
    <button type="button" class="order-card" data-screen="${target}">
      <div class="order-head">
        <div>
          <span class="folio">${order.folio}</span>
          <small>${order.customer}</small>
        </div>
        <span class="amount">${money(order.amount)}</span>
      </div>
      <div class="chip-row">
        ${statusChip(order.status)}
        ${payChip(order.pay)}
        ${chip(order.method === "cash" ? "Efectivo" : "Transfer", order.method === "cash" ? "" : "cyan")}
        ${chip(order.mode === "pickup" ? "Pickup" : "Delivery")}
      </div>
      <div class="row-split">
        <span>${order.items}</span>
        <small>${order.note}</small>
      </div>
    </button>
  `;
}

function lane(title, count, percent, details, tone = "") {
  return `
    <div class="lane">
      <div class="lane-head">
        <strong>${title}</strong>
        ${chip(count, tone)}
      </div>
      <div class="progress-bar" style="--value:${percent}%"><span></span></div>
      <small>${details}</small>
    </div>
  `;
}

function heatGrid() {
  const values = [2, 4, 6, 3, 1, 5, 5, 3, 2, 4, 6, 1, 3, 6, 4, 5, 2, 2];
  return `<div class="heat-grid">${values.map((v, i) => `<div class="heat-cell" style="--heat:${v}">${i + 1}</div>`).join("")}</div>`;
}

function renderLogin() {
  return `
    <article class="phone-shell variant-${state.variant.toLowerCase()}">
      <div class="pin-screen">
        <section class="pin-hero">
          <div class="brand-lockup">
            <span class="brand-mark">B.exe</span>
            <div>
              <strong>Chekeo Control Room</strong>
              <span>Acceso interno preview</span>
            </div>
          </div>
          <h1>Turno bajo control.</h1>
          <p>Entrada por PIN para staff. Vista optimizada para cocina, pagos y seguimiento de pedidos activos.</p>
          <div class="chip-row">${chip("Preview Pages", "green")}${chip("PIN 0485", "cyan")}${chip("Mobile first")}</div>
        </section>
        <section class="pin-pad">
          <div class="pin-code"><span></span><span></span><span></span><span></span></div>
          <div class="pin-grid">
            ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button type="button">${n}</button>`).join("")}
            <button type="button">CLR</button><button type="button">0</button><button type="button" data-screen="operacion">OK</button>
          </div>
        </section>
      </div>
    </article>
  `;
}

function renderOperacion() {
  const variantA = `
    <div class="grid-2">
      ${metric("Pedidos activos", "6", "2 nuevos, 2 preparando, 2 listos")}
      ${metric("Venta bruta", "$954", "Ticket promedio $119.25")}
      ${metric("Entregados", "2", "$219 confirmado")}
      ${metric("Cancelados", "2", "$215 en riesgo")}
    </div>
    <div class="section-title"><h2>Mapa operativo</h2><span>actualizable cada 20s</span></div>
    <div class="stack">
      ${lane("Entrada", "2 nuevos", 34, "Cash y transfer mezclados", "green")}
      ${lane("Cocina", "2 en fuego", 62, "Notas visibles antes de sellar", "yellow")}
      ${lane("Salida", "2 listos", 82, "Un pago pendiente bloquea entrega", "cyan")}
    </div>
    <div class="card">
      <div class="row-split"><strong>Siguiente decision</strong>${chip("PVW-04R1SNB2TA", "yellow")}</div>
      <p class="muted">Confirmar transferencia antes de liberar pickup. El pedido ya esta listo y aparece en Pagos como pendiente.</p>
      <div class="action-row">
        <button class="solid-button" type="button" data-screen="pago-detalle">Ver pago</button>
        <button class="ghost-button" type="button" data-screen="pedidos">Abrir pedido</button>
      </div>
    </div>
  `;

  const variantB = `
    <div class="grid-3">
      ${metric("Activos", "6", "cola viva")}
      ${metric("Bloqueos", "3", "pago o nota")}
      ${metric("Meta", "8m", "despacho")}
    </div>
    <div class="section-title"><h2>Radar de presion</h2><span>slots por folio</span></div>
    <div class="card">${heatGrid()}</div>
    <div class="stack">
      ${lane("Pago bloquea salida", "1 folio", 78, "PVW-04R1SNB2TA necesita confirmacion", "yellow")}
      ${lane("Notas sensibles", "1 folio", 56, "Sin cebolla en PVW-04R1SNPQKI", "pink")}
      ${lane("Delivery listo", "1 folio", 88, "PVW-04R1SNRCWM espera ruta", "cyan")}
    </div>
    <div class="action-row">
      <button class="solid-button" type="button" data-screen="pedidos">Despachar cola</button>
      <button class="ghost-button" type="button" data-screen="cocina">Ver cocina</button>
    </div>
  `;

  return phone(
    "Operacion",
    state.variant === "A" ? "Panel de mando por flujo de trabajo" : "Panel de mando por presion operativa",
    "operacion",
    `<div class="stack">${state.variant === "A" ? variantA : variantB}</div>`,
  );
}

function renderPedidos() {
  const filter = `<div class="chip-row">${chip("Todos 10", "green")}${chip("Activos 6", "cyan")}${chip("Pago pendiente 3", "yellow")}${chip("Cancelados 2", "pink")}</div>`;
  const activeOrders = orders.map((o) => orderCard(o)).join("");
  const history = historyOrders
    .map(([folio, status, pay, method, amount]) =>
      `<div class="panel-row card"><div class="row-split"><span class="folio">${folio}</span><span class="amount">${money(amount)}</span></div><div class="chip-row">${statusChip(status)}${payChip(pay)}${chip(method === "cash" ? "Efectivo" : "Transfer")}</div></div>`,
    )
    .join("");

  const variantB = `
    <div class="grid-2">
      ${metric("Nueva orden", "2", "entrada")}
      ${metric("Salida lista", "2", "entrega")}
    </div>
    <div class="section-title"><h2>Board por estado</h2><span>tap para detalle</span></div>
    <div class="stack">${orders
      .slice()
      .sort((a, b) => a.status.localeCompare(b.status))
      .map((o) => orderCard(o))
      .join("")}</div>
  `;

  return phone(
    "Pedidos",
    state.variant === "A" ? "Lista principal con filtros persistentes" : "Board operativo por estado y bloqueo",
    "pedidos",
    `<div class="stack">${filter}${state.variant === "A" ? `<div class="stack">${activeOrders}</div><div class="section-title"><h2>Historial del batch</h2><span>4 registros</span></div><div class="stack">${history}</div>` : variantB}</div>`,
  );
}

function renderDetalle() {
  const order = orders[2];
  return phone(
    "Detalle",
    "Folio listo con transferencia pendiente",
    "detalle",
    `
      <div class="stack">
        ${orderCard(order, "detalle")}
        <div class="card">
          <div class="section-title"><h2>Timeline</h2><span>QA seeded</span></div>
          <div class="timeline">
            <div class="timeline-step"><span class="timeline-dot"></span><div><strong>Pedido recibido</strong><br><span>Cliente y items validados</span></div></div>
            <div class="timeline-step"><span class="timeline-dot"></span><div><strong>Cocina lista</strong><br><span>OG Full Loaded + Aros + Papas Especiales</span></div></div>
            <div class="timeline-step"><span class="timeline-dot"></span><div><strong>Bloqueo actual</strong><br><span>Confirmar transferencia antes de pickup</span></div></div>
          </div>
        </div>
        <div class="card">
          <div class="row-split"><strong>Checklist staff</strong>${chip("3 pasos", "cyan")}</div>
          <div class="chip-row">${chip("Comprobante", "yellow")}${chip("Bolsa sellada", "green")}${chip("Cliente avisado")}</div>
        </div>
        <div class="action-row">
          <button class="solid-button" type="button" data-screen="pago-detalle">Confirmar pago</button>
          <button class="ghost-button" type="button" data-screen="pedidos">Volver</button>
        </div>
      </div>
    `,
    '<button class="icon-button" data-screen="pedidos" title="Volver">BACK</button><button class="icon-button" title="Mas">MORE</button>',
  );
}

function renderCocina() {
  const variantA = `
    <div class="grid-2">
      ${metric("Burgers", "8", "OG 4, BBQ 2")}
      ${metric("Guarniciones", "5", "Aros y papas")}
    </div>
    <div class="stack">
      ${lane("Entrada KDS", "2 nuevos", 42, "PVW-04R1SN7KPM y PVW-04R1SNNMPC", "green")}
      ${lane("En plancha", "2 preparando", 66, "Notas visibles en tarjeta", "yellow")}
      ${lane("Empaque", "2 listos", 90, "Esperan pago o ruta", "cyan")}
    </div>
    <div class="card">
      <div class="row-split"><strong>Nota critica</strong>${chip("PVW-04R1SNPQKI", "pink")}</div>
      <p class="muted">Sin cebolla. Confirmar cambio antes de cerrar bolsa.</p>
    </div>
  `;
  const variantB = `
    <div class="section-title"><h2>Linea compacta</h2><span>prioridad por accion</span></div>
    <div class="stack">
      ${orders
        .filter((o) => o.status !== "ready")
        .map((o) => `<div class="lane"><div class="lane-head"><strong>${o.items}</strong>${statusChip(o.status)}</div><small>${o.folio} - ${o.note}</small><div class="progress-bar" style="--value:${o.status === "new" ? 30 : 70}%"><span></span></div></div>`)
        .join("")}
    </div>
    <div class="card">${heatGrid()}</div>
  `;
  return phone(
    "Cocina",
    state.variant === "A" ? "KDS por carriles y resumen de produccion" : "Linea compacta para staff con pocos taps",
    "cocina",
    `<div class="stack">${state.variant === "A" ? variantA : variantB}<div class="action-row"><button class="solid-button" type="button" data-screen="resumen">Resumen K</button><button class="ghost-button" type="button" data-screen="pedidos">Ver pedidos</button></div></div>`,
  );
}

function renderResumen() {
  return phone(
    "Resumen K",
    "Totales de cocina derivados de la siembra QA",
    "resumen",
    `
      <div class="stack">
        <div class="grid-2">${metric("Burgers", "8", "OG, BBQ, Combo")}${metric("Extras", "5", "Aros y papas")}</div>
        <div class="section-title"><h2>Top items</h2><span>cantidad y venta</span></div>
        <div class="stack">
          ${topItems.map(([name, qty, value]) => `<div class="menu-row"><div class="row-split"><strong>${name}</strong><span class="amount">${value}</span></div><small>${qty} unidades</small></div>`).join("")}
        </div>
        <div class="card">
          <div class="row-split"><strong>Corte cocina</strong>${chip("Listo para exportar", "green")}</div>
          <p class="muted">El frame prioriza lectura rapida de produccion y deja visibles las guarniciones que suelen perderse en tickets largos.</p>
        </div>
      </div>
    `,
    '<button class="icon-button" data-screen="cocina" title="Volver">BACK</button><button class="icon-button" title="Exportar">CSV</button>',
  );
}

function renderPagos() {
  const pending = orders.filter((o) => o.pay === "pending").map((o) => orderCard(o, "pago-detalle")).join("");
  return phone(
    "Pagos",
    state.variant === "A" ? "Cash y transfer con bloqueos visibles" : "Bandeja de conciliacion por riesgo",
    "pagos",
    `
      <div class="stack">
        <div class="grid-2">
          ${metric("Transfer", "$640", "6 pedidos")}
          ${metric("Efectivo", "$314", "4 pedidos")}
        </div>
        <div class="grid-2">
          ${metric("Pagados", "4", "en activos")}
          ${metric("Pendientes", "3", "bloquean salida")}
        </div>
        <div class="section-title"><h2>Pendientes de accion</h2><span>tap para validar</span></div>
        <div class="stack">${pending}</div>
        <div class="action-row">
          <button class="solid-button" type="button" data-screen="corte">Corte</button>
          <button class="ghost-button" type="button" data-screen="admin">Admin</button>
        </div>
      </div>
    `,
  );
}

function renderPagoDetalle() {
  return phone(
    "Pago",
    "Conciliacion de transferencia pendiente",
    "pago-detalle",
    `
      <div class="stack">
        <div class="payment-card">
          <div class="payment-head"><div><span class="folio">PVW-04R1SNB2TA</span><small>Pickup listo</small></div><span class="amount">$146</span></div>
          <div class="chip-row">${payChip("pending")}${chip("Transfer", "cyan")}${chip("Bloquea entrega", "yellow")}</div>
        </div>
        <div class="card">
          <div class="section-title"><h2>Checklist de pago</h2><span>staff</span></div>
          <div class="timeline">
            <div class="timeline-step"><span class="timeline-dot"></span><div><strong>Buscar comprobante</strong><br><span>WhatsApp o transferencia SPEI</span></div></div>
            <div class="timeline-step"><span class="timeline-dot"></span><div><strong>Validar monto</strong><br><span>Debe coincidir con $146</span></div></div>
            <div class="timeline-step"><span class="timeline-dot"></span><div><strong>Liberar pickup</strong><br><span>Se refleja en Pedidos y Operacion</span></div></div>
          </div>
        </div>
        <div class="action-row">
          <button class="solid-button" type="button" data-screen="pagos">Marcar pagado</button>
          <button class="ghost-button" type="button" data-screen="detalle">Ver pedido</button>
        </div>
      </div>
    `,
    '<button class="icon-button" data-screen="pagos" title="Volver">BACK</button><button class="icon-button" title="Adjuntar">IMG</button>',
  );
}

function renderCorte() {
  return phone(
    "Corte",
    "Resumen financiero del batch QA",
    "corte",
    `
      <div class="stack">
        <div class="grid-2">${metric("Venta bruta", "$954", "10 pedidos")}${metric("Ticket prom.", "$119.25", "sin cancelados")}</div>
        <div class="grid-2">${metric("Entregado", "$219", "2 pedidos")}${metric("Cancelado", "$215", "2 pedidos")}</div>
        <div class="card">
          <div class="row-split"><strong>Metodos</strong>${chip("conciliacion", "cyan")}</div>
          <div class="stack" style="margin-top:10px">
            ${lane("Transferencia", "$640", 67, "6 pedidos registrados", "cyan")}
            ${lane("Efectivo", "$314", 33, "4 pedidos registrados", "")}
          </div>
        </div>
        <div class="action-row">
          <button class="solid-button" type="button" data-screen="pagos">Cerrar caja</button>
          <button class="ghost-button" type="button" data-screen="admin">Exportar</button>
        </div>
      </div>
    `,
    '<button class="icon-button" data-screen="pagos" title="Volver">BACK</button><button class="icon-button" title="CSV">CSV</button>',
  );
}

function renderAdmin() {
  return phone(
    "Admin",
    "Control de sistema, catalogo, sorteos y jobs",
    "admin",
    `
      <div class="stack">
        <div class="grid-2">${metric("Preview", "OK", "Pages live")}${metric("PIN", "0485", "staff")}</div>
        <button class="order-card" type="button" data-screen="catalogo">
          <div class="row-split"><strong>Catalogo</strong>${chip("6 referencias", "green")}</div>
          <small>Estado de menu y lectura de productos activos.</small>
        </button>
        <button class="order-card" type="button" data-screen="sorteos">
          <div class="row-split"><strong>Sorteos</strong>${chip("PRIMER GRAN SORTE.exe", "cyan")}</div>
          <small>Campana activa, participantes y tickets reales consultados en preview.</small>
        </button>
        <div class="card">
          <div class="section-title"><h2>Operaciones admin</h2><span>sin tocar produccion</span></div>
          <div class="chip-row">${chip("Seed QA")}${chip("Export CSV")}${chip("Auditoria")}${chip("Roles")}</div>
        </div>
      </div>
    `,
  );
}

function renderCatalogo() {
  return phone(
    "Catalogo",
    "Menu visible para operaciones",
    "catalogo",
    `
      <div class="stack">
        ${menu.map(([name, price, status, note]) => `<div class="menu-row"><div class="row-split"><strong>${name}</strong><span class="amount">${price}</span></div><div class="chip-row">${chip(status, "green")}${chip(note)}</div></div>`).join("")}
        <div class="action-row">
          <button class="solid-button" type="button" data-screen="admin">Guardar vista</button>
          <button class="ghost-button" type="button" data-screen="admin">Volver</button>
        </div>
      </div>
    `,
    '<button class="icon-button" data-screen="admin" title="Volver">BACK</button><button class="icon-button" title="Nuevo">ADD</button>',
  );
}

function renderSorteos() {
  return phone(
    "Sorteos",
    "Campana activa consultada desde preview",
    "sorteos",
    `
      <div class="stack">
        <div class="card">
          <div class="row-split"><strong>PRIMER GRAN SORTE.exe</strong>${chip("Activo", "green")}</div>
          <p class="muted">Vigencia 2026-06-03 a 2026-06-30. 42 tickets base, 19 participantes.</p>
        </div>
        <div class="section-title"><h2>Top participantes</h2><span>tickets</span></div>
        ${participants.map(([name, code, tickets]) => `<div class="participant-row"><div class="row-split"><strong>${name}</strong><span class="amount">${tickets}</span></div><small>${code}</small></div>`).join("")}
        <div class="action-row">
          <button class="solid-button" type="button" data-screen="admin">Exportar</button>
          <button class="ghost-button" type="button" data-screen="admin">Volver</button>
        </div>
      </div>
    `,
    '<button class="icon-button" data-screen="admin" title="Volver">BACK</button><button class="icon-button" title="CSV">CSV</button>',
  );
}

function renderDesktop() {
  return `
    <article class="desktop-shell variant-${state.variant.toLowerCase()}">
      <div class="desktop-app">
        <aside class="desktop-side">
          <div class="brand-lockup">
            <span class="brand-mark">B.exe</span>
            <div><strong>Control Room</strong><span>Desktop command</span></div>
          </div>
          ${bottom.map(([id, label]) => `<button type="button" data-screen="${id}" class="${id === "operacion" ? "active" : ""}">${label} / ${id}</button>`).join("")}
          <button type="button" data-screen="sorteos">Sorteos</button>
        </aside>
        <section class="desktop-main">
          <div class="header-main">
            <div><h1>Operacion desktop</h1><p>Vista densa para coordinacion simultanea de pedidos, cocina y pagos.</p></div>
            <div class="chip-row">${chip("QA-UIUX-PHASE2-1", "green")}${chip("PIN 0485", "cyan")}${chip("Preview Pages")}</div>
          </div>
          <div class="desktop-grid">
            <div class="card wide">
              <div class="grid-3">${metric("Activos", "6", "cola")}${metric("Venta", "$954", "batch")}${metric("Pendientes", "3", "pago")}</div>
            </div>
            <div class="card tall">
              <div class="section-title"><h2>Pedidos activos</h2><span>6</span></div>
              <div class="stack" style="margin-top:12px">${orders.slice(0, 4).map((o) => orderCard(o)).join("")}</div>
            </div>
            <div class="card">
              <div class="section-title"><h2>Cocina</h2><span>KDS</span></div>
              <div class="stack" style="margin-top:12px">${lane("Entrada", "2", 34, "nuevos", "green")}${lane("Plancha", "2", 62, "preparando", "yellow")}${lane("Salida", "2", 82, "listos", "cyan")}</div>
            </div>
            <div class="card">
              <div class="section-title"><h2>Pagos</h2><span>$954</span></div>
              <div class="stack" style="margin-top:12px">${lane("Transferencia", "$640", 67, "6 pedidos", "cyan")}${lane("Efectivo", "$314", 33, "4 pedidos")}${lane("Pendiente", "3", 50, "bloqueos", "yellow")}</div>
            </div>
            <div class="card">
              <div class="section-title"><h2>Referencias usadas</h2><span>Phase 2.1</span></div>
              <div class="ref-strip" style="margin-top:12px">
                <img alt="Referencia operacion" src="../chekeo-phase-2-1-seed-qa/operacion-seeded-mobile-390.png" />
                <img alt="Referencia pedidos" src="../chekeo-phase-2-1-seed-qa/pedidos-seeded-mobile-390.png" />
                <img alt="Referencia cocina" src="../chekeo-phase-2-1-seed-qa/cocina-seeded-mobile-390.png" />
              </div>
            </div>
          </div>
        </section>
      </div>
    </article>
  `;
}

const renderers = {
  login: renderLogin,
  operacion: renderOperacion,
  pedidos: renderPedidos,
  detalle: renderDetalle,
  cocina: renderCocina,
  resumen: renderResumen,
  pagos: renderPagos,
  "pago-detalle": renderPagoDetalle,
  corte: renderCorte,
  admin: renderAdmin,
  catalogo: renderCatalogo,
  sorteos: renderSorteos,
  desktop: renderDesktop,
};

function navigate(screen) {
  state.screen = screen;
  const params = new URLSearchParams(location.search);
  params.set("screen", screen);
  params.set("variant", state.variant);
  if (state.capture) params.set("capture", "1");
  params.set("vw", state.width);
  history.replaceState(null, "", `${location.pathname}?${params.toString()}`);
  render();
}

function setVariant(variant) {
  state.variant = variant;
  render();
}

function renderScreenList() {
  if (state.capture) return;
  list.innerHTML = screens
    .map((screen) => `<button type="button" data-screen="${screen.id}" class="${screen.id === state.screen ? "active" : ""}"><span>${screen.label}</span><small>${screen.code}</small></button>`)
    .join("");

  document.querySelectorAll("[data-variant]").forEach((button) => {
    button.classList.toggle("active", button.dataset.variant === state.variant);
  });
}

function bindNavigation() {
  document.querySelectorAll("[data-screen]").forEach((button) => {
    button.addEventListener("click", () => navigate(button.dataset.screen));
  });
  document.querySelectorAll("[data-variant]").forEach((button) => {
    button.addEventListener("click", () => setVariant(button.dataset.variant));
  });
}

function render() {
  const renderer = renderers[state.screen] || renderOperacion;
  root.innerHTML = renderer();
  renderScreenList();
  bindNavigation();
  document.body.dataset.variant = state.variant;
}

render();
