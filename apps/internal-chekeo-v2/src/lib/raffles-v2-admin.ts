import type {
  CreateRaffleCampaignPayload,
  CreateRaffleReferralCodePayload,
  RaffleCampaignMutationResponse,
  RaffleCampaignsAdminResponse,
  RaffleReferralCodeMutationResponse,
  RaffleReferralCodesAdminResponse,
  RaffleReferralMutationResponse,
  RaffleReferralsAdminResponse,
  RaffleSummaryResponse,
  UpdateRaffleCampaignPayload,
  UpdateRaffleReferralCodePayload,
  UpdateRaffleReferralPayload,
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


export type RaffleImageKind = "banner" | "detail";
export type RaffleImageMutationResult = { campaign: import("@config/index").RaffleCampaignV2; imageKey?: string | null; assetUrl?: string | null; warning?: string };

const raffleImagePathByKind: Record<RaffleImageKind, string> = {
  banner: "banner-image",
  detail: "detail-image",
};

const parseRaffleImageEnvelope = async (res: Response): Promise<RaffleImageMutationResult> => {
  const envelope = await parseJsonEnvelope<RaffleCampaignMutationResponse & { imageKey?: string | null; assetUrl?: string | null; warning?: string }>(res);
  if (!envelope.data?.campaign) throw new Error("Backend V2 no devolvió sorteo actualizado");
  return { campaign: envelope.data.campaign, imageKey: envelope.imageKey, assetUrl: envelope.assetUrl, warning: envelope.warning };
};

export const uploadRaffleCampaignImageV2 = async (id: string, kind: RaffleImageKind, file: File): Promise<RaffleImageMutationResult> => {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`/api/raffles-v2-admin/campaigns/${encodeURIComponent(id)}/${raffleImagePathByKind[kind]}`, buildSessionFetchInit({ method: "POST", body: formData }));
  return parseRaffleImageEnvelope(res);
};

export const deleteRaffleCampaignImageV2 = async (id: string, kind: RaffleImageKind): Promise<RaffleImageMutationResult> => {
  const res = await fetch(`/api/raffles-v2-admin/campaigns/${encodeURIComponent(id)}/${raffleImagePathByKind[kind]}`, buildSessionFetchInit({ method: "DELETE" }));
  return parseRaffleImageEnvelope(res);
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


export const fetchRaffleReferralCodesV2 = async (options: { campaignId: string; q?: string }) => {
  const params = new URLSearchParams({ campaignId: options.campaignId });
  if (options.q?.trim()) params.set("q", options.q.trim());
  const res = await fetch(`/api/raffles-v2-admin/referral-codes?${params}`, buildSessionFetchInit());
  const envelope = await parseJsonEnvelope<RaffleReferralCodesAdminResponse>(res);
  return envelope.data?.codes ?? [];
};

export const createRaffleReferralCodeV2 = async (payload: CreateRaffleReferralCodePayload) => {
  const res = await fetch("/api/raffles-v2-admin/referral-codes", buildSessionFetchInit({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }));
  const envelope = await parseJsonEnvelope<RaffleReferralCodeMutationResponse>(res);
  if (!envelope.data?.code) throw new Error("Backend V2 no devolvió código creado");
  return envelope.data.code;
};

export const updateRaffleReferralCodeV2 = async (id: string, payload: UpdateRaffleReferralCodePayload) => {
  const res = await fetch(`/api/raffles-v2-admin/referral-codes/${encodeURIComponent(id)}`, buildSessionFetchInit({ method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }));
  const envelope = await parseJsonEnvelope<RaffleReferralCodeMutationResponse>(res);
  if (!envelope.data?.code) throw new Error("Backend V2 no devolvió código actualizado");
  return envelope.data.code;
};

export const fetchRaffleReferralsV2 = async (options: { campaignId: string; q?: string; status?: string }) => {
  const params = new URLSearchParams({ campaignId: options.campaignId, status: options.status || "all" });
  if (options.q?.trim()) params.set("q", options.q.trim());
  const res = await fetch(`/api/raffles-v2-admin/referrals?${params}`, buildSessionFetchInit());
  const envelope = await parseJsonEnvelope<RaffleReferralsAdminResponse>(res);
  return envelope.data?.referrals ?? [];
};

export const updateRaffleReferralV2 = async (id: string, payload: UpdateRaffleReferralPayload) => {
  const res = await fetch(`/api/raffles-v2-admin/referrals/${encodeURIComponent(id)}`, buildSessionFetchInit({ method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }));
  const envelope = await parseJsonEnvelope<RaffleReferralMutationResponse>(res);
  if (!envelope.data?.referral) throw new Error("Backend V2 no devolvió referido actualizado");
  return envelope.data.referral;
};
