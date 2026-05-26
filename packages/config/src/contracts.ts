export type Availability = {
  isAvailable: boolean;
  startTime?: string;
  endTime?: string;
  days?: number[];
};

export type AssetRef = {
  imageUrl?: string;
  imageKey?: string;
  alt: string;
  placeholder: string;
};

export type MenuCategory = {
  id: string;
  key: 'burgers' | 'extras' | 'guarniciones' | 'drinks';
  name: string;
  sortOrder: number;
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
};

export type SiteConfig = {
  brandName: string;
  currency: 'MXN';
  orderModes: Array<'pickup' | 'delivery'>;
  supportPhone: string;
  heroCta: string;
  notice: string;
};
