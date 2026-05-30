import type { OrdersV2AdminResponse, OrdersV2SummaryResponse, OrderV2PaymentStatus, OrderV2Status, UpdateOrderV2PaymentPayload, UpdateOrderV2PaymentResponse, UpdateOrderV2StatusResponse } from '@config/index';

type FetchOrdersV2AdminOptions = {
  includeTerminal?: boolean;
  limit?: number;
};

export type FetchOrdersV2SummaryOptions = {
  from?: string;
  to?: string;
  includeTerminal?: boolean;
  limit?: number;
  topLimit?: number;
};

type ExportOrdersV2CsvOptions = {
  includeTerminal?: boolean;
  status?: OrderV2Status | '';
  from?: string;
  to?: string;
  limit?: number;
};

const parseJsonEnvelope = async <T extends { ok: boolean; error?: { message?: string; code?: string } }>(res: Response): Promise<T> => {
  let envelope: T | null = null;
  try {
    envelope = (await res.json()) as T;
  } catch {
    // Keep the error generic. Never include request headers or tokens.
  }

  if (!res.ok) {
    const message = envelope?.error?.message || envelope?.error?.code || `HTTP ${res.status}`;
    throw new Error(`Backend V2 rechazó la solicitud: ${message}`);
  }

  if (!envelope) throw new Error('Backend V2 respondió con JSON inválido');
  if (!envelope.ok) throw new Error(envelope.error?.message || envelope.error?.code || 'Backend V2 respondió ok=false');
  return envelope;
};

export const fetchOrdersV2Admin = async (token: string, options: FetchOrdersV2AdminOptions = {}) => {
  const trimmed = token.trim();
  if (!trimmed) throw new Error('Activa modo admin para cargar órdenes live');

  const params = new URLSearchParams();
  params.set('includeTerminal', String(Boolean(options.includeTerminal)));
  if (options.limit) params.set('limit', String(options.limit));

  const res = await fetch(`/api/orders-v2-admin?${params.toString()}`, {
    headers: { Authorization: `Bearer ${trimmed}` }
  });
  const envelope = await parseJsonEnvelope<OrdersV2AdminResponse>(res);
  return envelope.data?.orders ?? [];
};


export const fetchOrdersV2Summary = async (token: string, options: FetchOrdersV2SummaryOptions = {}) => {
  const trimmed = token.trim();
  if (!trimmed) throw new Error('Activa modo admin para cargar cierre');

  const params = new URLSearchParams();
  if (options.from?.trim()) params.set('from', options.from.trim());
  if (options.to?.trim()) params.set('to', options.to.trim());
  if (typeof options.includeTerminal === 'boolean') params.set('includeTerminal', String(options.includeTerminal));
  if (typeof options.limit === 'number' && Number.isFinite(options.limit)) params.set('limit', String(options.limit));
  if (typeof options.topLimit === 'number' && Number.isFinite(options.topLimit)) params.set('topLimit', String(options.topLimit));

  const query = params.toString();
  const res = await fetch(`/api/orders-v2-admin/summary${query ? `?${query}` : ''}`, {
    headers: { Authorization: `Bearer ${trimmed}` }
  });
  const envelope = await parseJsonEnvelope<OrdersV2SummaryResponse>(res);
  if (!envelope.data) throw new Error('Backend V2 no devolvió el cierre operativo');
  return envelope.data;
};

export const updateOrderV2Status = async (token: string, orderId: string, status: OrderV2Status, reason?: string) => {
  const trimmed = token.trim();
  if (!trimmed) throw new Error('Activa modo admin para operar órdenes live');

  const res = await fetch(`/api/orders-v2-admin/${encodeURIComponent(orderId)}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${trimmed}` },
    body: JSON.stringify({ status, reason })
  });
  const envelope = await parseJsonEnvelope<UpdateOrderV2StatusResponse>(res);
  if (!envelope.data?.order) throw new Error('Backend V2 no devolvió la orden actualizada');
  return envelope.data.order;
};


export const updateOrderV2Payment = async (token: string, orderId: string, payload: UpdateOrderV2PaymentPayload) => {
  const trimmed = token.trim();
  if (!trimmed) throw new Error('Activa modo admin para operar pagos live');

  const body: { paymentStatus: OrderV2PaymentStatus; notes?: string; reason?: string } = { paymentStatus: payload.paymentStatus };
  if (typeof payload.notes === 'string') body.notes = payload.notes;
  if (typeof payload.reason === 'string') body.reason = payload.reason;

  const res = await fetch(`/api/orders-v2-admin/${encodeURIComponent(orderId)}/payment`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${trimmed}` },
    body: JSON.stringify(body)
  });
  const envelope = await parseJsonEnvelope<UpdateOrderV2PaymentResponse>(res);
  if (!envelope.data?.order) throw new Error('Backend V2 no devolvió la orden actualizada');
  return envelope.data.order;
};

export const exportOrdersV2Csv = async (token: string, options: ExportOrdersV2CsvOptions = {}) => {
  const trimmed = token.trim();
  if (!trimmed) throw new Error('Activa modo admin para exportar CSV');

  const params = new URLSearchParams();
  if (typeof options.includeTerminal === 'boolean') params.set('includeTerminal', String(options.includeTerminal));
  if (options.status) params.set('status', options.status);
  if (options.from?.trim()) params.set('from', options.from.trim());
  if (options.to?.trim()) params.set('to', options.to.trim());
  if (typeof options.limit === 'number' && Number.isFinite(options.limit)) params.set('limit', String(options.limit));

  const query = params.toString();
  const res = await fetch(`/api/orders-v2-admin/export.csv${query ? `?${query}` : ''}`, {
    headers: { Authorization: `Bearer ${trimmed}` }
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const envelope = (await res.json()) as { error?: { message?: string; code?: string }; message?: string };
      message = envelope.error?.message || envelope.error?.code || envelope.message || message;
    } catch {
      // Keep the error generic. Never include request headers or tokens.
    }
    throw new Error(`No se pudo exportar CSV desde Backend V2: ${message}`);
  }

  return res.blob();
};
