import type { MenuCategory, MenuItem, PromoCard, SiteConfig } from './contracts';

export const menuCategories: MenuCategory[] = [
  { id: 'c1', key: 'burgers', name: 'Burgers', sortOrder: 1 },
  { id: 'c2', key: 'extras', name: 'Extras', sortOrder: 2 },
  { id: 'c3', key: 'guarniciones', name: 'Guarniciones', sortOrder: 3 },
  { id: 'c4', key: 'drinks', name: 'Bebidas', sortOrder: 4 }
];

export const menuItems: MenuItem[] = [
  { sku: 'BRG-OG', category: 'burgers', name: 'Burger OG', description: 'Doble carne, queso y salsa de la casa.', price: 149, badge: 'Best Seller', promoLabel: 'Hot', isFeatured: true, isAvailable: true, sortOrder: 1, tags: ['signature'], upsellItems: ['EXT-BACON'], comboLinks: ['PROMO-COMBO-OG'], imageUrl: '/placeholders/burger-og.jpg' },
  { sku: 'BRG-SPICY', category: 'burgers', name: 'Burger Spicy', description: 'Chile crunch y mayo picante.', price: 159, isFeatured: true, isAvailable: true, sortOrder: 2, tags: ['spicy'], upsellItems: ['EXT-DIP'], comboLinks: ['PROMO-SPICY-NIGHT'], imageUrl: '/placeholders/burger-spicy.jpg' },
  { sku: 'EXT-BACON', category: 'extras', name: 'Extra Bacon', description: 'Tiras crocantes.', price: 29, isFeatured: false, isAvailable: true, sortOrder: 10, tags: ['addon'], upsellItems: [], comboLinks: [], imageUrl: '/placeholders/extra-bacon.jpg' },
  { sku: 'DRK-COLA', category: 'drinks', name: 'Cola Pixel', description: 'Refresco helado 355ml.', price: 39, isFeatured: false, isAvailable: false, sortOrder: 15, tags: ['drink'], upsellItems: [], comboLinks: [], imageUrl: '/placeholders/cola.jpg' },
  { sku: 'GUA-FRIES', category: 'guarniciones', name: 'Fries OG', description: 'Papas doradas con sal especial.', price: 59, isFeatured: true, isAvailable: true, sortOrder: 20, tags: ['side'], upsellItems: ['EXT-DIP'], comboLinks: ['PROMO-COMBO-OG'], imageUrl: '/placeholders/fries.jpg' }
];

export const promoCards: PromoCard[] = [
  { id: 'PROMO-COMBO-OG', title: 'Combo OG', description: 'Burger OG + Fries + Drink.', badge: 'Ahorra 20%', promoLabel: 'Limited', isFeatured: true, isAvailable: true, sortOrder: 1, tags: ['combo'], comboLinks: ['BRG-OG', 'GUA-FRIES'], asset: { alt: 'Promo combo OG', placeholder: 'combo-placeholder', imageUrl: '/placeholders/promo-combo.jpg' } },
  { id: 'PROMO-SPICY-NIGHT', title: 'Spicy Night', description: 'Burger Spicy con dip especial.', isFeatured: true, isAvailable: true, sortOrder: 2, tags: ['night'], comboLinks: ['BRG-SPICY'], asset: { alt: 'Promo spicy', placeholder: 'spicy-placeholder', imageUrl: '/placeholders/promo-spicy.jpg' } }
];

export const siteConfig: SiteConfig = {
  brandName: 'Burgers.exe',
  currency: 'MXN',
  orderModes: ['pickup', 'delivery'],
  supportPhone: '+52 55 0000 0000',
  heroCta: 'Pedir ahora',
  notice: 'V2 mock mode: catálogo local sin conexión a backend.'
};
