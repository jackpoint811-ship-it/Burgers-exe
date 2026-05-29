import type { OrdersV2AdminResponse, OrderV2Status, UpdateOrderV2StatusResponse } from '@config/index';

type FetchOrdersV2AdminOptions = {
  includeTerminal?: boolean;
  limit?: number;
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
