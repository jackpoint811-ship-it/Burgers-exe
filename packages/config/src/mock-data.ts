import type {
  KitchenEvent,
  MenuCategory,
  MenuItem,
  MockOrder,
  OperatorStats,
  PromoCard,
  SiteConfig
} from './contracts';

export const menuCategories: MenuCategory[] = [
  { id: 'c1', key: 'burgers', name: 'Burgers', sortOrder: 1 },
  { id: 'c2', key: 'extras', name: 'Extras', sortOrder: 2 },
  { id: 'c3', key: 'guarniciones', name: 'Guarniciones', sortOrder: 3 },
  { id: 'c4', key: 'drinks', name: 'Bebidas', sortOrder: 4 }
];
export const menuItems: MenuItem[] = [];
export const promoCards: PromoCard[] = [];
export const siteConfig: SiteConfig = {
  brandName: 'Burgers.exe', currency: 'MXN', orderModes: ['pickup', 'delivery'], supportPhone: '+52 55 0000 0000', heroCta: 'Pedir ahora', notice: 'V2 mock mode: catálogo local sin conexión a backend.'
};

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
