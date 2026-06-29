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
  gradient.addColorStop(0.55, "#0a101f");
  gradient.addColorStop(1, "#111827");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);

  ctx.fillStyle = "rgba(34, 211, 238, 0.07)";
  for (let y = 0; y < IMAGE_HEIGHT; y += 7) {
    ctx.fillRect(0, y, IMAGE_WIDTH, 1);
  }

  drawRoundedRect(
    ctx,
    SAFE_PADDING,
    SAFE_PADDING,
    IMAGE_WIDTH - SAFE_PADDING * 2,
    IMAGE_HEIGHT - SAFE_PADDING * 2,
    34,
  );
  ctx.fillStyle = "rgba(6, 11, 18, 0.96)";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(34, 211, 238, 0.68)";
  ctx.shadowColor = "rgba(34, 211, 238, 0.45)";
  ctx.shadowBlur = 16;
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
  ctx.fillStyle = "#67e8f9";
  ctx.font = "900 20px 'Fira Sans', Arial, sans-serif";
  ctx.fillText("BURGERS.EXE", IMAGE_WIDTH / 2, 105);

  ctx.fillStyle = "#f8fafc";
  ctx.font = "900 40px 'Fira Sans', Arial, sans-serif";
  ctx.fillText(truncate(safeText(order.folio), 24), IMAGE_WIDTH / 2, 154);

  ctx.fillStyle = "#e5e7eb";
  ctx.font = "800 24px 'Fira Sans', Arial, sans-serif";
  ctx.fillText(truncate(safeText(order.customer ?? order.customerName), 34), IMAGE_WIDTH / 2, 194);

  ctx.fillStyle = "#94a3b8";
  ctx.font = "700 16px 'Fira Sans', Arial, sans-serif";
  ctx.fillText(
    `${safeText(order.createdAt, "Sin hora")} - ${truncate(deliveryDetail, 34)}`,
    IMAGE_WIDTH / 2,
    224,
  );

  ctx.textAlign = "left";
  drawMetricCard(ctx, "TOTAL", formatCurrency(order.total), PANEL_X, 266, PANEL_WIDTH);
  drawMetricCard(
    ctx,
    "PAGO",
    `${paymentMethod} - ${paymentStatus}`,
    PANEL_X,
    360,
    PANEL_WIDTH,
  );

  let cursorY = 480;
  drawSectionHeader(ctx, `Pedido (${itemCount})`, cursorY);
  cursorY += 28;
  ctx.fillStyle = "#e5e7eb";
  ctx.font = "700 18px 'Fira Sans', Arial, sans-serif";

  sections.forEach((section) => {
    if (cursorY > 1000) return;
    ctx.fillStyle = "#a7f3d0";
    ctx.font = "900 14px 'Fira Sans', Arial, sans-serif";
    ctx.fillText(section.title.toUpperCase(), PANEL_X, cursorY);
    cursorY += 24;
    ctx.fillStyle = "#e5e7eb";
    ctx.font = "650 17px 'Fira Sans', Arial, sans-serif";
    section.lines.forEach((line) => {
      if (cursorY > 1000) return;
      wrapText(ctx, line, PANEL_WIDTH).slice(0, 2).forEach((piece) => {
        if (cursorY > 1000) return;
        ctx.fillText(piece, PANEL_X, cursorY);
        cursorY += 23;
      });
    });
    cursorY += 14;
  });

  ctx.font = "700 15px 'Fira Sans', Arial, sans-serif";
  drawParagraph(
    ctx,
    ORDER_TICKET_RAFFLE_NOTE,
    PANEL_X,
    1062,
    PANEL_WIDTH,
    19,
    "#94a3b8",
    2,
  );

  ctx.textAlign = "center";
  ctx.fillStyle = "#67e8f9";
  ctx.font = "900 18px 'Fira Sans', Arial, sans-serif";
  ctx.fillText("Burgers.exe", IMAGE_WIDTH / 2, 1132);

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
