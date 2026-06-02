import type { RaffleActiveResponse, RaffleCampaignPublicV2 } from "@config/index";

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
