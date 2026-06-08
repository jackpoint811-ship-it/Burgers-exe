import type { IngredientV2, IngredientV2Unit, ProductIngredientRecipeV2 } from '../../packages/config/src';
import { errorResponse } from './_orders-v2-utils';

export const INGREDIENT_UNITS: IngredientV2Unit[] = ['pieza', 'g', 'kg', 'ml', 'l', 'paquete', 'bolsa'];
const UNIT_SET = new Set<string>(INGREDIENT_UNITS);

export const mapD1Ingredient = (row: any): IngredientV2 => ({
  id: String(row.id),
  name: String(row.name),
  unit: String(row.unit) as IngredientV2Unit,
  unitPriceCents: row.unit_price_cents == null ? null : Number(row.unit_price_cents),
  isQuantifiable: Boolean(row.is_quantifiable),
  isActive: Boolean(row.is_active),
  sortOrder: Number(row.sort_order) || 0,
  createdAt: String(row.created_at),
  updatedAt: String(row.updated_at)
});

export const mapD1Recipe = (row: any): ProductIngredientRecipeV2 => ({
  id: String(row.id),
  productSku: String(row.product_sku),
  ingredientId: String(row.ingredient_id),
  quantityPerUnit: Number(row.quantity_per_unit) || 0,
  createdAt: String(row.created_at),
  updatedAt: String(row.updated_at),
  ingredient: row.ingredient_name ? mapD1Ingredient({
    id: row.ingredient_id,
    name: row.ingredient_name,
    unit: row.ingredient_unit,
    unit_price_cents: row.ingredient_unit_price_cents,
    is_quantifiable: row.ingredient_is_quantifiable,
    is_active: row.ingredient_is_active,
    sort_order: row.ingredient_sort_order,
    created_at: row.ingredient_created_at,
    updated_at: row.ingredient_updated_at
  }) : undefined
});

export const normalizeIngredientPayload = (body: Record<string, unknown>, partial = false) => {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const unit = typeof body.unit === 'string' ? body.unit.trim() : '';
  const unitPriceRaw = body.unitPriceCents ?? body.unit_price_cents;
  const unitPriceCents = unitPriceRaw === null || unitPriceRaw === '' || typeof unitPriceRaw === 'undefined'
    ? null
    : Number(unitPriceRaw);
  const isActive = typeof body.isActive === 'boolean' ? body.isActive : typeof body.is_active === 'boolean' ? body.is_active : true;
  const sortOrderRaw = body.sortOrder ?? body.sort_order ?? 0;
  const sortOrder = Number(sortOrderRaw);

  if (!partial || Object.prototype.hasOwnProperty.call(body, 'name')) {
    if (name.length < 2) return errorResponse(400, 'INVALID_NAME', 'Nombre de ingrediente inválido.');
  }
  if (!partial || Object.prototype.hasOwnProperty.call(body, 'unit')) {
    if (!UNIT_SET.has(unit)) return errorResponse(400, 'INVALID_UNIT', 'Unidad inválida.');
  }
  if (unitPriceCents !== null && (!Number.isInteger(unitPriceCents) || unitPriceCents < 0)) {
    return errorResponse(400, 'INVALID_UNIT_PRICE', 'Precio por unidad inválido.');
  }
  if (!Number.isInteger(sortOrder)) return errorResponse(400, 'INVALID_SORT_ORDER', 'Orden inválido.');

  return { name, unit: unit as IngredientV2Unit, unitPriceCents, isActive, sortOrder };
};
