import { type CatalogProduct } from "./catalog-mode";

export const CATALOG_CART_MAX_QTY = 10;

export type CatalogCartItem = {
  productId: string;
  name: string;
  price: number;
  type: CatalogProduct["type"];
  qty: number;
  imageUrl?: string;
  imageKey?: string;
};

export type CatalogCartState = {
  items: CatalogCartItem[];
};

export type CatalogCartAction =
  | { type: "ADD_ITEM"; product: CatalogProduct }
  | { type: "SET_QTY"; productId: string; qty: number }
  | { type: "REMOVE_ITEM"; productId: string }
  | { type: "CLEAR" };

export const CATALOG_CART_INITIAL_STATE: CatalogCartState = { items: [] };

export function catalogCartReducer(
  state: CatalogCartState,
  action: CatalogCartAction
): CatalogCartState {
  switch (action.type) {
    case "ADD_ITEM": {
      const existing = state.items.find((item) => item.productId === action.product.id);
      if (existing) {
        return {
          items: state.items.map((item) =>
            item.productId === action.product.id
              ? { ...item, qty: Math.min(item.qty + 1, CATALOG_CART_MAX_QTY) }
              : item
          ),
        };
      }
      const newItem: CatalogCartItem = {
        productId: action.product.id,
        name: action.product.name,
        price: action.product.price,
        type: action.product.type,
        qty: 1,
        imageUrl: action.product.imageUrl,
        imageKey: action.product.imageKey,
      };
      return { items: [...state.items, newItem] };
    }

    case "SET_QTY": {
      if (action.qty <= 0) {
        return { items: state.items.filter((item) => item.productId !== action.productId) };
      }
      return {
        items: state.items.map((item) =>
          item.productId === action.productId
            ? { ...item, qty: Math.min(action.qty, CATALOG_CART_MAX_QTY) }
            : item
        ),
      };
    }

    case "REMOVE_ITEM":
      return { items: state.items.filter((item) => item.productId !== action.productId) };

    case "CLEAR":
      return CATALOG_CART_INITIAL_STATE;

    default:
      return state;
  }
}

export function getCatalogCartCount(items: CatalogCartItem[]): number {
  return items.reduce((sum, item) => sum + item.qty, 0);
}

export function getCatalogCartTotal(items: CatalogCartItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.qty, 0);
}
