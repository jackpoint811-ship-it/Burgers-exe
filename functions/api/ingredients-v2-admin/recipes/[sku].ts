import {
  errorResponse,
  generateId,
  json,
  parseJsonObject,
  requireAdminToken,
  type AdminEnv,
} from "../../_orders-v2-utils";
import { mapD1Recipe } from "../../_ingredients-v2-utils";

type Env = AdminEnv;

type RecipeInput = { ingredientId: string; quantityPerUnit: number };

const normalizeSku = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toUpperCase();

const loadRecipes = async (db: D1Database, sku: string) => {
  const result = await db
    .prepare(
      `SELECT r.*, i.name AS ingredient_name, i.unit AS ingredient_unit, i.unit_price_cents AS ingredient_unit_price_cents,
            i.is_quantifiable AS ingredient_is_quantifiable, i.is_active AS ingredient_is_active, i.sort_order AS ingredient_sort_order,
            i.created_at AS ingredient_created_at, i.updated_at AS ingredient_updated_at
     FROM product_ingredient_recipes_v2 r
     JOIN ingredients_v2 i ON i.id = r.ingredient_id
     WHERE r.product_sku = ?
     ORDER BY i.sort_order ASC, i.name ASC`,
    )
    .bind(sku)
    .all();
  return (result.results ?? []).map(mapD1Recipe);
};

export const onRequestGet: PagesFunction<Env> = async ({
  env,
  request,
  params,
}) => {
  if (!env.BOG_MENU_DB)
    return errorResponse(
      503,
      "D1_NOT_CONFIGURED",
      "BOG_MENU_DB no está configurado.",
    );
  const authError = await requireAdminToken(request, env);
  if (authError) return authError;
  const sku = normalizeSku(params.sku);
  if (!sku) return errorResponse(400, "INVALID_SKU", "Producto inválido.");
  return json(200, {
    ok: true,
    data: { productSku: sku, recipes: await loadRecipes(env.BOG_MENU_DB, sku) },
  });
};

const parseRecipeInputs = (
  body: Record<string, unknown>,
): RecipeInput[] | Response => {
  const raw = Array.isArray(body.recipes) ? body.recipes : [];
  const seen = new Set<string>();
  const recipes: RecipeInput[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry))
      return errorResponse(400, "INVALID_RECIPE", "Receta inválida.");
    const item = entry as Record<string, unknown>;
    const ingredientId = String(
      item.ingredientId ?? item.ingredient_id ?? "",
    ).trim();
    const quantityPerUnit = Number(
      item.quantityPerUnit ?? item.quantity_per_unit,
    );
    if (
      !ingredientId ||
      !Number.isFinite(quantityPerUnit) ||
      quantityPerUnit <= 0
    )
      return errorResponse(
        400,
        "INVALID_RECIPE",
        "Cantidad por producto inválida.",
      );
    if (!seen.has(ingredientId)) {
      seen.add(ingredientId);
      recipes.push({ ingredientId, quantityPerUnit });
    }
  }
  return recipes;
};

export const onRequestPatch: PagesFunction<Env> = async ({
  env,
  request,
  params,
}) => {
  if (!env.BOG_MENU_DB)
    return errorResponse(
      503,
      "D1_NOT_CONFIGURED",
      "BOG_MENU_DB no está configurado.",
    );
  const authError = await requireAdminToken(request, env);
  if (authError) return authError;
  const sku = normalizeSku(params.sku);
  if (!sku) return errorResponse(400, "INVALID_SKU", "Producto inválido.");
  const db = env.BOG_MENU_DB;
  const product = await db
    .prepare("SELECT sku FROM menu_items WHERE sku = ? LIMIT 1")
    .bind(sku)
    .first();
  if (!product)
    return errorResponse(404, "PRODUCT_NOT_FOUND", "Producto no encontrado.");
  const body = await parseJsonObject(request);
  if (!body) return errorResponse(400, "INVALID_JSON", "JSON inválido.");
  const recipes = parseRecipeInputs(body);
  if (recipes instanceof Response) return recipes;

  if (recipes.length) {
    const placeholders = recipes.map(() => "?").join(", ");
    const ingredientResult = await db
      .prepare(`SELECT id FROM ingredients_v2 WHERE id IN (${placeholders})`)
      .bind(...recipes.map((recipe) => recipe.ingredientId))
      .all<{ id: string }>();
    const validIds = new Set(
      (ingredientResult.results ?? []).map((row) => String(row.id)),
    );
    if (validIds.size !== recipes.length)
      return errorResponse(
        400,
        "INGREDIENT_NOT_FOUND",
        "Uno o más ingredientes no existen.",
      );
  }

  const statements = [
    db
      .prepare(
        "DELETE FROM product_ingredient_recipes_v2 WHERE product_sku = ?",
      )
      .bind(sku),
  ];
  recipes.forEach((recipe) => {
    statements.push(
      db
        .prepare(
          `INSERT INTO product_ingredient_recipes_v2 (id, product_sku, ingredient_id, quantity_per_unit) VALUES (?, ?, ?, ?)`,
        )
        .bind(
          generateId("rec"),
          sku,
          recipe.ingredientId,
          recipe.quantityPerUnit,
        ),
    );
  });
  await db.batch(statements);
  return json(200, {
    ok: true,
    data: { productSku: sku, recipes: await loadRecipes(db, sku) },
  });
};

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method === "GET") return onRequestGet(context);
  if (context.request.method === "PATCH") return onRequestPatch(context);
  return errorResponse(405, "METHOD_NOT_ALLOWED", "Use GET o PATCH.");
};
