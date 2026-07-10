import type { MenuCategory, MenuItem } from "@config/index";

export type CatalogProductType = "burger" | "combo" | "side" | "topping" | "drink";

export type CatalogProduct = {
  id: string;
  type: CatalogProductType;
  categoryId: string;
  categoryKey: MenuCategory["key"];
  categoryName: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  imageKey?: string;
  badge?: string;
  isAvailable: boolean;
  sortOrder: number;
};

export function mapMenuCategoryToCatalogProductType(category: MenuCategory["key"]): CatalogProductType {
  if (category === "burgers") return "burger";
  if (category === "combos") return "combo";
  if (category === "guarniciones") return "side";
  if (category === "drinks") return "drink";
  return "topping";
}

export function mapMenuItemsToCatalogProducts(items: MenuItem[], categories: MenuCategory[]): CatalogProduct[] {
  const categoryByKey = new Map(categories.map((category) => [category.key, category]));

  return items
    .map((item) => {
      const category = categoryByKey.get(item.category);

      return {
        id: item.sku,
        type: mapMenuCategoryToCatalogProductType(item.category),
        categoryId: category?.id ?? item.category,
        categoryKey: item.category,
        categoryName: category?.name ?? item.category,
        name: item.name,
        description: item.description,
        price: item.price,
        imageUrl: item.imageUrl,
        imageKey: item.imageKey,
        badge: item.badge ?? item.promoLabel,
        isAvailable: item.isAvailable,
        sortOrder: item.sortOrder
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}
