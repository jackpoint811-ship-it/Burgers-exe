import type {
  OrdersV2AdminResponse,
  ArchiveOrderV2Response,
  OrdersV2SummaryResponse,
  OrderV2Environment,
  OrderV2PaymentStatus,
  OrderV2Status,
  UpdateKitchenItemPayload,
  UpdateKitchenItemResponse,
  UpdateOrderV2PaymentPayload,
  UpdateOrderV2PaymentResponse,
  UpdateOrderV2StatusResponse,
} from "@config/index";

type FetchOrdersV2AdminOptions = {
  includeTerminal?: boolean;
  limit?: number;
  environment?: OrderV2Environment;
};

export type FetchOrdersV2SummaryOptions = {
  from?: string;
  to?: string;
  includeTerminal?: boolean;
  limit?: number;
  topLimit?: number;
  environment?: OrderV2Environment;
};

type ExportOrdersV2CsvOptions = {
  includeTerminal?: boolean;
  status?: OrderV2Status | "";
  from?: string;
  to?: string;
  limit?: number;
  environment?: OrderV2Environment;
};


const buildSessionFetchInit = (init: RequestInit = {}): RequestInit => ({
  ...init,
  credentials: 'include',
});

const parseJsonEnvelope = async <
  T extends { ok: boolean; error?: { message?: string; code?: string } },
>(
  res: Response,
): Promise<T> => {
  let envelope: T | null = null;
  try {
    envelope = (await res.json()) as T;
  } catch {
    // Keep the error generic. Never include request headers or session details.
  }

  if (!res.ok) {
    const message =
      envelope?.error?.message || envelope?.error?.code || `HTTP ${res.status}`;
    throw new Error(`Backend V2 rechazó la solicitud: ${message}`);
  }

  if (!envelope) throw new Error("Backend V2 respondió con JSON inválido");
  if (!envelope.ok)
    throw new Error(
      envelope.error?.message ||
        envelope.error?.code ||
        "Backend V2 respondió ok=false",
    );
  return envelope;
};

export const fetchOrdersV2Admin = async (
  options: FetchOrdersV2AdminOptions = {},
) => {

  const params = new URLSearchParams();
  params.set("environment", options.environment ?? "production");
  params.set("includeTerminal", String(Boolean(options.includeTerminal)));
  if (options.limit) params.set("limit", String(options.limit));

  const res = await fetch(`/api/orders-v2-admin?${params.toString()}`, buildSessionFetchInit());
  const envelope = await parseJsonEnvelope<OrdersV2AdminResponse>(res);
  return envelope.data?.orders ?? [];
};

export const fetchOrdersV2Summary = async (
  options: FetchOrdersV2SummaryOptions = {},
) => {

  const params = new URLSearchParams();
  params.set("environment", options.environment ?? "production");
  if (options.from?.trim()) params.set("from", options.from.trim());
  if (options.to?.trim()) params.set("to", options.to.trim());
  if (typeof options.includeTerminal === "boolean")
    params.set("includeTerminal", String(options.includeTerminal));
  if (typeof options.limit === "number" && Number.isFinite(options.limit))
    params.set("limit", String(options.limit));
  if (typeof options.topLimit === "number" && Number.isFinite(options.topLimit))
    params.set("topLimit", String(options.topLimit));

  const query = params.toString();
  const res = await fetch(
    `/api/orders-v2-admin/summary${query ? `?${query}` : ""}`,
    buildSessionFetchInit(),
  );
  const envelope = await parseJsonEnvelope<OrdersV2SummaryResponse>(res);
  if (!envelope.data)
    throw new Error("Backend V2 no devolvió el cierre operativo");
  return envelope.data;
};

export const updateOrderV2Status = async (
  orderId: string,
  status: OrderV2Status,
  environment: OrderV2Environment,
  reason?: string,
) => {

  const res = await fetch(
    `/api/orders-v2-admin/${encodeURIComponent(orderId)}/status`,
    buildSessionFetchInit({
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, reason, environment }),
    }),
  );
  const envelope = await parseJsonEnvelope<UpdateOrderV2StatusResponse>(res);
  if (!envelope.data?.order)
    throw new Error("Backend V2 no devolvió la orden actualizada");
  return envelope.data.order;
};

export const updateKitchenItemV2 = async (
  orderId: string,
  payload: UpdateKitchenItemPayload,
  environment: OrderV2Environment,
) => {

  const res = await fetch(
    `/api/orders-v2-admin/${encodeURIComponent(orderId)}/kitchen-item`,
    buildSessionFetchInit({
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, environment }),
    }),
  );
  const envelope = await parseJsonEnvelope<UpdateKitchenItemResponse>(res);
  if (!envelope.data?.order)
    throw new Error("Backend V2 no devolvió la orden actualizada");
  return envelope.data.order;
};

export const updateOrderV2Payment = async (
  orderId: string,
  payload: UpdateOrderV2PaymentPayload,
  environment: OrderV2Environment,
) => {

  const body: {
    paymentStatus: OrderV2PaymentStatus;
    notes?: string;
    reason?: string;
    environment: OrderV2Environment;
  } = { paymentStatus: payload.paymentStatus, environment };
  if (typeof payload.notes === "string") body.notes = payload.notes;
  if (typeof payload.reason === "string") body.reason = payload.reason;

  const res = await fetch(
    `/api/orders-v2-admin/${encodeURIComponent(orderId)}/payment`,
    buildSessionFetchInit({
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
  const envelope = await parseJsonEnvelope<UpdateOrderV2PaymentResponse>(res);
  if (!envelope.data?.order)
    throw new Error("Backend V2 no devolvió la orden actualizada");
  return envelope.data.order;
};

export const archiveCancelledOrderV2 = async (
  orderId: string,
  environment: OrderV2Environment,
) => {
  const params = new URLSearchParams({ environment });
  const res = await fetch(
    `/api/orders-v2-admin/${encodeURIComponent(orderId)}/archive?${params.toString()}`,
    buildSessionFetchInit({ method: "PATCH" }),
  );
  const envelope = await parseJsonEnvelope<ArchiveOrderV2Response>(res);
  if (!envelope.data?.order)
    throw new Error("Backend V2 no devolvió la orden ocultada");
  return envelope.data.order;
};

export const exportOrdersV2Csv = async (
  options: ExportOrdersV2CsvOptions = {},
) => {

  const params = new URLSearchParams();
  params.set("environment", options.environment ?? "production");
  if (typeof options.includeTerminal === "boolean")
    params.set("includeTerminal", String(options.includeTerminal));
  if (options.status) params.set("status", options.status);
  if (options.from?.trim()) params.set("from", options.from.trim());
  if (options.to?.trim()) params.set("to", options.to.trim());
  if (typeof options.limit === "number" && Number.isFinite(options.limit))
    params.set("limit", String(options.limit));

  const query = params.toString();
  const res = await fetch(
    `/api/orders-v2-admin/export.csv${query ? `?${query}` : ""}`,
    buildSessionFetchInit(),
  );

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const envelope = (await res.json()) as {
        error?: { message?: string; code?: string };
        message?: string;
      };
      message =
        envelope.error?.message ||
        envelope.error?.code ||
        envelope.message ||
        message;
    } catch {
      // Keep the error generic. Never include request headers or session details.
    }
    throw new Error(`No se pudo exportar CSV desde Backend V2: ${message}`);
  }

  return res.blob();
};
