import type { MenuItem } from '@config/index';

export type CartEntry = { sku: string; qty: number };

export const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(amount);

export const getCartTotal = (cart: CartEntry[], menuItems: MenuItem[]) =>
  cart.reduce((acc, entry) => {
    const item = menuItems.find((menuItem) => menuItem.sku === entry.sku);
    return acc + (item ? item.price * entry.qty : 0);
  }, 0);

export const getCartCount = (cart: CartEntry[]) => cart.reduce((acc, entry) => acc + entry.qty, 0);
