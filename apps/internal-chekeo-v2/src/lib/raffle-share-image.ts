export type RaffleShareImageData = {
  customerName: string;
  customerPhoneMasked: string;
  campaignTitle: string;
  baseTickets: number;
  manualExtraTickets: number;
  burgerTickets: number;
  referralTickets: number;
  totalTickets: number;
  lastOrderFolio?: string;
  lastOrderAt?: string;
  referralCodeText: string;
  generatedAt: Date;
  rulesText?: string;
};

export const RAFFLE_SHARE_FALLBACK_CODE = "solicita tu código en Burgers.exe";

const IMAGE_WIDTH = 1080;
const IMAGE_HEIGHT = 1350;
const SAFE_PADDING = 80;

const formatDateTime = (date: Date) => (Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" }));

const safeText = (value: string | undefined, fallback = "—") => {
  const trimmed = value?.replace(/\s+/g, " ").trim();
  return trimmed || fallback;
};

const truncate = (value: string, maxLength: number) => (value.length > maxLength ? `${value.slice(0, Math.max(0, maxLength - 1))}…` : value);

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

const drawRoundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) => {
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

const drawCard = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius = 34) => {
  drawRoundedRect(ctx, x, y, width, height, radius);
  ctx.fillStyle = "rgba(12, 16, 18, 0.94)";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(52, 211, 153, 0.62)";
  ctx.stroke();
};

const drawCenteredWrappedText = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines = 2) => {
  const lines = wrapText(ctx, text, maxWidth).slice(0, maxLines);
  lines.forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight));
  return y + lines.length * lineHeight;
};

const canvasToBlob = (canvas: HTMLCanvasElement) => new Promise<Blob>((resolve, reject) => {
  canvas.toBlob((blob) => {
    if (blob) resolve(blob);
    else reject(new Error("No se pudo generar el PNG del sorteo."));
  }, "image/png", 0.96);
});

export const buildRaffleShareText = (data: RaffleShareImageData): string => [
  "🍔 Burgers.exe",
  "Tus tickets del sorteo:",
  "",
  `Nombre: ${safeText(data.customerName)}`,
  `Base tickets: ${data.baseTickets}`,
  `Tickets extra manuales: ${data.manualExtraTickets}`,
  `Total tickets: ${data.totalTickets}`,
  `Burger tickets: ${data.burgerTickets}`,
  `Referidos: ${data.referralTickets}`,
  `Código: ${safeText(data.referralCodeText, RAFFLE_SHARE_FALLBACK_CODE)}`,
  "",
  "Guarda esta imagen. Tickets sujetos a validación final.",
].join("\n");

export const buildWhatsAppUrl = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;

export const generateRaffleTicketImage = async (data: RaffleShareImageData): Promise<Blob> => {
  const canvas = document.createElement("canvas");
  canvas.width = IMAGE_WIDTH;
  canvas.height = IMAGE_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas no está disponible en este navegador.");

  const gradient = ctx.createLinearGradient(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);
  gradient.addColorStop(0, "#020617");
  gradient.addColorStop(0.42, "#050505");
  gradient.addColorStop(1, "#06130d");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);

  ctx.save();
  ctx.globalAlpha = 0.2;
  ctx.strokeStyle = "#34d399";
  ctx.lineWidth = 1;
  for (let x = -160; x < IMAGE_WIDTH; x += 72) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 540, IMAGE_HEIGHT);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.shadowColor = "rgba(16, 185, 129, 0.34)";
  ctx.shadowBlur = 36;
  drawCard(ctx, 46, 46, IMAGE_WIDTH - 92, IMAGE_HEIGHT - 92, 46);
  ctx.restore();

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#34d399";
  ctx.font = "900 58px Inter, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  ctx.fillText("BURGERS.EXE", IMAGE_WIDTH / 2, 150);
  ctx.fillStyle = "#cbd5e1";
  ctx.font = "700 30px Inter, system-ui, sans-serif";
  ctx.fillText("Sorteo mensual", IMAGE_WIDTH / 2, 198);

  ctx.fillStyle = "#f8fafc";
  ctx.font = "900 54px Inter, system-ui, sans-serif";
  drawCenteredWrappedText(ctx, truncate(safeText(data.customerName), 44), IMAGE_WIDTH / 2, 305, IMAGE_WIDTH - SAFE_PADDING * 2, 58, 2);
  ctx.fillStyle = "#94a3b8";
  ctx.font = "700 28px Inter, system-ui, sans-serif";
  ctx.fillText(`Teléfono: ${safeText(data.customerPhoneMasked)}`, IMAGE_WIDTH / 2, 400);
  ctx.fillText(`Campaña: ${truncate(safeText(data.campaignTitle, "Sorteo mensual"), 48)}`, IMAGE_WIDTH / 2, 445);

  drawCard(ctx, 120, 500, IMAGE_WIDTH - 240, 280, 42);
  ctx.fillStyle = "#a7f3d0";
  ctx.font = "900 42px Inter, system-ui, sans-serif";
  ctx.fillText("TOTAL TICKETS", IMAGE_WIDTH / 2, 582);
  ctx.fillStyle = "#34d399";
  ctx.font = "900 138px Inter, system-ui, sans-serif";
  ctx.fillText(String(data.totalTickets), IMAGE_WIDTH / 2, 720);

  const statY = 835;
  drawCard(ctx, 92, statY, 420, 145, 30);
  drawCard(ctx, 568, statY, 420, 145, 30);
  ctx.fillStyle = "#e2e8f0";
  ctx.font = "800 28px Inter, system-ui, sans-serif";
  ctx.fillText("Burger tickets", 302, statY + 54);
  ctx.fillText("Referidos", 778, statY + 54);
  ctx.fillStyle = "#f8fafc";
  ctx.font = "900 56px Inter, system-ui, sans-serif";
  ctx.fillText(String(data.burgerTickets), 302, statY + 115);
  ctx.fillText(String(data.referralTickets), 778, statY + 115);

  drawCard(ctx, 92, 1030, IMAGE_WIDTH - 184, 124, 30);
  ctx.fillStyle = "#94a3b8";
  ctx.font = "800 26px Inter, system-ui, sans-serif";
  ctx.fillText("Código de invitado", IMAGE_WIDTH / 2, 1078);
  ctx.fillStyle = data.referralCodeText === RAFFLE_SHARE_FALLBACK_CODE ? "#fbbf24" : "#67e8f9";
  ctx.font = "900 42px Inter, system-ui, sans-serif";
  ctx.fillText(truncate(safeText(data.referralCodeText, RAFFLE_SHARE_FALLBACK_CODE), 38), IMAGE_WIDTH / 2, 1128);

  ctx.fillStyle = "#d1fae5";
  ctx.font = "800 30px Inter, system-ui, sans-serif";
  ctx.fillText("1 ticket por burger · 2 tickets por referido válido", IMAGE_WIDTH / 2, 1212);
  ctx.fillStyle = "#94a3b8";
  ctx.font = "700 24px Inter, system-ui, sans-serif";
  ctx.fillText(`Generado: ${formatDateTime(data.generatedAt)}`, IMAGE_WIDTH / 2, 1255);
  ctx.fillText(truncate(`Último folio: ${safeText(data.lastOrderFolio)} · Último pedido: ${safeText(data.lastOrderAt ? formatDateTime(new Date(data.lastOrderAt)) : "")}`, 72), IMAGE_WIDTH / 2, 1290);
  ctx.fillStyle = "#e5e7eb";
  ctx.font = "900 24px Inter, system-ui, sans-serif";
  ctx.fillText("Guarda esta imagen. Tickets sujetos a validación final.", IMAGE_WIDTH / 2, 1324);

  return canvasToBlob(canvas);
};

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
};

export const shareBlobIfSupported = async (blob: Blob, text: string): Promise<boolean> => {
  if (!("share" in navigator)) return false;
  const file = new File([blob], "burgers-exe-tickets.png", { type: "image/png" });
  const shareData: ShareData = { files: [file], text, title: "Burgers.exe tickets" };
  if ("canShare" in navigator && typeof navigator.canShare === "function" && !navigator.canShare(shareData)) return false;
  await navigator.share(shareData);
  return true;
};
