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
};

const formatWhatsappCurrency = (value?: number) => `$${(Number.isFinite(value) ? value ?? 0 : 0).toFixed(2)}`;

const safeText = (value: string | undefined, fallback = '—') => {
  const trimmed = value?.replace(/\s+/g, ' ').trim();
  return trimmed || fallback;
};

const getCustomerName = (order: WhatsappOrderMessageInput) => order.customer?.trim() || order.customerName?.trim() || 'cliente';
const getFolio = (order: WhatsappOrderMessageInput) => order.folio?.trim() || 'tu pedido';
const getPaymentMethod = (order: WhatsappOrderMessageInput) => order.paymentMethod?.trim() || 'no especificado';
const getPaymentStatus = (order: WhatsappOrderMessageInput) => order.paymentState?.trim() || order.paymentStatus?.trim() || 'pendiente';

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
  const paymentMethod = getPaymentMethod(order);
  const paymentStatus = getPaymentStatus(order);
  const statusLine =
    type === 'preparing'
      ? 'Tu quest ya está en preparación.'
      : type === 'ready'
        ? 'Tu loot ya está listo para recoger/entregar.'
        : type === 'delivered'
          ? 'Marcamos tu pedido como entregado. ¡Gracias por jugar con nosotros!'
          : 'Recibimos tu pedido y lo dejamos listo para operación.';
  const note = safeText(order.note, '');

  return [
    `🍔 Burgers.exe — ${statusLine}`,
    '',
    `Folio: ${folio}`,
    `Cliente: ${name}`,
    `Total: ${total}`,
    `Pago: ${paymentMethod}`,
    `Estado de pago: ${paymentStatus}`,
    '',
    'Resumen del pedido:',
    ...buildWhatsappOrderSummaryLines(order),
    ...(note ? ['', `Notas: ${note}`] : []),
    '',
    'Nota Burgers.exe: WhatsApp abre este texto; si hay ticket PNG, descárgalo y adjúntalo manualmente.',
  ].join('\n');
};

export const normalizeWhatsappPhone = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `52${digits}`;
  if (digits.startsWith('52') && digits.length === 12) return digits;
  return '';
};

export const buildWhatsappUrl = (phone: string, message: string): string => `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
