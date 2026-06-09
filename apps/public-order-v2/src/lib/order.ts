import type { MenuItem } from '@config/index';

export type TicketItemKind = 'burger' | 'combo' | 'garnish' | 'drink' | 'other';

export type TicketExtra = { sku?: string; name: string; price?: number; source?: 'burger' | 'included-upcharge' | 'side-extra' | 'included-drink' };

export type TicketGarnish = { sku?: string; name: string; upcharge?: number } | null;

export type ComboBurgerCustomization = {
  sku?: string;
  name: string;
  removedIngredients: string[];
  extras: TicketExtra[];
  burgerNote?: string;
};

export type CartEntry = {
  sku: string;
  name: string;
  qty: 1;
  lineKey: string;
  itemDisplayIndex: number;
  itemKind: TicketItemKind;
  removedIngredients: string[];
  extras: TicketExtra[];
  burgerNote?: string;
  garnish?: TicketGarnish;
  includedDrink?: TicketExtra | null;
  sideQuestExtras?: TicketExtra[];
  comboBurgers?: ComboBurgerCustomization[];
};

export const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(amount);

export const getCartTotal = (cart: CartEntry[], menuItems: MenuItem[]) =>
  cart.reduce((acc, entry) => {
    const item = menuItems.find((menuItem) => menuItem.sku === entry.sku);
    const extrasTotal = entry.extras.reduce((sum, extra) => sum + (extra.price ?? 0), 0);
    const sideExtrasTotal = (entry.sideQuestExtras ?? []).reduce((sum, extra) => sum + (extra.price ?? 0), 0);
    const garnishUpcharge = entry.garnish?.upcharge ?? 0;
    return acc + (item ? item.price : 0) + extrasTotal + sideExtrasTotal + garnishUpcharge;
  }, 0);

export const getCartCount = (cart: CartEntry[]) => cart.length;
