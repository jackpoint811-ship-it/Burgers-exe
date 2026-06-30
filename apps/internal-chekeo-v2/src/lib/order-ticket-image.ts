import type { WhatsappOrderMessageInput } from "./whatsapp";

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

export const ORDER_TICKET_RAFFLE_NOTE =
  "Sorteo activo: conserva tu folio. Los tickets del sorteo se validan segun reglas vigentes.";

const IMAGE_WIDTH = 1080;
const MAX_IMAGE_HEIGHT = 1350;
const MIN_IMAGE_HEIGHT = 1040;
const SAFE_PADDING = 64;
const PANEL_X = SAFE_PADDING + 48;
const PANEL_WIDTH = IMAGE_WIDTH - PANEL_X * 2;
const PANEL_RIGHT = PANEL_X + PANEL_WIDTH;
const MAX_LINES_PER_ITEM = 4;

type TicketSection = {
  title: string;
  items: string[][];
};

type TicketRenderLine = {
  text: string;
  kind: "section" | "item" | "modifier";
};

type TicketLayout = {
  imageHeight: number;
  itemListBottomY: number;
  overflowBadgeY: number;
  raffleNoteY: number;
  footerY: number;
};

const formatCurrency = (value?: number) =>
  `$${(Number.isFinite(value) ? value ?? 0 : 0).toFixed(2)}`;

const FIXTURE_TAG_PATTERN = /\[FIXTURE:[^\]]+\]/gi;

const sanitizeText = (value: string | undefined) =>
  value?.replace(FIXTURE_TAG_PATTERN, "").replace(/\s+/g, " ").trim() ?? "";

const safeText = (value: string | undefined, fallback = "-") => {
  const trimmed = sanitizeText(value);
  return trimmed || fallback;
};

const truncate = (value: string, maxLength: number) =>
  value.length > maxLength
    ? `${value.slice(0, Math.max(0, maxLength - 3))}...`
    : value;

const truncateMiddle = (value: string, maxLength: number) => {
  if (value.length <= maxLength) return value;
  if (maxLength <= 6) return truncate(value, maxLength);
  const keepStart = Math.ceil((maxLength - 3) * 0.58);
  const keepEnd = Math.max(3, maxLength - 3 - keepStart);
  return `${value.slice(0, keepStart)}...${value.slice(-keepEnd)}`;
};

const fitTextToWidth = (
  ctx: CanvasRenderingContext2D,
  value: string,
  maxWidth: number,
  mode: "end" | "middle" = "end",
) => {
  if (ctx.measureText(value).width <= maxWidth) return value;
  let maxLength = value.length - 1;
  while (maxLength > 4) {
    const next =
      mode === "middle"
        ? truncateMiddle(value, maxLength)
        : truncate(value, maxLength);
    if (ctx.measureText(next).width <= maxWidth) return next;
    maxLength -= 1;
  }
  return mode === "middle" ? truncateMiddle(value, 4) : truncate(value, 4);
};

const isPreviewOrder = (order: OrderTicketImageData) =>
  order.source === "public-v2-preview";

const extractLocation = (note?: string) => {
  const match = note?.match(/Ubicación:\s*([^\n|]+)/i);
  return match?.[1]?.trim() || "Sin ubicación";
};

const paymentMethodImageLabel: Record<string, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  transfer: "Transferencia",
  transferencia: "Transferencia",
  spei: "Transferencia",
  unknown: "Por confirmar",
};

const paymentStatusImageLabel: Record<string, string> = {
  pending: "Pago pendiente",
  paid: "Pago confirmado",
  cancelled: "Pago cancelado",
};

const getPaymentMethodImageLabel = (method?: string) => {
  const normalized = method?.trim().toLowerCase() || "unknown";
  return paymentMethodImageLabel[normalized] || safeText(method, "Por confirmar");
};

const getPaymentStatusImageLabel = (status?: string) => {
  const normalized = status?.trim().toLowerCase() || "pending";
  return paymentStatusImageLabel[normalized] || safeText(status, "Pago pendiente");
};

const wrapText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) => {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (!words.length) return [];
  const lines: string[] = [];
  let line = "";

  const pushLongWord = (word: string) => {
    let chunk = "";
    for (const char of word) {
      const next = `${chunk}${char}`;
      if (ctx.measureText(next).width <= maxWidth) {
        chunk = next;
      } else {
        if (chunk) lines.push(chunk);
        chunk = char;
      }
    }
    return chunk;
  };

  for (const word of words) {
    if (ctx.measureText(word).width > maxWidth) {
      if (line) {
        lines.push(line);
        line = "";
      }
      line = pushLongWord(word);
      continue;
    }
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth) {
      line = next;
    } else {
      lines.push(line);
      line = word;
    }
  }

  if (line) lines.push(line);
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

const withSoftShadow = (
  ctx: CanvasRenderingContext2D,
  color: string,
  blur: number,
  draw: () => void,
) => {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  draw();
  ctx.restore();
};

const drawDivider = (
  ctx: CanvasRenderingContext2D,
  y: number,
  color = "rgba(132, 204, 22, 0.24)",
) => {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 12]);
  ctx.beginPath();
  ctx.moveTo(PANEL_X, y);
  ctx.lineTo(PANEL_RIGHT, y);
  ctx.stroke();
  ctx.restore();
};

const drawTicketShell = (ctx: CanvasRenderingContext2D, layout: TicketLayout) => {
  const shellX = SAFE_PADDING;
  const shellY = SAFE_PADDING;
  const shellWidth = IMAGE_WIDTH - SAFE_PADDING * 2;
  const shellHeight = layout.imageHeight - SAFE_PADDING * 2;

  withSoftShadow(ctx, "rgba(132, 204, 22, 0.28)", 24, () => {
    drawRoundedRect(ctx, shellX, shellY, shellWidth, shellHeight, 42);
    ctx.fillStyle = "rgba(5, 10, 14, 0.965)";
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "rgba(132, 204, 22, 0.46)";
    ctx.stroke();
  });

  ctx.save();
  ctx.fillStyle = "rgba(132, 204, 22, 0.11)";
  for (let x = shellX + 38; x < shellX + shellWidth - 38; x += 30) {
    ctx.beginPath();
    ctx.arc(x, shellY + 24, 3, 0, Math.PI * 2);
    ctx.arc(x, shellY + shellHeight - 24, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  drawDivider(ctx, 330, "rgba(148, 163, 184, 0.22)");
  drawDivider(ctx, layout.raffleNoteY - 22, "rgba(148, 163, 184, 0.22)");
};

const drawPill = (
  ctx: CanvasRenderingContext2D,
  label: string,
  x: number,
  y: number,
  width: number,
  color: string,
) => {
  drawRoundedRect(ctx, x, y, width, 34, 16);
  ctx.fillStyle = `${color}22`;
  ctx.fill();
  ctx.strokeStyle = `${color}70`;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = "900 15px 'Fira Sans', Arial, sans-serif";
  ctx.fillText(fitTextToWidth(ctx, label.toUpperCase(), width - 24), x + 12, y + 23);
};

const getPaymentStatusColor = (status?: string) => {
  const normalized = status?.trim().toLowerCase() || "pending";
  if (normalized === "paid") return "#a3e635";
  if (normalized === "cancelled") return "#fb7185";
  return "#facc15";
};

const drawMetaLine = (
  ctx: CanvasRenderingContext2D,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number,
) => {
  ctx.fillStyle = "#67e8f9";
  ctx.font = "900 15px 'Fira Sans', Arial, sans-serif";
  ctx.fillText(label.toUpperCase(), x, y);
  ctx.fillStyle = "#dbeafe";
  ctx.font = "800 20px 'Fira Sans', Arial, sans-serif";
  ctx.fillText(fitTextToWidth(ctx, value, width), x, y + 28);
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
  const lines = [
    `${item.qty}x ${safeText(item.name, `Producto ${index + 1}`)}`,
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
  if (item.garnish?.name) lines.push(`Guarnicion: ${safeText(item.garnish.name)}`);
  if (item.sideQuestExtras?.length) {
    lines.push(`Side Quest: ${item.sideQuestExtras.map((extra) => safeText(extra.name)).join(", ")}`);
  }
  if (item.includedDrink?.name) lines.push(`Bebida: ${safeText(item.includedDrink.name)}`);

  return lines.map((line) => safeText(line)).filter(Boolean);
};

const buildTicketSections = (order: OrderTicketImageData) => {
  const items = getTicketItems(order);
  const sections = {
    burgers: [] as string[][],
    combos: [] as string[][],
    garnishes: [] as string[][],
    others: [] as string[][],
  };

  items.forEach((item, index) => {
    const lines = buildTicketItemLines(item, index);
    const kind = item.itemKind;
    if (kind === "combo") sections.combos.push(lines);
    else if (kind === "garnish") sections.garnishes.push(lines);
    else if (kind === "burger") sections.burgers.push(lines);
    else sections.others.push(lines);
  });

  return [
    { title: "Burgers", lines: sections.burgers },
    { title: "Combos", lines: sections.combos },
    { title: "Guarniciones", lines: sections.garnishes },
    { title: "Extras", lines: sections.others },
  ]
    .filter((section) => section.lines.length)
    .map((section) => ({
      title: section.title,
      items: section.lines,
    })) satisfies TicketSection[];
};

const getTicketCanvasHeight = (sections: TicketSection[]) => {
  const estimatedLines = sections.reduce(
    (total, section) =>
      total +
      1 +
      section.items.reduce(
        (itemTotal, lines) => itemTotal + Math.min(lines.length, MAX_LINES_PER_ITEM),
        0,
      ),
    0,
  );
  return Math.min(
    MAX_IMAGE_HEIGHT,
    Math.max(MIN_IMAGE_HEIGHT, 900 + estimatedLines * 34),
  );
};

const getTicketLayout = (imageHeight: number): TicketLayout => ({
  imageHeight,
  itemListBottomY: imageHeight - 274,
  overflowBadgeY: imageHeight - 264,
  raffleNoteY: imageHeight - 184,
  footerY: imageHeight - 128,
});

const drawPaymentPanel = (
  ctx: CanvasRenderingContext2D,
  total: string,
  method: string,
  status: string,
  rawStatus: string | undefined,
  x: number,
  y: number,
  width: number,
) => {
  const height = 124;
  drawRoundedRect(ctx, x, y, width, height, 24);
  ctx.fillStyle = "rgba(10, 18, 24, 0.9)";
  ctx.fill();
  ctx.strokeStyle = "rgba(132, 204, 22, 0.28)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "rgba(132, 204, 22, 0.78)";
  ctx.fillRect(x, y + 18, 5, height - 36);

  ctx.fillStyle = "#8bd7d2";
  ctx.font = "900 15px 'Fira Sans', Arial, sans-serif";
  ctx.fillText("TOTAL", x + 28, y + 34);
  ctx.fillStyle = "#f8fafc";
  ctx.font = "900 54px 'Fira Sans', Arial, sans-serif";
  ctx.fillText(fitTextToWidth(ctx, total, width * 0.48), x + 28, y + 88);

  const metaX = x + Math.floor(width * 0.56);
  ctx.fillStyle = "#94a3b8";
  ctx.font = "800 16px 'Fira Sans', Arial, sans-serif";
  ctx.fillText("METODO", metaX, y + 38);
  ctx.fillStyle = "#e5e7eb";
  ctx.font = "850 23px 'Fira Sans', Arial, sans-serif";
  ctx.fillText(fitTextToWidth(ctx, method, width - (metaX - x) - 24), metaX, y + 68);
  drawPill(
    ctx,
    status,
    metaX,
    y + 80,
    Math.min(260, width - (metaX - x) - 24),
    getPaymentStatusColor(rawStatus),
  );
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

const buildTicketRenderLines = (sections: TicketSection[]) => {
  const lines: TicketRenderLine[] = [];
  let hiddenLineCount = 0;

  sections.forEach((section) => {
    lines.push({ text: section.title.toUpperCase(), kind: "section" });
    section.items.forEach((itemLines) => {
      const visibleItemLines = itemLines.slice(0, MAX_LINES_PER_ITEM);
      hiddenLineCount += Math.max(0, itemLines.length - visibleItemLines.length);
      visibleItemLines.forEach((line, index) => {
        lines.push({
          text: line,
          kind: index === 0 ? "item" : "modifier",
        });
      });
    });
  });

  return { lines, hiddenLineCount };
};

const drawOverflowBadge = (
  ctx: CanvasRenderingContext2D,
  hiddenLineCount: number,
  layout: TicketLayout,
) => {
  if (hiddenLineCount <= 0) return;
  const label = `+ ${hiddenLineCount} líneas más en Chekeo`;
  drawRoundedRect(ctx, PANEL_X, layout.overflowBadgeY, PANEL_WIDTH, 30, 12);
  ctx.fillStyle = "rgba(250, 204, 21, 0.11)";
  ctx.fill();
  ctx.strokeStyle = "rgba(250, 204, 21, 0.32)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = "#facc15";
  ctx.font = "900 14px 'Fira Sans', Arial, sans-serif";
  ctx.fillText(label, PANEL_X + 14, layout.overflowBadgeY + 20);
};

export const buildOrderTicketSummaryText = (order: OrderTicketImageData) => [
  "Burgers.exe - Ticket",
  `Folio: ${safeText(order.folio)}`,
  `Cliente: ${safeText(order.customer ?? order.customerName)}`,
  `Entrega: ${safeText(order.deliveryDetail, extractLocation(order.note))}`,
  `Total: ${formatCurrency(order.total)}`,
  `Pago: ${getPaymentMethodImageLabel(order.paymentMethod)} (${getPaymentStatusImageLabel(order.paymentState ?? order.paymentStatus)})`,
  "",
  "Pedido:",
  ...getTicketItems(order).map((item, index) => `${item.qty}x ${safeText(item.name, `Producto ${index + 1}`)}`),
  "",
  ORDER_TICKET_RAFFLE_NOTE,
].join("\n");

export const generateOrderTicketImage = async (
  order: OrderTicketImageData,
): Promise<Blob> => {
  const sections = buildTicketSections(order);
  const itemCount = getTicketItems(order).reduce((total, item) => total + item.qty, 0);
  const layout = getTicketLayout(getTicketCanvasHeight(sections));
  const canvas = document.createElement("canvas");
  canvas.width = IMAGE_WIDTH;
  canvas.height = layout.imageHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas no esta disponible en este navegador.");

  const gradient = ctx.createLinearGradient(0, 0, IMAGE_WIDTH, layout.imageHeight);
  gradient.addColorStop(0, "#020617");
  gradient.addColorStop(0.46, "#071814");
  gradient.addColorStop(1, "#05070d");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, IMAGE_WIDTH, layout.imageHeight);

  ctx.fillStyle = "rgba(34, 211, 238, 0.04)";
  for (let y = 0; y < layout.imageHeight; y += 8) {
    ctx.fillRect(0, y, IMAGE_WIDTH, 1);
  }

  ctx.save();
  ctx.rotate(-0.34);
  ctx.fillStyle = "rgba(132, 204, 22, 0.045)";
  for (let x = -layout.imageHeight; x < IMAGE_WIDTH * 1.4; x += 78) {
    ctx.fillRect(x, 0, 2, layout.imageHeight * 1.65);
  }
  ctx.restore();

  if (isPreviewOrder(order)) {
    ctx.save();
    ctx.translate(IMAGE_WIDTH / 2, layout.imageHeight * 0.48);
    ctx.rotate(-0.34);
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(250, 204, 21, 0.075)";
    ctx.font = "900 128px 'Fira Sans', Arial, sans-serif";
    ctx.fillText("PEDIDO DE PRUEBA", 0, 0);
    ctx.restore();
  }

  drawTicketShell(ctx, layout);

  const deliveryDetail = safeText(order.deliveryDetail, extractLocation(order.note));
  const paymentMethod = getPaymentMethodImageLabel(order.paymentMethod);
  const paymentStatus = getPaymentStatusImageLabel(
    order.paymentState ?? order.paymentStatus,
  );

  ctx.textAlign = "left";
  ctx.fillStyle = "#a3e635";
  ctx.font = "900 24px 'Fira Sans', Arial, sans-serif";
  ctx.fillText("BURGERS.EXE", PANEL_X, 124);

  if (isPreviewOrder(order)) {
    drawPill(ctx, "PEDIDO DE PRUEBA", PANEL_RIGHT - 232, 98, 232, "#facc15");
  }

  ctx.fillStyle = "#67e8f9";
  ctx.font = "900 15px 'Fira Sans', Arial, sans-serif";
  ctx.fillText("FOLIO", PANEL_X, 162);
  ctx.fillStyle = "#f8fafc";
  ctx.font = "900 60px 'Fira Sans', Arial, sans-serif";
  ctx.fillText(
    fitTextToWidth(ctx, safeText(order.folio), 536, "middle"),
    PANEL_X,
    224,
  );

  ctx.fillStyle = "#94a3b8";
  ctx.font = "750 17px 'Fira Sans', Arial, sans-serif";
  ctx.fillText(fitTextToWidth(ctx, safeText(order.createdAt, "Sin hora"), 536), PANEL_X, 258);

  const metaX = PANEL_X + 590;
  const metaWidth = PANEL_RIGHT - metaX;
  const customerLines = wrapText(
    ctx,
    safeText(order.customer ?? order.customerName),
    metaWidth,
  ).slice(0, 2);
  ctx.fillStyle = "#67e8f9";
  ctx.font = "900 15px 'Fira Sans', Arial, sans-serif";
  ctx.fillText("CLIENTE", metaX, 162);
  ctx.fillStyle = "#e5e7eb";
  ctx.font = "850 22px 'Fira Sans', Arial, sans-serif";
  customerLines.forEach((line, index) => {
    ctx.fillText(fitTextToWidth(ctx, line, metaWidth), metaX, 194 + index * 28);
  });

  drawMetaLine(
    ctx,
    "Entrega",
    deliveryDetail,
    metaX,
    customerLines.length > 1 ? 254 : 238,
    metaWidth,
  );

  ctx.textAlign = "left";
  drawPaymentPanel(
    ctx,
    formatCurrency(order.total),
    paymentMethod,
    paymentStatus,
    order.paymentState ?? order.paymentStatus,
    PANEL_X,
    360,
    PANEL_WIDTH,
  );

  let cursorY = 532;
  drawSectionHeader(ctx, `Pedido (${itemCount})`, cursorY);
  cursorY += 30;
  drawDivider(ctx, cursorY - 14);

  const renderData = buildTicketRenderLines(sections);
  let hiddenLineCount = renderData.hiddenLineCount;
  let stoppedAt = -1;

  if (!renderData.lines.length) {
    ctx.fillStyle = "#a8c7c2";
    ctx.font = "750 21px 'Fira Sans', Arial, sans-serif";
    ctx.fillText("Sin productos registrados en este ticket.", PANEL_X, cursorY + 24);
  }

  for (let index = 0; index < renderData.lines.length; index += 1) {
    const line = renderData.lines[index];
    const indent = line.kind === "modifier" ? 24 : 0;
    const lineHeight =
      line.kind === "section" ? 22 : line.kind === "item" ? 28 : 24;
    const maxLines = line.kind === "item" ? 2 : 1;

    if (line.kind === "section") {
      cursorY += 8;
      ctx.fillStyle = "#a3e635";
      ctx.font = "900 16px 'Fira Sans', Arial, sans-serif";
    } else if (line.kind === "item") {
      ctx.fillStyle = "#f8fafc";
      ctx.font = "850 22px 'Fira Sans', Arial, sans-serif";
    } else {
      ctx.fillStyle = "#a8c7c2";
      ctx.font = "700 18px 'Fira Sans', Arial, sans-serif";
    }

    const wrapped = wrapText(ctx, line.text, PANEL_WIDTH - indent).slice(0, maxLines);
    const fullWrapped = wrapText(ctx, line.text, PANEL_WIDTH - indent);
    hiddenLineCount += Math.max(0, fullWrapped.length - wrapped.length);

    for (let pieceIndex = 0; pieceIndex < wrapped.length; pieceIndex += 1) {
      if (cursorY + lineHeight > layout.itemListBottomY) {
        stoppedAt = index;
        break;
      }
      ctx.fillText(wrapped[pieceIndex], PANEL_X + indent, cursorY);
      cursorY += lineHeight;
    }

    if (stoppedAt >= 0) break;
    cursorY += line.kind === "section" ? 6 : line.kind === "item" ? 3 : 0;
  }

  if (stoppedAt >= 0) {
    hiddenLineCount += Math.max(1, renderData.lines.length - stoppedAt);
  }

  drawOverflowBadge(ctx, hiddenLineCount, layout);

  ctx.font = "750 19px 'Fira Sans', Arial, sans-serif";
  drawParagraph(
    ctx,
    ORDER_TICKET_RAFFLE_NOTE,
    PANEL_X,
    layout.raffleNoteY,
    PANEL_WIDTH,
    24,
    "#a8c7c2",
    2,
  );

  ctx.textAlign = "center";
  ctx.fillStyle = "#a3e635";
  ctx.font = "900 18px 'Fira Sans', Arial, sans-serif";
  ctx.fillText("Burgers.exe / Ticket manual / Pagos", IMAGE_WIDTH / 2, layout.footerY);

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
