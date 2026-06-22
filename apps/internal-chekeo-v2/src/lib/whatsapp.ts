export type WhatsappOrderMessageType = 'received' | 'preparing' | 'ready' | 'delivered' | 'custom';

export type WhatsappOrderItemInput = {
  name: string;
  qty: number;
  price?: number;
  lineTotal?: number;
  extras?: Array<{ name: string; price?: number }>;
  removedIngredients?: string[];
  garnish?: { name: string } | null;
  burgerNote?: string;
  note?: string;
};

export type WhatsappOrderMessageInput = {
  customer?: string;
  customerName?: string;
  folio?: string;
  paymentMethod?: string;
  paymentState?: string;
  paymentStatus?: string;
  total?: number;
  items?: WhatsappOrderItemInput[];
  note?: string;
  source?: string;
  orderStatus?: string;
  deliveryDetail?: string;
  bankDetails?: WhatsappBankDetails | null;
};

export type WhatsappBankDetails = {
  bankName?: string;
  accountHolder?: string;
  accountNumber?: string;
  clabe?: string;
  reference?: string;
};

const formatWhatsappCurrency = (value?: number) => `$${(Number.isFinite(value) ? value ?? 0 : 0).toFixed(2)}`;

const safeText = (value: string | undefined, fallback = '-') => {
  const trimmed = value?.replace(/\s+/g, ' ').trim();
  return trimmed || fallback;
};

const getCustomerName = (order: WhatsappOrderMessageInput) => order.customer?.trim() || order.customerName?.trim() || 'cliente';
const getFolio = (order: WhatsappOrderMessageInput) => order.folio?.trim() || 'tu pedido';
const getPaymentMethod = (order: WhatsappOrderMessageInput) => order.paymentMethod?.trim() || 'no especificado';
const getPaymentStatus = (order: WhatsappOrderMessageInput) => order.paymentState?.trim() || order.paymentStatus?.trim() || 'pendiente';
const isTransferPaymentMethod = (paymentMethod?: string) => {
  const normalized = paymentMethod?.trim().toLowerCase();
  return normalized === 'transfer' || normalized === 'transferencia' || normalized === 'spei';
};
const paymentMethodMessageLabel: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
  transferencia: 'Transferencia',
  spei: 'Transferencia',
  unknown: 'Por confirmar',
};
const paymentStatusMessageLabel: Record<string, string> = {
  pending: 'Pago pendiente',
  paid: 'Pago confirmado',
  cancelled: 'Pago cancelado',
};

const getPaymentMethodMessageLabel = (paymentMethod?: string) => {
  const normalized = paymentMethod?.trim().toLowerCase() || 'unknown';
  return paymentMethodMessageLabel[normalized] || safeText(paymentMethod, 'Por confirmar');
};

const getPaymentStatusMessageLabel = (paymentStatus?: string) => {
  const normalized = paymentStatus?.trim().toLowerCase() || 'pending';
  return paymentStatusMessageLabel[normalized] || safeText(paymentStatus, 'Pago pendiente');
};

const hasBankDetails = (bankDetails?: WhatsappBankDetails | null) =>
  Boolean(
    bankDetails?.bankName ||
      bankDetails?.accountHolder ||
      bankDetails?.accountNumber ||
      bankDetails?.clabe ||
      bankDetails?.reference,
  );

const buildBankDetailLines = (bankDetails?: WhatsappBankDetails | null) => {
  if (!hasBankDetails(bankDetails)) {
    return [];
  }

  const lines = ['Datos bancarios:'];
  if (bankDetails?.bankName) lines.push(`Banco: ${safeText(bankDetails.bankName)}`);
  if (bankDetails?.accountHolder) lines.push(`Titular: ${safeText(bankDetails.accountHolder)}`);
  const accountNumber = bankDetails?.accountNumber?.trim();
  const clabe = bankDetails?.clabe?.trim();
  if (accountNumber && clabe && accountNumber === clabe) {
    lines.push(`Cuenta / CLABE: ${safeText(clabe)}`);
  } else {
    if (accountNumber) lines.push(`Cuenta: ${safeText(accountNumber)}`);
    if (clabe) lines.push(`CLABE: ${safeText(clabe)}`);
  }
  if (bankDetails?.reference) lines.push(`Referencia: ${safeText(bankDetails.reference)}`);
  return lines;
};

const buildItemModifierText = (item: WhatsappOrderItemInput): string[] => {
  const modifiers: string[] = [];
  if (item.extras?.length) {
    modifiers.push(`Extras: ${item.extras.map((extra) => safeText(extra.name)).join(', ')}`);
  }
  if (item.removedIngredients?.length) {
    modifiers.push(`Sin: ${item.removedIngredients.map((ingredient) => safeText(ingredient)).join(', ')}`);
  }
  if (item.garnish?.name) modifiers.push(`Guarnición: ${safeText(item.garnish.name)}`);
  const note = safeText(item.burgerNote ?? item.note, '');
  if (note) modifiers.push(`Nota: ${note}`);
  return modifiers;
};

export const buildWhatsappOrderSummaryLines = (order: WhatsappOrderMessageInput): string[] => {
  if (!order.items?.length) return ['• Resumen no disponible en Chekeo.'];
  return order.items.flatMap((item, index) => {
    const itemTotal = item.lineTotal ?? (Number.isFinite(item.price) ? (item.price ?? 0) * item.qty : undefined);
    const baseLine = `• ${item.qty}x ${safeText(item.name, `Producto ${index + 1}`)}${itemTotal !== undefined ? ` — ${formatWhatsappCurrency(itemTotal)}` : ''}`;
    const modifiers = buildItemModifierText(item).map((modifier) => `  - ${modifier}`);
    return [baseLine, ...modifiers];
  });
};

export const buildWhatsappOrderMessage = (
  order: WhatsappOrderMessageInput,
  type: WhatsappOrderMessageType,
  customMessage = ''
): string => {
  if (type === 'custom') return customMessage.trim();

  const name = getCustomerName(order);
  const folio = getFolio(order);
  const total = formatWhatsappCurrency(order.total);
  const paymentMethod = getPaymentMethodMessageLabel(getPaymentMethod(order));
  const paymentStatus = getPaymentStatusMessageLabel(getPaymentStatus(order));
  const deliveryDetail = safeText(order.deliveryDetail, 'Entrega por confirmar');
  const note = safeText(order.note, '');

  return [
    `Hola ${name},`,
    '',
    'Tu pedido Burgers.exe queda asi:',
    `Folio: ${folio}`,
    `Total: ${total}`,
    `Entrega: ${deliveryDetail}`,
    `Pago: ${paymentMethod} (${paymentStatus})`,
    '',
    'Resumen del pedido:',
    ...buildWhatsappOrderSummaryLines(order),
    ...(isTransferPaymentMethod(order.paymentMethod)
      ? ['', ...buildBankDetailLines(order.bankDetails)]
      : []),
    ...(note ? ['', `Notas: ${note}`] : []),
    '',
    'Gracias por pedir en Burgers.exe.',
  ].join('\n');
};

export const buildWhatsappOrderConfirmationMessage = (
  order: WhatsappOrderMessageInput,
): string => {
  const name = getCustomerName(order);
  const total = formatWhatsappCurrency(order.total);
  return `Hola ${name}. Tu pedido en Burgers.exe quedó registrado. Total a pagar: ${total}.`;
};

export const buildWhatsappPaymentMessage = (
  order: WhatsappOrderMessageInput,
): string => {
  const name = getCustomerName(order);
  const folio = getFolio(order);
  const total = formatWhatsappCurrency(order.total);
  const paymentMethod = getPaymentMethodMessageLabel(order.paymentMethod);
  const paymentStatus = getPaymentStatusMessageLabel(getPaymentStatus(order));
  const deliveryDetail = safeText(order.deliveryDetail, 'Sin detalle de entrega');
  const note = safeText(order.note, '');
  const summaryLines = buildWhatsappOrderSummaryLines(order);

  return [
    `Burgers.exe | ${paymentStatus}`,
    '',
    `Hola ${name},`,
    '',
    `Folio: ${folio}`,
    `Total: ${total}`,
    `Metodo de pago: ${paymentMethod}`,
    `Estado de pago: ${paymentStatus}`,
    `Detalle de entrega: ${deliveryDetail}`,
    '',
    'Resumen del pedido:',
    ...summaryLines,
    ...(isTransferPaymentMethod(order.paymentMethod)
      ? ['', ...buildBankDetailLines(order.bankDetails)]
      : []),
    ...(note ? ['', `Notas: ${note}`] : []),
    '',
    'Si ya realizaste el pago, comparte tu comprobante por este medio.',
  ].join('\n');
};

export const normalizeWhatsappPhone = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `52${digits}`;
  if (digits.startsWith('52') && digits.length === 12) return digits;
  return '';
};

export const buildWhatsappUrl = (phone: string, message: string): string => `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
