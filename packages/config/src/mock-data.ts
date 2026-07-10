import {
  DEFAULT_PUBLIC_CONFIG,
  type KitchenEvent,
  type MenuCategory,
  type MenuItem,
  type MockOrder,
  type OperatorStats,
  type PromoCard,
  type SiteConfig
} from './contracts';

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
  brandName: 'Burgers.exe', currency: 'MXN', orderModes: ['pickup', 'delivery'], supportPhone: '+52 55 0000 0000', heroCta: 'Pedir ahora', notice: 'V2 mock mode: catálogo local sin conexión a backend.'
};

export const publicConfig = DEFAULT_PUBLIC_CONFIG;

export const orderStatuses = [
  { key: 'new', label: 'Nuevo' },
  { key: 'preparing', label: 'En preparación' },
  { key: 'ready', label: 'Listo' },
  { key: 'delivered', label: 'Entregado' },
  { key: 'cancelled', label: 'Cancelado' }
] as const;

export const paymentMethods = [
  { key: 'cash', label: 'Efectivo' },
  { key: 'card', label: 'Tarjeta' },
  { key: 'transfer', label: 'Transferencia' },
  { key: 'wallet', label: 'Wallet' }
] as const;

export const mockOrders: MockOrder[] = [
  { id: 'o-1', folio: 'BX-2101', customer: 'Sofía R.', channel: 'pickup', createdAt: '13:02', status: 'new', priority: 'urgent', paymentMethod: 'card', paymentState: 'paid', note: 'Sin cebolla + extra pepinillo', items: [{ name: 'Burger OG', qty: 2, price: 149 }, { name: 'Fries OG', qty: 1, price: 59 }], total: 357, kitchenStation: 'grill', timeline: [{ id: 't1', label: 'Pedido creado', time: '13:02' }] },
  { id: 'o-2', folio: 'BX-2102', customer: 'Marco P.', channel: 'delivery', createdAt: '12:58', status: 'preparing', priority: 'warning', paymentMethod: 'cash', paymentState: 'pending', note: 'Llamar al llegar', items: [{ name: 'Burger Spicy', qty: 1, price: 159 }], total: 159, kitchenStation: 'assembly', timeline: [{ id: 't2', label: 'Aceptado', time: '13:00' }] },
  { id: 'o-3', folio: 'BX-2103', customer: 'Diana K.', channel: 'walk-in', createdAt: '12:54', status: 'ready', priority: 'normal', paymentMethod: 'transfer', paymentState: 'paid', items: [{ name: 'Combo OG', qty: 1, price: 239 }], total: 239, kitchenStation: 'dispatch', timeline: [{ id: 't3', label: 'Listo para entrega', time: '13:04', tone: 'success' }] },
  { id: 'o-4', folio: 'BX-2098', customer: 'Julio A.', channel: 'pickup', createdAt: '12:42', status: 'delivered', priority: 'normal', paymentMethod: 'wallet', paymentState: 'paid', items: [{ name: 'Fries OG', qty: 2, price: 59 }], total: 118, kitchenStation: 'dispatch', timeline: [{ id: 't4', label: 'Entregado', time: '12:58', tone: 'success' }] },
  { id: 'o-5', folio: 'BX-2096', customer: 'Nora G.', channel: 'delivery', createdAt: '12:28', status: 'cancelled', priority: 'warning', paymentMethod: 'card', paymentState: 'refunded', note: 'Cliente canceló', items: [{ name: 'Burger OG', qty: 1, price: 149 }], total: 149, kitchenStation: 'dispatch', timeline: [{ id: 't5', label: 'Cancelado mock', time: '12:36', tone: 'warning' }] }
];

export const kitchenEvents: KitchenEvent[] = [
  { id: 'ke-1', orderId: 'o-1', label: 'Asignado a grill', at: '13:03' },
  { id: 'ke-2', orderId: 'o-2', label: 'Ensamble en curso', at: '13:01' },
  { id: 'ke-3', orderId: 'o-3', label: 'Empaque terminado', at: '13:04' }
];

export const operatorStats: OperatorStats = {
  activeOrders: 4,
  pendingOrders: 2,
  kitchenLoad: 67,
  paymentsPending: 1,
  avgTicket: 218,
  urgentOrders: 1
};
