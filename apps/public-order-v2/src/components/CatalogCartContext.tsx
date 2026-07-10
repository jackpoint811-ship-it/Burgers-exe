import { createContext, useCallback, useContext, useMemo, useReducer } from "react";
import { type CatalogProduct } from "../lib/catalog-mode";
import {
  CATALOG_CART_INITIAL_STATE,
  type CatalogCartItem,
  catalogCartReducer,
  getCatalogCartCount,
  getCatalogCartTotal,
} from "../lib/catalog-cart";

type CatalogCartContextValue = {
  items: CatalogCartItem[];
  count: number;
  total: number;
  addItem: (product: CatalogProduct) => void;
  setQty: (productId: string, qty: number) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
};

const CatalogCartContext = createContext<CatalogCartContextValue | null>(null);

export function CatalogCartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(catalogCartReducer, CATALOG_CART_INITIAL_STATE);

  const addItem = useCallback((product: CatalogProduct) => {
    dispatch({ type: "ADD_ITEM", product });
  }, []);

  const setQty = useCallback((productId: string, qty: number) => {
    dispatch({ type: "SET_QTY", productId, qty });
  }, []);

  const removeItem = useCallback((productId: string) => {
    dispatch({ type: "REMOVE_ITEM", productId });
  }, []);

  const clear = useCallback(() => {
    dispatch({ type: "CLEAR" });
  }, []);

  const count = useMemo(() => getCatalogCartCount(state.items), [state.items]);
  const total = useMemo(() => getCatalogCartTotal(state.items), [state.items]);

  const value = useMemo<CatalogCartContextValue>(
    () => ({ items: state.items, count, total, addItem, setQty, removeItem, clear }),
    [state.items, count, total, addItem, setQty, removeItem, clear]
  );

  return <CatalogCartContext.Provider value={value}>{children}</CatalogCartContext.Provider>;
}

export function useCatalogCart(): CatalogCartContextValue {
  const ctx = useContext(CatalogCartContext);
  if (!ctx) throw new Error("useCatalogCart must be used within CatalogCartProvider");
  return ctx;
}
