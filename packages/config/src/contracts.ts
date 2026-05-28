export type Availability = {
  isAvailable: boolean;
  startTime?: string;
  endTime?: string;
  days?: number[];
};

export type DataSource = 'd1' | 'mock' | 'fallback';

export type AssetRef = {
  imageUrl?: string;
  imageKey?: string;
  contentType?: string;
  alt: string;
  placeholder: string;
};

export type MenuCategory = {
  id: string;
  key: 'burgers' | 'extras' | 'guarniciones' | 'drinks';
  name: string;
  sortOrder: number;
  updatedAt?: string;
};

export type MenuItem = {
  sku: string;
  category: MenuCategory['key'];
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
  currency: 'MXN';
  orderModes: Array<'pickup' | 'delivery'>;
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

export type OrderStatus = 'new' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
export type PriorityLevel = 'normal' | 'warning' | 'urgent';
export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'wallet';
export type PaymentState = 'paid' | 'pending' | 'refunded';

export type OrderItem = { name: string; qty: number; note?: string; price: number };
export type OrderTimelineEvent = { id: string; label: string; time: string; tone?: 'default' | 'success' | 'warning' };

export type MockOrder = {
  id: string;
  folio: string;
  customer: string;
  channel: 'walk-in' | 'pickup' | 'delivery';
  createdAt: string;
  status: OrderStatus;
  priority: PriorityLevel;
  paymentMethod: PaymentMethod;
  paymentState: PaymentState;
  note?: string;
  items: OrderItem[];
  total: number;
  kitchenStation: 'grill' | 'assembly' | 'dispatch';
  timeline: OrderTimelineEvent[];
};

export type KitchenEvent = { id: string; orderId: string; label: string; at: string };
export type OperatorStats = {
  activeOrders: number;
  pendingOrders: number;
  kitchenLoad: number;
  paymentsPending: number;
  avgTicket: number;
  urgentOrders: number;
};
