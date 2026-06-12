import { buildWhatsappOrderSummaryLines, type WhatsappOrderMessageInput } from "./whatsapp";

export type OrderTicketImageData = WhatsappOrderMessageInput & {
  createdAt?: string;
  orderStatus?: string;
};

const IMAGE_WIDTH = 1080;
const IMAGE_HEIGHT = 1350;
const SAFE_PADDING = 72;

const formatCurrency = (value?: number) =>
  `$${(Number.isFinite(value) ? value ?? 0 : 0).toFixed(2)}`;

const safeText = (value: string | undefined, fallback = "—") => {
  const trimmed = value?.replace(/\s+/g, " ").trim();
  return trimmed || fallback;
};

const isPreviewOrder = (order: OrderTicketImageData) =>
  order.source === "public-v2-preview";

const truncate = (value: string, maxLength: number) =>
  value.length > maxLength
    ? `${value.slice(0, Math.max(0, maxLength - 1))}…`
    : value;

const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
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

const drawWrapped = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 2,
) => {
  const lines = wrapText(ctx, text, maxWidth).slice(0, maxLines);
  lines.forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight));
  return y + Math.max(1, lines.length) * lineHeight;
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

export const buildOrderTicketSummaryText = (order: OrderTicketImageData) => [
  ...(isPreviewOrder(order) ? ["PEDIDO DE PRUEBA — NO PREPARAR", ""] : []),
  "🍔 Burgers.exe — Ticket operativo",
  `Folio: ${safeText(order.folio)}`,
  `Cliente: ${safeText(order.customer ?? order.customerName)}`,
  `Total: ${formatCurrency(order.total)}`,
  `Pago: ${safeText(order.paymentMethod, "no especificado")}`,
  `Estado de pago: ${safeText(order.paymentState ?? order.paymentStatus, "pendiente")}`,
  "",
  "Resumen:",
  ...buildWhatsappOrderSummaryLines(order),
  "",
  "Descarga este ticket y adjúntalo manualmente si lo envías por WhatsApp.",
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
  gradient.addColorStop(0, "#020617");
  gradient.addColorStop(0.48, "#071915");
  gradient.addColorStop(1, "#111827");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);

  if (isPreviewOrder(order)) {
    ctx.save();
    ctx.translate(IMAGE_WIDTH / 2, IMAGE_HEIGHT / 2);
    ctx.rotate(-0.45);
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(250, 204, 21, 0.16)";
    ctx.font = "900 150px Inter, Arial, sans-serif";
    ctx.fillText("PREVIEW", 0, 0);
    ctx.restore();
  }

  ctx.fillStyle = "rgba(34, 197, 94, 0.16)";
  for (let x = -IMAGE_HEIGHT; x < IMAGE_WIDTH; x += 68) {
    ctx.fillRect(x, 0, 2, IMAGE_HEIGHT * 1.7);
  }

  drawRoundedRect(
    ctx,
    SAFE_PADDING,
    SAFE_PADDING,
    IMAGE_WIDTH - SAFE_PADDING * 2,
    IMAGE_HEIGHT - SAFE_PADDING * 2,
    44,
  );
  ctx.fillStyle = "rgba(8, 13, 16, 0.94)";
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(52, 211, 153, 0.8)";
  ctx.shadowColor = "rgba(52, 211, 153, 0.7)";
  ctx.shadowBlur = 24;
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.textAlign = "center";
  ctx.fillStyle = "#34d399";
  ctx.font = "900 58px Inter, Arial, sans-serif";
  ctx.fillText("Burgers.exe", IMAGE_WIDTH / 2, 172);
  if (isPreviewOrder(order)) {
    ctx.fillStyle = "#facc15";
    ctx.font = "900 30px Inter, Arial, sans-serif";
    ctx.fillText("PEDIDO DE PRUEBA — NO PREPARAR", IMAGE_WIDTH / 2, 218);
  }
  ctx.fillStyle = "#facc15";
  ctx.font = "900 72px Inter, Arial, sans-serif";
  ctx.fillText(safeText(order.folio), IMAGE_WIDTH / 2, isPreviewOrder(order) ? 296 : 262);
  ctx.fillStyle = "#e5e7eb";
  ctx.font = "700 32px Inter, Arial, sans-serif";
  ctx.fillText(
    truncate(safeText(order.customer ?? order.customerName), 38),
    IMAGE_WIDTH / 2,
    isPreviewOrder(order) ? 348 : 318,
  );

  const panelX = 126;
  const panelWidth = IMAGE_WIDTH - panelX * 2;
  drawRoundedRect(ctx, panelX, 366, panelWidth, 178, 28);
  ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
  ctx.fill();
  ctx.strokeStyle = "rgba(250, 204, 21, 0.5)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.textAlign = "left";
  ctx.fillStyle = "#facc15";
  ctx.font = "900 52px Inter, Arial, sans-serif";
  ctx.fillText(formatCurrency(order.total), panelX + 34, 442);
  ctx.fillStyle = "#d1d5db";
  ctx.font = "700 28px Inter, Arial, sans-serif";
  ctx.fillText(
    `Pago: ${safeText(order.paymentMethod, "no especificado")}`,
    panelX + 34,
    492,
  );
  ctx.fillText(
    `Estado: ${safeText(order.paymentState ?? order.paymentStatus, "pendiente")}`,
    panelX + 34,
    526,
  );

  ctx.fillStyle = "#67e8f9";
  ctx.font = "900 30px Inter, Arial, sans-serif";
  ctx.fillText("RESUMEN DE ITEMS", panelX, 608);

  ctx.fillStyle = "#e5e7eb";
  ctx.font = "700 28px Inter, Arial, sans-serif";
  let cursorY = 656;
  const lines = buildWhatsappOrderSummaryLines(order).flatMap((line) =>
    wrapText(ctx, line, panelWidth).slice(0, 2),
  );
  for (const line of lines.slice(0, 18)) {
    ctx.fillText(truncate(line, 58), panelX, cursorY);
    cursorY += 36;
  }
  if (lines.length > 18) {
    ctx.fillStyle = "#9ca3af";
    ctx.fillText(`+ ${lines.length - 18} líneas más en Chekeo`, panelX, cursorY + 8);
  }

  ctx.textAlign = "center";
  ctx.fillStyle = "#34d399";
  ctx.font = "900 28px Inter, Arial, sans-serif";
  ctx.fillText("Ticket PNG para handoff manual", IMAGE_WIDTH / 2, 1194);
  ctx.fillStyle = "#9ca3af";
  ctx.font = "600 24px Inter, Arial, sans-serif";
  drawWrapped(
    ctx,
    "WhatsApp con wa.me solo abre texto; descarga la imagen y adjúntala manualmente si hace falta.",
    IMAGE_WIDTH / 2,
    1240,
    panelWidth,
    32,
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
