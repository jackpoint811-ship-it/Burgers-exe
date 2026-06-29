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

const IMAGE_WIDTH = 800;
const IMAGE_HEIGHT = 1200;
const SAFE_PADDING = 48;
const PANEL_X = SAFE_PADDING + 24;
const PANEL_WIDTH = IMAGE_WIDTH - PANEL_X * 2;
const PANEL_RIGHT = PANEL_X + PANEL_WIDTH;
const ITEM_LIST_BOTTOM_Y = 1008;
const OVERFLOW_BADGE_Y = 1018;
const RAFFLE_NOTE_Y = 1060;
const FOOTER_Y = 1134;
const MAX_LINES_PER_ITEM = 4;

type TicketSection = {
  title: string;
  items: string[][];
};

type TicketRenderLine = {
  text: string;
  kind: "section" | "item" | "modifier";
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

const drawMetricCardLines = (
  ctx: CanvasRenderingContext2D,
  label: string,
  lines: string[],
  x: number,
  y: number,
  width: number,
  height: number,
) => {
  drawRoundedRect(ctx, x, y, width, height, 18);
  ctx.fillStyle = "rgba(10, 18, 24, 0.92)";
  ctx.fill();
  ctx.strokeStyle = "rgba(132, 204, 22, 0.26)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#8bd7d2";
  ctx.font = "900 14px 'Fira Sans', Arial, sans-serif";
  ctx.fillText(label, x + 18, y + 24);

  ctx.fillStyle = "#f8fafc";
  ctx.font = "900 25px 'Fira Sans', Arial, sans-serif";
  const maxTextWidth = width - 36;
  const wrappedLines = lines.flatMap((line) =>
    wrapText(ctx, line, maxTextWidth),
  );
  const visibleLines = wrappedLines.slice(0, Math.max(1, Math.floor((height - 38) / 26)));
  visibleLines.forEach((line, index) => {
    const isLastHiddenLine =
      index === visibleLines.length - 1 && wrappedLines.length > visibleLines.length;
    const text = isLastHiddenLine
      ? fitTextToWidth(ctx, `${line}...`, maxTextWidth)
      : fitTextToWidth(ctx, line, maxTextWidth);
    ctx.fillText(text, x + 18, y + 55 + index * 26);
  });
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
) => {
  if (hiddenLineCount <= 0) return;
  const label = `+ ${hiddenLineCount} líneas más en Chekeo`;
  drawRoundedRect(ctx, PANEL_X, OVERFLOW_BADGE_Y, PANEL_WIDTH, 30, 12);
  ctx.fillStyle = "rgba(250, 204, 21, 0.11)";
  ctx.fill();
  ctx.strokeStyle = "rgba(250, 204, 21, 0.32)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = "#facc15";
  ctx.font = "900 14px 'Fira Sans', Arial, sans-serif";
  ctx.fillText(label, PANEL_X + 14, OVERFLOW_BADGE_Y + 20);
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
  const canvas = document.createElement("canvas");
  canvas.width = IMAGE_WIDTH;
  canvas.height = IMAGE_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas no esta disponible en este navegador.");

  const gradient = ctx.createLinearGradient(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);
  gradient.addColorStop(0, "#050816");
  gradient.addColorStop(0.58, "#08121a");
  gradient.addColorStop(1, "#05070d");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);

  ctx.fillStyle = "rgba(34, 211, 238, 0.045)";
  for (let y = 0; y < IMAGE_HEIGHT; y += 7) {
    ctx.fillRect(0, y, IMAGE_WIDTH, 1);
  }

  if (isPreviewOrder(order)) {
    ctx.save();
    ctx.translate(IMAGE_WIDTH / 2, 594);
    ctx.rotate(-0.32);
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(250, 204, 21, 0.09)";
    ctx.font = "900 86px 'Fira Sans', Arial, sans-serif";
    ctx.fillText("PEDIDO DE PRUEBA", 0, 0);
    ctx.restore();
  }

  drawRoundedRect(
    ctx,
    SAFE_PADDING,
    SAFE_PADDING,
    IMAGE_WIDTH - SAFE_PADDING * 2,
    IMAGE_HEIGHT - SAFE_PADDING * 2,
    34,
  );
  ctx.fillStyle = "rgba(5, 10, 14, 0.96)";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(132, 204, 22, 0.62)";
  ctx.shadowColor = "rgba(132, 204, 22, 0.34)";
  ctx.shadowBlur = 14;
  ctx.stroke();
  ctx.shadowBlur = 0;

  const deliveryDetail = safeText(order.deliveryDetail, extractLocation(order.note));
  const paymentMethod = getPaymentMethodImageLabel(order.paymentMethod);
  const paymentStatus = getPaymentStatusImageLabel(
    order.paymentState ?? order.paymentStatus,
  );
  const sections = buildTicketSections(order);
  const itemCount = getTicketItems(order).reduce((total, item) => total + item.qty, 0);

  ctx.textAlign = "center";
  ctx.fillStyle = "#a3e635";
  ctx.font = "900 20px 'Fira Sans', Arial, sans-serif";
  ctx.fillText("BURGERS.EXE", IMAGE_WIDTH / 2, 105);

  if (isPreviewOrder(order)) {
    drawRoundedRect(ctx, IMAGE_WIDTH / 2 - 112, 120, 224, 28, 12);
    ctx.fillStyle = "rgba(250, 204, 21, 0.12)";
    ctx.fill();
    ctx.strokeStyle = "rgba(250, 204, 21, 0.38)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = "#facc15";
    ctx.font = "900 13px 'Fira Sans', Arial, sans-serif";
    ctx.fillText("PEDIDO DE PRUEBA", IMAGE_WIDTH / 2, 139);
  }

  ctx.fillStyle = "#f8fafc";
  ctx.font = "900 40px 'Fira Sans', Arial, sans-serif";
  ctx.fillText(
    fitTextToWidth(ctx, safeText(order.folio), PANEL_WIDTH, "middle"),
    IMAGE_WIDTH / 2,
    isPreviewOrder(order) ? 178 : 154,
  );

  ctx.fillStyle = "#e5e7eb";
  ctx.font = "800 24px 'Fira Sans', Arial, sans-serif";
  const customerLines = wrapText(
    ctx,
    safeText(order.customer ?? order.customerName),
    PANEL_WIDTH,
  ).slice(0, 2);
  customerLines.forEach((line, index) => {
    const y = (isPreviewOrder(order) ? 214 : 194) + index * 28;
    ctx.fillText(fitTextToWidth(ctx, line, PANEL_WIDTH), IMAGE_WIDTH / 2, y);
  });

  ctx.fillStyle = "#94a3b8";
  ctx.font = "700 16px 'Fira Sans', Arial, sans-serif";
  ctx.fillText(
    fitTextToWidth(
      ctx,
      `${safeText(order.createdAt, "Sin hora")} - ${deliveryDetail}`,
      PANEL_WIDTH,
    ),
    IMAGE_WIDTH / 2,
    isPreviewOrder(order) ? 272 : customerLines.length > 1 ? 236 : 224,
  );

  ctx.textAlign = "left";
  drawMetricCardLines(ctx, "TOTAL", [formatCurrency(order.total)], PANEL_X, 286, PANEL_WIDTH, 74);
  drawMetricCardLines(
    ctx,
    "PAGO",
    [`Metodo: ${paymentMethod}`, `Estado: ${paymentStatus}`],
    PANEL_X,
    372,
    PANEL_WIDTH,
    96,
  );

  let cursorY = 502;
  drawSectionHeader(ctx, `Pedido (${itemCount})`, cursorY);
  cursorY += 28;
  ctx.strokeStyle = "rgba(132, 204, 22, 0.22)";
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 8]);
  ctx.beginPath();
  ctx.moveTo(PANEL_X, cursorY - 13);
  ctx.lineTo(PANEL_RIGHT, cursorY - 13);
  ctx.stroke();
  ctx.setLineDash([]);

  const renderData = buildTicketRenderLines(sections);
  let hiddenLineCount = renderData.hiddenLineCount;
  let stoppedAt = -1;

  for (let index = 0; index < renderData.lines.length; index += 1) {
    const line = renderData.lines[index];
    const indent = line.kind === "modifier" ? 18 : 0;
    const lineHeight =
      line.kind === "section" ? 20 : line.kind === "item" ? 23 : 20;
    const maxLines = line.kind === "item" ? 2 : 1;

    if (line.kind === "section") {
      cursorY += 5;
      ctx.fillStyle = "#a3e635";
      ctx.font = "900 14px 'Fira Sans', Arial, sans-serif";
    } else if (line.kind === "item") {
      ctx.fillStyle = "#f8fafc";
      ctx.font = "750 17px 'Fira Sans', Arial, sans-serif";
    } else {
      ctx.fillStyle = "#a8c7c2";
      ctx.font = "650 15px 'Fira Sans', Arial, sans-serif";
    }

    const wrapped = wrapText(ctx, line.text, PANEL_WIDTH - indent).slice(0, maxLines);
    const fullWrapped = wrapText(ctx, line.text, PANEL_WIDTH - indent);
    hiddenLineCount += Math.max(0, fullWrapped.length - wrapped.length);

    for (let pieceIndex = 0; pieceIndex < wrapped.length; pieceIndex += 1) {
      if (cursorY + lineHeight > ITEM_LIST_BOTTOM_Y) {
        stoppedAt = index;
        break;
      }
      ctx.fillText(wrapped[pieceIndex], PANEL_X + indent, cursorY);
      cursorY += lineHeight;
    }

    if (stoppedAt >= 0) break;
    cursorY += line.kind === "section" ? 4 : line.kind === "item" ? 2 : 0;
  }

  if (stoppedAt >= 0) {
    hiddenLineCount += Math.max(1, renderData.lines.length - stoppedAt);
  }

  drawOverflowBadge(ctx, hiddenLineCount);

  ctx.font = "700 15px 'Fira Sans', Arial, sans-serif";
  drawParagraph(
    ctx,
    ORDER_TICKET_RAFFLE_NOTE,
    PANEL_X,
    RAFFLE_NOTE_Y,
    PANEL_WIDTH,
    19,
    "#a8c7c2",
    2,
  );

  ctx.textAlign = "center";
  ctx.fillStyle = "#a3e635";
  ctx.font = "900 18px 'Fira Sans', Arial, sans-serif";
  ctx.fillText("Burgers.exe", IMAGE_WIDTH / 2, FOOTER_Y);

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
