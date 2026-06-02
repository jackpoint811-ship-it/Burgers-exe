export type Availability = {
  isAvailable: boolean;
  startTime?: string;
  endTime?: string;
  days?: number[];
};

export type DataSource = "d1" | "mock" | "fallback";

export type AssetRef = {
  imageUrl?: string;
  imageKey?: string;
  contentType?: string;
  alt: string;
  placeholder: string;
};

export type MenuCategory = {
  id: string;
  key: "burgers" | "extras" | "guarniciones" | "drinks";
  name: string;
  sortOrder: number;
  updatedAt?: string;
};

export type MenuItem = {
  sku: string;
  category: MenuCategory["key"];
  name: string;
  description: string;
  price: number;
  imageUrl?: string;
  imageKey?: string;
  badge?: string;
  promoLabel?: string;
  isFeatured: boolean;
  isAvailable: boolean;
  sortOrder: number;
  tags: string[];
  upsellItems: string[];
  comboLinks: string[];
  updatedAt?: string;
  availability?: Availability;
};

export type PromoCard = {
  id: string;
  title: string;
  description: string;
  badge?: string;
  promoLabel?: string;
  isFeatured: boolean;
  isAvailable: boolean;
  sortOrder: number;
  tags: string[];
  comboLinks: string[];
  asset: AssetRef;
  updatedAt?: string;
};

export type SiteConfig = {
  brandName: string;
  currency: "MXN";
  orderModes: Array<"pickup" | "delivery">;
  supportPhone: string;
  heroCta: string;
  notice: string;
  updatedAt?: string;
};

export type MenuV2Response = {
  categories: MenuCategory[];
  items: MenuItem[];
  promos: PromoCard[];
  siteConfig: SiteConfig;
  updatedAt: string;
  source: DataSource;
};

export type OrderStatus =
  | "new"
  | "preparing"
  | "ready"
  | "delivered"
  | "cancelled";
export type PriorityLevel = "normal" | "warning" | "urgent";
export type PaymentMethod = "cash" | "card" | "transfer" | "wallet";
export type PaymentState = "paid" | "pending" | "refunded";

export type OrderItem = {
  name: string;
  qty: number;
  note?: string;
  price: number;
};
export type OrderTimelineEvent = {
  id: string;
  label: string;
  time: string;
  tone?: "default" | "success" | "warning";
};

export type MockOrder = {
  id: string;
  folio: string;
  customer: string;
  channel: "walk-in" | "pickup" | "delivery";
  createdAt: string;
  status: OrderStatus;
  priority: PriorityLevel;
  paymentMethod: PaymentMethod;
  paymentState: PaymentState;
  note?: string;
  items: OrderItem[];
  total: number;
  kitchenStation: "grill" | "assembly" | "dispatch";
  timeline: OrderTimelineEvent[];
};

export type OrderV2Status =
  | "new"
  | "preparing"
  | "ready"
  | "delivered"
  | "cancelled";
export type OrderV2Mode = "pickup" | "delivery";
export type OrderV2PaymentMethod = "cash" | "transfer" | "card" | "unknown";
export type OrderV2PaymentStatus = "pending" | "paid" | "cancelled";
export type OrderV2Source = "public-v2" | "internal-v2" | "seed" | "import";

export type OrderV2ItemKind =
  | "burger"
  | "combo"
  | "garnish"
  | "drink"
  | "other";

export type OrderV2ItemCustomization = {
  lineKey?: string;
  itemDisplayIndex?: number;
  itemKind?: OrderV2ItemKind;
  removedIngredients?: string[];
  extras?: Array<{ sku?: string; name: string; price?: number }>;
  burgerNote?: string;
  garnish?: { sku?: string; name: string } | null;
  extrasTotalCents?: number;
};

export type OrderV2Item = {
  id: string;
  orderId: string;
  sku: string;
  name: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  snapshot?: Record<string, unknown>;
  createdAt?: string;
};

export type OrderV2Event = {
  id: string;
  orderId: string;
  type: string;
  previousStatus?: OrderV2Status;
  nextStatus?: OrderV2Status;
  detail?: Record<string, unknown>;
  actor: string;
  createdAt: string;
};

export type OrderV2 = {
  id: string;
  folio: string;
  customerName: string;
  customerPhone: string;
  orderMode: OrderV2Mode;
  paymentMethod: OrderV2PaymentMethod;
  paymentStatus: OrderV2PaymentStatus;
  notes?: string;
  subtotal: number;
  total: number;
  status: OrderV2Status;
  source: OrderV2Source;
  createdAt: string;
  updatedAt: string;
  items: OrderV2Item[];
  events?: OrderV2Event[];
};

export type OrderV2Error = { code: string; message: string };

export type CreateOrderV2Payload = {
  customer: { name: string; phone: string };
  orderMode: OrderV2Mode;
  paymentMethod?: OrderV2PaymentMethod;
  notes?: string;
  items: Array<{ sku: string; qty: number } & OrderV2ItemCustomization>;
  idempotencyKey?: string;
};

export type CreateOrderV2Response = {
  ok: boolean;
  data?: {
    order: Pick<OrderV2, "id" | "folio" | "status" | "createdAt"> & {
      subtotal: number;
      total: number;
      currency: "MXN";
      idempotencyKey: string;
    };
    idempotent?: boolean;
  };
  error?: OrderV2Error;
};

export type OrdersV2AdminResponse = {
  ok: boolean;
  data?: { orders: OrderV2[]; source?: "d1" };
  error?: OrderV2Error;
};

export type OrdersV2SummaryResponse = {
  ok: boolean;
  data?: {
    source: "d1";
    range: { from: string; to: string; fromUtc: string; toUtc: string };
    totals: {
      orders: number;
      activeOrders: number;
      deliveredOrders: number;
      cancelledOrders: number;
      grossSales: number;
      deliveredSales: number;
      averageTicket: number;
    };
    byStatus: Record<OrderV2Status, number>;
    byPaymentMethod: Array<{
      paymentMethod: string;
      orders: number;
      total: number;
    }>;
    byOrderMode: Array<{ orderMode: string; orders: number; total: number }>;
    topItems: Array<{
      sku: string;
      name: string;
      qty: number;
      total: number;
      orders: number;
    }>;
    recentOrders: Array<{
      id: string;
      folio: string;
      createdAt: string;
      status: string;
      customerName: string;
      orderMode: string;
      paymentMethod: string;
      paymentStatus: string;
      total: number;
    }>;
    durations: {
      newToReadyAvgSeconds: number | null;
      newToDeliveredAvgSeconds: number | null;
    };
    generatedAt: string;
  };
  error?: OrderV2Error;
};

export type UpdateOrderV2StatusPayload = {
  status: OrderV2Status;
  reason?: string;
};

export type UpdateOrderV2StatusResponse = {
  ok: boolean;
  data?: { order: OrderV2; event?: OrderV2Event };
  error?: OrderV2Error;
};

export type UpdateOrderV2PaymentPayload = {
  paymentStatus: OrderV2PaymentStatus;
  notes?: string;
  reason?: string;
};

export type UpdateOrderV2PaymentResponse = {
  ok: boolean;
  data?: { order: OrderV2; event?: OrderV2Event };
  error?: OrderV2Error;
};

export type UpdateKitchenItemPayload = {
  lineKey: string;
  itemKind: Extract<OrderV2ItemKind, "burger" | "combo" | "garnish">;
  done: boolean;
};

export type UpdateKitchenItemResponse = {
  ok: boolean;
  data?: { order: OrderV2; event?: OrderV2Event };
  error?: OrderV2Error;
};

export type KitchenEvent = {
  id: string;
  orderId: string;
  label: string;
  at: string;
};

export type RaffleCampaignV2 = {
  id: string;
  title: string;
  description?: string;
  rulesText?: string;
  bannerImageKey?: string;
  bannerImageUrl?: string;
  startsAt?: string;
  endsAt?: string;
  isActive: boolean;
  ticketPerBurger: number;
  ticketPerReferral: number;
  createdAt: string;
  updatedAt: string;
};

export type RaffleCampaignPublicV2 = Pick<
  RaffleCampaignV2,
  | "id"
  | "title"
  | "description"
  | "rulesText"
  | "bannerImageKey"
  | "bannerImageUrl"
  | "startsAt"
  | "endsAt"
  | "ticketPerBurger"
  | "ticketPerReferral"
>;

export type RaffleParticipantSummary = {
  customerName: string;
  customerPhoneMasked: string;
  burgerTickets: number;
  referralTickets: number;
  totalTickets: number;
  lastOrderFolio: string;
  lastOrderAt: string;
};

export type RaffleActiveResponse = {
  ok: boolean;
  data?: { campaign: RaffleCampaignPublicV2 | null };
  error?: OrderV2Error;
};

export type RaffleCampaignsAdminResponse = {
  ok: boolean;
  data?: { campaigns: RaffleCampaignV2[] };
  error?: OrderV2Error;
};

export type RaffleCampaignMutationResponse = {
  ok: boolean;
  data?: { campaign: RaffleCampaignV2 };
  error?: OrderV2Error;
};

export type RaffleSummaryResponse = {
  ok: boolean;
  data?: {
    campaign: RaffleCampaignV2 | null;
    totalTickets: number;
    totalParticipants: number;
    topParticipants: RaffleParticipantSummary[];
    participantResults: RaffleParticipantSummary[];
  };
  error?: OrderV2Error;
};

export type CreateRaffleCampaignPayload = {
  title: string;
  description?: string;
  rulesText?: string;
  bannerImageKey?: string;
  bannerImageUrl?: string;
  startsAt?: string;
  endsAt?: string;
  isActive?: boolean;
  ticketPerBurger?: number;
  ticketPerReferral?: number;
};

export type UpdateRaffleCampaignPayload = Partial<CreateRaffleCampaignPayload>;

export type OperatorStats = {
  activeOrders: number;
  pendingOrders: number;
  kitchenLoad: number;
  paymentsPending: number;
  avgTicket: number;
  urgentOrders: number;
};
