import type {
  CreateRaffleCampaignPayload,
  RaffleCampaignMutationResponse,
  RaffleCampaignsAdminResponse,
  RaffleSummaryResponse,
  UpdateRaffleCampaignPayload,
} from "@config/index";

const buildSessionFetchInit = (init: RequestInit = {}): RequestInit => ({
  ...init,
  credentials: "include",
});

const parseJsonEnvelope = async <T extends { ok: boolean; error?: { message?: string; code?: string } }>(res: Response): Promise<T> => {
  let envelope: T | null = null;
  try {
    envelope = (await res.json()) as T;
  } catch {
    // Keep session details out of error messages.
  }
  if (!res.ok) {
    const message = envelope?.error?.message || envelope?.error?.code || `HTTP ${res.status}`;
    throw new Error(`Backend V2 rechazó la solicitud: ${message}`);
  }
  if (!envelope) throw new Error("Backend V2 respondió con JSON inválido");
  if (!envelope.ok) throw new Error(envelope.error?.message || envelope.error?.code || "Backend V2 respondió ok=false");
  return envelope;
};

export const fetchRaffleCampaignsV2 = async () => {
  const res = await fetch("/api/raffles-v2-admin/campaigns", buildSessionFetchInit());
  const envelope = await parseJsonEnvelope<RaffleCampaignsAdminResponse>(res);
  return envelope.data?.campaigns ?? [];
};

export const createRaffleCampaignV2 = async (payload: CreateRaffleCampaignPayload) => {
  const res = await fetch(
    "/api/raffles-v2-admin/campaigns",
    buildSessionFetchInit({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
  );
  const envelope = await parseJsonEnvelope<RaffleCampaignMutationResponse>(res);
  if (!envelope.data?.campaign) throw new Error("Backend V2 no devolvió sorteo creado");
  return envelope.data.campaign;
};

export const updateRaffleCampaignV2 = async (id: string, payload: UpdateRaffleCampaignPayload) => {
  const res = await fetch(
    `/api/raffles-v2-admin/campaigns/${encodeURIComponent(id)}`,
    buildSessionFetchInit({ method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
  );
  const envelope = await parseJsonEnvelope<RaffleCampaignMutationResponse>(res);
  if (!envelope.data?.campaign) throw new Error("Backend V2 no devolvió sorteo actualizado");
  return envelope.data.campaign;
};

export const fetchRaffleSummaryV2 = async (options: { campaignId?: string; q?: string } = {}) => {
  const params = new URLSearchParams();
  if (options.campaignId) params.set("campaignId", options.campaignId);
  if (options.q?.trim()) params.set("q", options.q.trim());
  const query = params.toString();
  const res = await fetch(`/api/raffles-v2-admin/summary${query ? `?${query}` : ""}`, buildSessionFetchInit());
  const envelope = await parseJsonEnvelope<RaffleSummaryResponse>(res);
  if (!envelope.data) throw new Error("Backend V2 no devolvió resumen de sorteo");
  return envelope.data;
};
