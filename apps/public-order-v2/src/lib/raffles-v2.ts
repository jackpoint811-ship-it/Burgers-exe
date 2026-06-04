import type { RaffleActiveResponse, RaffleCampaignPublicV2, RaffleTicketsLookupResponse } from "@config/index";

export const loadActiveRaffleV2 = async (): Promise<RaffleCampaignPublicV2 | null> => {
  try {
    const res = await fetch("/api/raffles-v2/active", { cache: "no-store" });
    if (!res.ok) return null;
    const envelope = (await res.json()) as RaffleActiveResponse;
    return envelope.ok ? (envelope.data?.campaign ?? null) : null;
  } catch {
    return null;
  }
};

export const lookupRaffleTicketsV2 = async ({ phone, code }: { phone?: string; code?: string }): Promise<RaffleTicketsLookupResponse> => {
  const params = new URLSearchParams();
  const normalizedPhone = (phone ?? "").replace(/\D/g, "");
  const normalizedCode = (code ?? "").trim().toUpperCase().slice(0, 32);
  if (normalizedPhone) params.set("phone", normalizedPhone);
  if (normalizedCode) params.set("code", normalizedCode);
  const res = await fetch(`/api/raffles-v2/lookup?${params.toString()}`, { cache: "no-store" });
  const envelope = (await res.json()) as RaffleTicketsLookupResponse;
  if (!res.ok || !envelope.ok) {
    return { ok: false, error: envelope.error ?? { code: "RAFFLE_LOOKUP_FAILED", message: "No pudimos consultar tickets en este momento." } };
  }
  return envelope;
};
