import type { CreateOrderV2Payload, CreateOrderV2Response } from '@config/index';

const ORDERS_V2_ENDPOINT = '/api/orders-v2';

export async function createOrderV2(payload: CreateOrderV2Payload, idempotencyKey: string): Promise<CreateOrderV2Response> {
  const response = await fetch(ORDERS_V2_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey
    },
    body: JSON.stringify(payload)
  });

  let envelope: CreateOrderV2Response | null = null;
  try {
    envelope = (await response.json()) as CreateOrderV2Response;
  } catch {
    envelope = null;
  }

  if (!response.ok) {
    const message = envelope?.error?.message || `No se pudo crear el pedido (HTTP ${response.status}). Intenta de nuevo.`;
    throw new Error(envelope?.error?.code === 'ITEM_UNAVAILABLE' ? `ITEM_UNAVAILABLE: ${message}` : message);
  }

  if (!envelope?.ok || !envelope.data?.order) {
    throw new Error(envelope?.error?.message || 'El backend no confirmó el pedido. Intenta de nuevo.');
  }

  return envelope;
}
