import type {
  IngredientV2,
  IngredientV2MutationResponse,
  IngredientsV2AdminResponse,
  KitchenSummaryKResponse,
  OrderV2Environment,
  ProductIngredientRecipeV2,
  ProductIngredientRecipeV2Response,
} from "@config/index";

type Envelope = { ok: boolean; error?: { message?: string; code?: string } };

const withSession = (init: RequestInit = {}): RequestInit => ({ ...init, credentials: "include" });

const parseEnvelope = async <T extends Envelope>(res: Response): Promise<T> => {
  let envelope: T | null = null;
  try {
    envelope = (await res.json()) as T;
  } catch {
    // Keep generic errors. Never expose session details.
  }
  if (!res.ok) throw new Error(envelope?.error?.message || envelope?.error?.code || `HTTP ${res.status}`);
  if (!envelope?.ok) throw new Error(envelope?.error?.message || envelope?.error?.code || "Backend respondió ok=false");
  return envelope;
};

export type IngredientV2Payload = {
  name: string;
  unit: string;
  unitPriceCents: number | null;
  isActive: boolean;
  sortOrder: number;
};

export const fetchIngredientsV2Admin = async () => {
  const res = await fetch("/api/ingredients-v2-admin", withSession({ headers: { accept: "application/json" } }));
  const envelope = await parseEnvelope<IngredientsV2AdminResponse>(res);
  return envelope.data?.ingredients ?? [];
};

export const createIngredientV2Admin = async (payload: IngredientV2Payload) => {
  const res = await fetch("/api/ingredients-v2-admin", withSession({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }));
  const envelope = await parseEnvelope<IngredientV2MutationResponse>(res);
  if (!envelope.data?.ingredient) throw new Error("No se devolvió ingrediente");
  return envelope.data.ingredient;
};

export const updateIngredientV2Admin = async (id: string, payload: Partial<IngredientV2Payload>) => {
  const res = await fetch(`/api/ingredients-v2-admin/${encodeURIComponent(id)}`, withSession({
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }));
  const envelope = await parseEnvelope<IngredientV2MutationResponse>(res);
  if (!envelope.data?.ingredient) throw new Error("No se devolvió ingrediente");
  return envelope.data.ingredient;
};

export const fetchProductRecipeV2Admin = async (sku: string) => {
  const res = await fetch(`/api/ingredients-v2-admin/recipes/${encodeURIComponent(sku)}`, withSession({ headers: { accept: "application/json" } }));
  const envelope = await parseEnvelope<ProductIngredientRecipeV2Response>(res);
  return envelope.data?.recipes ?? [];
};

export const saveProductRecipeV2Admin = async (sku: string, recipes: Array<Pick<ProductIngredientRecipeV2, "ingredientId" | "quantityPerUnit">>) => {
  const res = await fetch(`/api/ingredients-v2-admin/recipes/${encodeURIComponent(sku)}`, withSession({
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipes }),
  }));
  const envelope = await parseEnvelope<ProductIngredientRecipeV2Response>(res);
  return envelope.data?.recipes ?? [];
};

export const fetchKitchenSummaryK = async (environment: OrderV2Environment = "production") => {
  const params = new URLSearchParams({ environment });
  const res = await fetch(`/api/kitchen-v2-admin/summary-k?${params.toString()}`, withSession({ headers: { accept: "application/json" } }));
  const envelope = await parseEnvelope<KitchenSummaryKResponse>(res);
  if (!envelope.data) throw new Error("No se devolvió Resumen K");
  return envelope.data;
};

export type { IngredientV2 };
