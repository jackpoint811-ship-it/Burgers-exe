import type { RaffleActiveResponse, RaffleCampaignV2 } from '../../../packages/config/src';
import { json } from '../_orders-v2-utils';

type Env = { BOG_MENU_DB?: D1Database };

type RaffleCampaignRow = {
  id: string;
  title: string;
  description: string | null;
  rules_text: string | null;
  banner_image_key: string | null;
  banner_image_url: string | null;
  detail_image_key?: string | null;
  detail_image_url?: string | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: number;
  ticket_per_burger: number;
  ticket_per_referral: number;
  created_at: string;
  updated_at: string;
};

const mapCampaign = (row: RaffleCampaignRow): RaffleCampaignV2 => ({
  id: row.id,
  title: row.title,
  description: row.description ?? undefined,
  rulesText: row.rules_text ?? undefined,
  bannerImageKey: row.banner_image_key ?? undefined,
  bannerImageUrl: row.banner_image_url ?? undefined,
  detailImageKey: row.detail_image_key ?? undefined,
  detailImageUrl: row.detail_image_url ?? undefined,
  startsAt: row.starts_at ?? undefined,
  endsAt: row.ends_at ?? undefined,
  isActive: Boolean(row.is_active),
  ticketPerBurger: Number(row.ticket_per_burger) || 1,
  ticketPerReferral: Number(row.ticket_per_referral) || 2,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const safePayload = (campaign: RaffleCampaignV2 | null): RaffleActiveResponse => ({
  ok: true,
  data: {
    campaign: campaign
      ? {
          id: campaign.id,
          title: campaign.title,
          description: campaign.description,
          rulesText: campaign.rulesText,
          bannerImageUrl: campaign.bannerImageUrl,
          bannerImageKey: campaign.bannerImageKey,
          detailImageUrl: campaign.detailImageUrl,
          detailImageKey: campaign.detailImageKey,
          startsAt: campaign.startsAt,
          endsAt: campaign.endsAt,
          ticketPerBurger: campaign.ticketPerBurger,
          ticketPerReferral: campaign.ticketPerReferral
        }
      : null
  }
});

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  if (!env.BOG_MENU_DB) return json(200, safePayload(null));

  try {
    const row = await env.BOG_MENU_DB.prepare(
      `SELECT * FROM raffle_campaigns_v2
       WHERE is_active = 1
       ORDER BY updated_at DESC, created_at DESC
       LIMIT 1`
    ).first<RaffleCampaignRow>();
    return json(200, safePayload(row ? mapCampaign(row) : null));
  } catch {
    return json(200, safePayload(null));
  }
};
