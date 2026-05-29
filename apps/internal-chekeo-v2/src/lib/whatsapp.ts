export type WhatsappOrderMessageType = 'received' | 'preparing' | 'ready' | 'delivered' | 'custom';

export type WhatsappOrderMessageInput = {
  customer?: string;
  customerName?: string;
  folio?: string;
  paymentMethod?: string;
  total?: number;
};

const formatWhatsappCurrency = (value?: number) => `$${(Number.isFinite(value) ? value ?? 0 : 0).toFixed(2)}`;

const getCustomerName = (order: WhatsappOrderMessageInput) => order.customer?.trim() || order.customerName?.trim() || 'cliente';
const getFolio = (order: WhatsappOrderMessageInput) => order.folio?.trim() || 'tu pedido';
const getPaymentMethod = (order: WhatsappOrderMessageInput) => order.paymentMethod?.trim() || 'no especificado';

export const normalizeWhatsappPhone = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `52${digits}`;
  if (digits.startsWith('52') && digits.length === 12) return digits;
  return '';
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

  if (type === 'preparing') return `Hola ${name}, tu pedido ${folio} ya está en preparación 🍔.`;
  if (type === 'ready') return `Hola ${name}, tu pedido ${folio} ya está listo para recoger/entregar. Total: ${total}.`;
  if (type === 'delivered') return `Hola ${name}, marcamos tu pedido ${folio} como entregado. ¡Gracias por pedir en Burgers.exe! 🍔`;

  return `Hola ${name}, recibimos tu pedido ${folio} de Burgers.exe. Total: ${total}. Pago declarado: ${paymentMethod}. Te avisamos cuando esté listo.`;
};

export const buildWhatsappUrl = (phone: string, message: string): string => `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
