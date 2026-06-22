import { buildWhatsappOrderSummaryLines, type WhatsappOrderMessageInput } from "./whatsapp";

type TicketItem = NonNullable<WhatsappOrderMessageInput["items"]>[number] & {
  itemKind?: string;
  comboBurgers?: Array<{ name: string }>;
  sideQuestExtras?: Array<{ name: string }>;
  includedDrink?: { name: string } | null;
};

export type OrderTicketImageData = WhatsappOrderMessageInput & {
  createdAt?: string;
  orderStatus?: string;
};

const IMAGE_WIDTH = 800;
const IMAGE_HEIGHT = 1200;
const SAFE_PADDING = 48;
const PANEL_X = SAFE_PADDING + 24;
const PANEL_WIDTH = IMAGE_WIDTH - PANEL_X * 2;

const formatCurrency = (value?: number) =>
  `$${(Number.isFinite(value) ? value ?? 0 : 0).toFixed(2)}`;

const safeText = (value: string | undefined, fallback = "-") => {
  const trimmed = value?.replace(/\s+/g, " ").trim();
  return trimmed || fallback;
};

const truncate = (value: string, maxLength: number) =>
  value.length > maxLength
    ? `${value.slice(0, Math.max(0, maxLength - 1))}…`
    : value;

const extractLocation = (note?: string) => {
  const match = note?.match(/Ubicación:\s*([^\n|]+)/i);
  return match?.[1]?.trim() || "Sin ubicación";
};

const wrapText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) => {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (!words.length) return [];
  const lines: string[] = [];
  let line = words[0] ?? "";

  for (const word of words.slice(1)) {
    const next = `${line} ${word}`;
    if (ctx.measureText(next).width <= maxWidth) {
      line = next;
    } else {
      lines.push(line);
      line = word;
    }
  }

  lines.push(line);
  return lines;
};

const drawRoundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) => {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
};

const canvasToBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("No se pudo generar el PNG del ticket."));
      },
      "image/png",
      0.96,
    );
  });

const getTicketItems = (order: OrderTicketImageData) =>
  ((order.items ?? []) as TicketItem[]).filter(Boolean);

const buildTicketItemLines = (item: TicketItem, index: number) => {
  const total =
    item.lineTotal ??
    (Number.isFinite(item.price) ? (item.price ?? 0) * item.qty : undefined);
  const lines = [
    `${item.qty}x ${safeText(item.name, `Producto ${index + 1}`)}${total !== undefined ? ` - ${formatCurrency(total)}` : ""}`,
  ];

  if (item.comboBurgers?.length) {
    lines.push(`Combo: ${item.comboBurgers.map((burger) => safeText(burger.name)).join(", ")}`);
  }
  if (item.extras?.length) {
    lines.push(`Extras: ${item.extras.map((extra) => safeText(extra.name)).join(", ")}`);
  }
  if (item.removedIngredients?.length) {
    lines.push(`Sin: ${item.removedIngredients.map((ingredient) => safeText(ingredient)).join(", ")}`);
  }
  if (item.garnish?.name) lines.push(`Guarnición: ${safeText(item.garnish.name)}`);
  if (item.sideQuestExtras?.length) {
    lines.push(`Side Quest: ${item.sideQuestExtras.map((extra) => safeText(extra.name)).join(", ")}`);
  }
  if (item.includedDrink?.name) lines.push(`Bebida: ${safeText(item.includedDrink.name)}`);
  if (item.burgerNote?.trim()) lines.push(`Nota: ${safeText(item.burgerNote)}`);

  return lines;
};

const buildTicketSections = (order: OrderTicketImageData) => {
  const items = getTicketItems(order);
  const sections = {
    burgers: [] as string[],
    combos: [] as string[],
    garnishes: [] as string[],
    others: [] as string[],
  };

  items.forEach((item, index) => {
    const lines = buildTicketItemLines(item, index);
    const kind = item.itemKind;
    if (kind === "combo") sections.combos.push(...lines);
    else if (kind === "garnish") sections.garnishes.push(...lines);
    else if (kind === "burger") sections.burgers.push(...lines);
    else sections.others.push(...lines);
  });

  return [
    { title: "Burgers", lines: sections.burgers },
    { title: "Combos", lines: sections.combos },
    { title: "Guarniciones", lines: sections.garnishes },
    { title: "Extras", lines: sections.others },
  ].filter((section) => section.lines.length);
};

const drawMetricCard = (
  ctx: CanvasRenderingContext2D,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number,
) => {
  drawRoundedRect(ctx, x, y, width, 78, 18);
  ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
  ctx.fill();
  ctx.strokeStyle = "rgba(34, 211, 238, 0.22)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#94a3b8";
  ctx.font = "900 14px 'Fira Sans', Arial, sans-serif";
  ctx.fillText(label, x + 18, y + 24);

  ctx.fillStyle = "#f8fafc";
  ctx.font = "900 26px 'Fira Sans', Arial, sans-serif";
  ctx.fillText(value, x + 18, y + 56);
};

const drawSectionHeader = (
  ctx: CanvasRenderingContext2D,
  title: string,
  y: number,
) => {
  ctx.fillStyle = "#67e8f9";
  ctx.font = "900 18px 'Fira Sans', Arial, sans-serif";
  ctx.fillText(title.toUpperCase(), PANEL_X, y);
};

const drawParagraph = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  color: string,
  maxLines = 3,
) => {
  ctx.fillStyle = color;
  const lines = wrapText(ctx, text, maxWidth).slice(0, maxLines);
  lines.forEach((line, index) => {
    ctx.fillText(line, x, y + index * lineHeight);
  });
  return y + Math.max(1, lines.length) * lineHeight;
};

export const buildOrderTicketSummaryText = (order: OrderTicketImageData) => [
  "Burgers.exe - Ticket",
  `Folio: ${safeText(order.folio)}`,
  `Cliente: ${safeText(order.customer ?? order.customerName)}`,
  `Entrega: ${extractLocation(order.note)}`,
  `Total: ${formatCurrency(order.total)}`,
  `Pago: ${safeText(order.paymentMethod, "no especificado")}`,
  `Estado de pago: ${safeText(order.paymentState ?? order.paymentStatus, "pendiente")}`,
  "",
  "Resumen del pedido:",
  ...buildWhatsappOrderSummaryLines(order),
].join("\n");

export const generateOrderTicketImage = async (
  order: OrderTicketImageData,
): Promise<Blob> => {
  const canvas = document.createElement("canvas");
  canvas.width = IMAGE_WIDTH;
  canvas.height = IMAGE_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas no está disponible en este navegador.");

  const gradient = ctx.createLinearGradient(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);
  gradient.addColorStop(0, "#050816");
  gradient.addColorStop(0.5, "#0c1326");
  gradient.addColorStop(1, "#101827");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);

  ctx.fillStyle = "rgba(34, 211, 238, 0.08)";
  for (let y = 0; y < IMAGE_HEIGHT; y += 6) {
    ctx.fillRect(0, y, IMAGE_WIDTH, 1);
  }

  drawRoundedRect(
    ctx,
    SAFE_PADDING,
    SAFE_PADDING,
    IMAGE_WIDTH - SAFE_PADDING * 2,
    IMAGE_HEIGHT - SAFE_PADDING * 2,
    36,
  );
  ctx.fillStyle = "rgba(6, 11, 18, 0.95)";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(34, 211, 238, 0.65)";
  ctx.shadowColor = "rgba(34, 211, 238, 0.5)";
  ctx.shadowBlur = 18;
  ctx.stroke();
  ctx.shadowBlur = 0;

  const location = extractLocation(order.note);
  const items = getTicketItems(order);
  const itemCount = items.reduce((total, item) => total + item.qty, 0);

  ctx.textAlign = "left";
  ctx.fillStyle = "#67e8f9";
  ctx.font = "900 18px 'Fira Sans', Arial, sans-serif";
  ctx.fillText("BURGERS.EXE", PANEL_X, 108);
  ctx.fillStyle = "#f8fafc";
  ctx.font = "900 48px 'Fira Sans', Arial, sans-serif";
  ctx.fillText(safeText(order.folio), PANEL_X, 160);
  ctx.fillStyle = "#e5e7eb";
  ctx.font = "700 24px 'Fira Sans', Arial, sans-serif";
  ctx.fillText(truncate(safeText(order.customer ?? order.customerName), 32), PANEL_X, 198);
  ctx.fillStyle = "#94a3b8";
  ctx.font = "600 16px 'Fira Sans', Arial, sans-serif";
  ctx.fillText(`${safeText(order.createdAt, "Sin hora")} · ${location}`, PANEL_X, 228);

  ctx.textAlign = "right";
  ctx.fillStyle = "#facc15";
  ctx.font = "900 18px 'Fira Sans', Arial, sans-serif";
  ctx.fillText(safeText(order.orderStatus, "Recibido"), PANEL_X + PANEL_WIDTH, 108);
  ctx.fillStyle = "#cbd5e1";
  ctx.font = "700 16px 'Fira Sans', Arial, sans-serif";
  ctx.fillText(`Pago ${safeText(order.paymentState ?? order.paymentStatus, "pendiente")}`, PANEL_X + PANEL_WIDTH, 136);

  drawMetricCard(ctx, "TOTAL", formatCurrency(order.total), PANEL_X, 272, 150);
  drawMetricCard(ctx, "ITEMS", String(itemCount), PANEL_X + 166, 272, 110);
  drawMetricCard(ctx, "PAGO", truncate(safeText(order.paymentMethod, "No definido"), 12), PANEL_X + 292, 272, 158);
  drawMetricCard(ctx, "ESTADO", truncate(safeText(order.paymentState ?? order.paymentStatus, "Pendiente"), 12), PANEL_X + 466, 272, 158);

  const sections = buildTicketSections(order);
  let cursorY = 390;
  ctx.textAlign = "left";
  sections.forEach((section) => {
    if (cursorY > 1000) return;
    drawSectionHeader(ctx, section.title, cursorY);
    cursorY += 24;
    ctx.fillStyle = "#e5e7eb";
    ctx.font = "600 16px 'Fira Sans', Arial, sans-serif";
    section.lines.forEach((line) => {
      if (cursorY > 1000) return;
      const wrapped = wrapText(ctx, line, PANEL_WIDTH);
      wrapped.slice(0, 2).forEach((piece) => {
        if (cursorY > 1000) return;
        ctx.fillText(truncate(piece, 72), PANEL_X, cursorY);
        cursorY += 22;
      });
    });
    cursorY += 12;
  });

  if (order.note) {
    drawSectionHeader(ctx, "Nota", Math.min(cursorY, 1016));
    ctx.font = "600 16px 'Fira Sans', Arial, sans-serif";
    drawParagraph(
      ctx,
      safeText(order.note),
      PANEL_X,
      Math.min(cursorY + 24, 1040),
      PANEL_WIDTH,
      22,
      "#fcd34d",
      3,
    );
  }

  ctx.textAlign = "center";
  ctx.fillStyle = "#67e8f9";
  ctx.font = "900 18px 'Fira Sans', Arial, sans-serif";
  ctx.fillText("Burgers.exe", IMAGE_WIDTH / 2, 1128);
  ctx.font = "600 14px 'Fira Sans', Arial, sans-serif";
  drawParagraph(
    ctx,
    "Gracias por tu pedido.",
    PANEL_X,
    1150,
    PANEL_WIDTH,
    18,
    "#94a3b8",
    2,
  );

  return canvasToBlob(canvas);
};

export const downloadOrderTicketImage = (blob: Blob, folio?: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `burgers-exe-${safeText(folio, "ticket")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const canShareOrderTicketImage = (blob: Blob, folio?: string) => {
  if (!navigator.canShare) return false;
  const file = new File([blob], `burgers-exe-${safeText(folio, "ticket")}.png`, {
    type: "image/png",
  });
  return navigator.canShare({ files: [file] });
};

export const shareOrderTicketImage = async (
  blob: Blob,
  order: OrderTicketImageData,
) => {
  const file = new File(
    [blob],
    `burgers-exe-${safeText(order.folio, "ticket")}.png`,
    { type: "image/png" },
  );
  const shareData: ShareData = {
    files: [file],
    text: buildOrderTicketSummaryText(order),
    title: `Burgers.exe ${safeText(order.folio, "ticket")}`,
  };
  if (!navigator.canShare?.(shareData))
    throw new Error("Este navegador no puede compartir archivos.");
  await navigator.share(shareData);
};
