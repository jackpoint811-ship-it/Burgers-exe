import { useEffect, useMemo, useRef, useState } from 'react';
import type { IngredientV2, MenuCategory, MenuCategoryBanner, MenuItem, MenuV2Response, ProductIngredientRecipeV2, PromoCard as PromoCardType } from '@config/index';
import { Button, Card } from '@ui/index';
import { createIngredientV2Admin, fetchIngredientsV2Admin, fetchProductRecipeV2Admin, saveProductRecipeV2Admin, updateIngredientV2Admin } from '../lib/ingredients-v2-admin';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const ACCEPTED_IMAGE_TYPES_LABEL = 'JPG, PNG, WebP o AVIF hasta 5 MB';

type CatalogTab = 'items' | 'promos' | 'banners' | 'ingredients';
type EditForm = { sku: string; name: string; description: string; price: string; category: MenuCategory['key']; isAvailable: boolean; badge: string; promoLabel: string; sortOrder: string; imageUrl: string; imageKey: string; stockManaged: boolean; stockLimit: string; stockRemaining: string };
type PromoEditForm = { title: string; description: string; badge: string; promoLabel: string; isAvailable: boolean; isFeatured: boolean; sortOrder: string; imageUrl: string; imageKey: string };
type ItemImageMutationResponse = { ok?: boolean; error?: string; warning?: string; item?: MenuItem; imageKey?: string; assetUrl?: string; removed?: boolean };
type PromoMutationResponse = { ok?: boolean; error?: string; warning?: string; promo?: PromoCardType; imageKey?: string; assetUrl?: string; removed?: boolean };
type ItemAvailabilityMutationResponse = { ok?: boolean; error?: string; item?: MenuItem };
type CategoryBannerForm = { categoryKey: MenuCategory['key']; title: string; subtitle: string; imageUrl: string; imageKey: string };
type CategoryBannerMutationResponse = { ok?: boolean; error?: string; banner?: MenuCategoryBanner };
type IngredientForm = { id?: string; name: string; unit: string; unitPrice: string; isActive: boolean; sortOrder: string };
type RecipeFormRow = { ingredientId: string; quantityPerUnit: string };
const INGREDIENT_UNITS = ['pieza', 'g', 'kg', 'ml', 'l', 'paquete', 'bolsa'];
const emptyIngredientForm = (): IngredientForm => ({ name: '', unit: 'pieza', unitPrice: '', isActive: true, sortOrder: '0' });
const centsToPesoInput = (cents: number | null) => cents == null ? '' : String(cents / 100);
const pesoInputToCents = (value: string) => { const trimmed = value.trim(); if (!trimmed) return null; const parsed = Number(trimmed); return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : null; };
const ingredientToForm = (ingredient: IngredientV2): IngredientForm => ({ id: ingredient.id, name: ingredient.name, unit: ingredient.unit, unitPrice: centsToPesoInput(ingredient.unitPriceCents), isActive: ingredient.isActive, sortOrder: String(ingredient.sortOrder) });
const recipeToFormRow = (recipe: ProductIngredientRecipeV2): RecipeFormRow => ({ ingredientId: recipe.ingredientId, quantityPerUnit: String(recipe.quantityPerUnit) });

const ITEM_CATEGORY_ORDER: MenuCategory['key'][] = ['burgers', 'combos', 'guarniciones', 'drinks', 'extras'];
const ITEM_CATEGORY_LABELS: Record<MenuCategory['key'], string> = {
  burgers: 'burgers',
  combos: 'combos',
  guarniciones: 'guarniciones',
  extras: 'extras',
  drinks: 'drinks'
};

const isItemCategoryKey = (value: string): value is MenuCategory['key'] =>
  ITEM_CATEGORY_ORDER.includes(value as MenuCategory['key']);

const getAssetUrl = (imageUrl?: string, imageKey?: string): string | undefined => {
  const trimmedUrl = imageUrl?.trim();
  if (trimmedUrl && ((trimmedUrl.startsWith('/') && !trimmedUrl.startsWith('//')) || trimmedUrl.startsWith('https://'))) return trimmedUrl;
  const trimmedKey = imageKey?.trim();
  if (!trimmedKey) return undefined;
  return `/api/assets-v2/${trimmedKey.split('/').map((segment) => encodeURIComponent(segment)).join('/')}`;
};

const validateImageRefs = (imageUrlRaw: string, imageKeyRaw: string): string | null => {
  const imageUrl = imageUrlRaw.trim();
  if (imageUrl && !((imageUrl.startsWith('/') && !imageUrl.startsWith('//')) || imageUrl.startsWith('https://'))) return 'Image URL debe empezar con / o https://';
  const imageKey = imageKeyRaw.trim();
  if (imageKey && (imageKey.includes('..') || imageKey.includes('\\') || imageKey.includes('//'))) return 'Image key no debe contener .., \\ ni //';
  if (imageKey && !/\.(jpe?g|png|webp|avif)$/i.test(imageKey)) return 'Image key debe terminar en .jpg, .jpeg, .png, .webp o .avif';
  return null;
};

const validateSelectedFile = (file: File | null): string | null => {
  if (!file) return 'Selecciona una imagen primero';
  if (file.size > MAX_IMAGE_BYTES) return 'La imagen debe pesar 5 MB o menos';
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) return `Tipo no permitido. Usa ${ACCEPTED_IMAGE_TYPES_LABEL}.`;
  return null;
};

export function CatalogAdminPanel() {
  const [menu, setMenu] = useState<MenuV2Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [catalogTab, setCatalogTab] = useState<CatalogTab>('items');
  const [query, setQuery] = useState('');
  const [promoQuery, setPromoQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [availability, setAvailability] = useState('all');
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [creatingItem, setCreatingItem] = useState(false);
  const [editingPromo, setEditingPromo] = useState<PromoCardType | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [promoForm, setPromoForm] = useState<PromoEditForm | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [availabilitySavingSku, setAvailabilitySavingSku] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [removingImage, setRemovingImage] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [promoSaveError, setPromoSaveError] = useState<string | null>(null);
  const [promoImageError, setPromoImageError] = useState<string | null>(null);
  const [promoSaving, setPromoSaving] = useState(false);
  const [promoUploading, setPromoUploading] = useState(false);
  const [promoRemovingImage, setPromoRemovingImage] = useState(false);
  const [selectedPromoFile, setSelectedPromoFile] = useState<File | null>(null);
  const [bannerForm, setBannerForm] = useState<CategoryBannerForm>({ categoryKey: 'burgers', title: '', subtitle: '', imageUrl: '', imageKey: '' });
  const [bannerSaving, setBannerSaving] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [ingredients, setIngredients] = useState<IngredientV2[]>([]);
  const [ingredientsLoading, setIngredientsLoading] = useState(false);
  const [ingredientForm, setIngredientForm] = useState<IngredientForm>(emptyIngredientForm);
  const [ingredientSaving, setIngredientSaving] = useState(false);
  const [ingredientError, setIngredientError] = useState<string | null>(null);
  const [selectedRecipeSku, setSelectedRecipeSku] = useState('');
  const [recipeRows, setRecipeRows] = useState<RecipeFormRow[]>([]);
  const [recipeLoading, setRecipeLoading] = useState(false);
  const [recipeSaving, setRecipeSaving] = useState(false);
  const [recipeError, setRecipeError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const promoFileInputRef = useRef<HTMLInputElement | null>(null);

  const loadMenu = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/menu-v2', { cache: 'no-store', headers: { accept: 'application/json' } });
      const data = (await res.json()) as MenuV2Response;
      setMenu(data);
    } catch {
      setError('No se pudo cargar el catálogo');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadMenu();
  }, []);

  const filtered = useMemo(() => {
    const list = menu?.items ?? [];
    return list.filter((item) => {
      const textOk = !query || [item.sku, item.name, item.description].join(' ').toLowerCase().includes(query.toLowerCase());
      const catOk = category === 'all' || item.category === category;
      const availabilityOk = availability === 'all' || (availability === 'available' ? item.isAvailable : !item.isAvailable);
      return textOk && catOk && availabilityOk;
    });
  }, [menu, query, category, availability]);

  const groupedFilteredItems = useMemo(() => {
    const existingCategories = new Set((menu?.items ?? []).map((item) => item.category));
    const selectedCategory = isItemCategoryKey(category) ? category : null;
    return ITEM_CATEGORY_ORDER
      .filter((key) => selectedCategory ? key === selectedCategory : existingCategories.has(key))
      .map((key) => ({
        key,
        label: ITEM_CATEGORY_LABELS[key],
        items: filtered.filter((item) => item.category === key).sort((a, b) => a.sortOrder - b.sortOrder)
      }));
  }, [category, filtered, menu?.items]);

  const filteredPromos = useMemo(() => {
    const q = promoQuery.toLowerCase();
    return (menu?.promos ?? []).filter((promo) => !q || [promo.id, promo.title, promo.description, promo.badge, promo.promoLabel].join(' ').toLowerCase().includes(q));
  }, [menu, promoQuery]);

  const sourceLabel = menu?.source === 'd1' ? 'Listo para editar' : menu?.source === 'fallback' ? 'Vista local' : 'Vista local';
  const canEdit = Boolean(menu?.source === 'd1');
  const imagePreviewUrl = getAssetUrl(form?.imageUrl, form?.imageKey);
  const promoImagePreviewUrl = getAssetUrl(promoForm?.imageUrl, promoForm?.imageKey);
  const imageBusy = uploading || removingImage;
  const promoImageBusy = promoUploading || promoRemovingImage;

  const beginEdit = (item: MenuItem) => {
    setCreatingItem(false);
    setEditing(item);
    setForm({ sku: item.sku, name: item.name, description: item.description, price: String(item.price), category: item.category, isAvailable: item.isAvailable, badge: item.badge ?? '', promoLabel: item.promoLabel ?? '', sortOrder: String(item.sortOrder), imageUrl: item.imageUrl ?? '', imageKey: item.imageKey ?? '', stockManaged: Boolean(item.stockManaged), stockLimit: item.stockLimit == null ? '' : String(item.stockLimit), stockRemaining: item.stockRemaining == null ? '' : String(item.stockRemaining) });
    setSelectedFile(null);
    setSaveError(null);
    setImageError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };


  const beginCreate = () => {
    setCreatingItem(true);
    setEditing(null);
    setForm({ sku: '', name: '', description: '', price: '0', category: 'burgers', isAvailable: true, badge: '', promoLabel: '', sortOrder: '0', imageUrl: '', imageKey: '', stockManaged: false, stockLimit: '', stockRemaining: '' });
    setSelectedFile(null);
    setSaveError(null);
    setImageError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const beginPromoEdit = (promo: PromoCardType) => {
    setEditingPromo(promo);
    setPromoForm({ title: promo.title, description: promo.description, badge: promo.badge ?? '', promoLabel: promo.promoLabel ?? '', isAvailable: promo.isAvailable, isFeatured: promo.isFeatured, sortOrder: String(promo.sortOrder), imageUrl: promo.asset.imageUrl ?? '', imageKey: promo.asset.imageKey ?? '' });
    setSelectedPromoFile(null);
    setPromoSaveError(null);
    setPromoImageError(null);
    if (promoFileInputRef.current) promoFileInputRef.current.value = '';
  };

  const closeEditor = () => {
    if (saving || imageBusy) return;
    setCreatingItem(false);
    setEditing(null);
    setForm(null);
    setSelectedFile(null);
    setSaveError(null);
    setImageError(null);
  };

  const closePromoEditor = () => {
    if (promoSaving || promoImageBusy) return;
    setEditingPromo(null);
    setPromoForm(null);
    setSelectedPromoFile(null);
    setPromoSaveError(null);
    setPromoImageError(null);
  };

  const validationError = useMemo(() => {
    if (!form) return null;
    if (creatingItem && !/^[A-Z0-9][A-Z0-9-]{1,48}[A-Z0-9]$/.test(form.sku.trim().toUpperCase())) return 'SKU requerido en uppercase/kebab seguro';
    if (!form.name.trim()) return 'Nombre requerido';
    if (!form.description.trim()) return 'Descripción requerida';
    if (!(Number(form.price) >= 0)) return 'Precio debe ser 0 o mayor';
    if (!isItemCategoryKey(form.category)) return 'Categoría inválida';
    if (!Number.isInteger(Number(form.sortOrder))) return 'Orden debe ser entero';
    if (form.stockManaged && (!Number.isInteger(Number(form.stockRemaining)) || Number(form.stockRemaining) < 0)) return 'Stock disponible debe ser entero >= 0';
    if (form.stockManaged && form.stockLimit && (!Number.isInteger(Number(form.stockLimit)) || Number(form.stockLimit) < 0)) return 'Stock límite debe ser entero >= 0';
    return validateImageRefs(form.imageUrl, form.imageKey);
  }, [form, creatingItem]);

  const promoValidationError = useMemo(() => {
    if (!promoForm) return null;
    if (!promoForm.title.trim()) return 'Título requerido';
    if (!promoForm.description.trim()) return 'Descripción requerida';
    if (!Number.isInteger(Number(promoForm.sortOrder))) return 'Orden debe ser entero';
    return validateImageRefs(promoForm.imageUrl, promoForm.imageKey);
  }, [promoForm]);

  const updateEditedImageFromItem = (item: MenuItem) => {
    setEditing(item);
    setForm((current) => current ? { ...current, imageUrl: item.imageUrl ?? '', imageKey: item.imageKey ?? '' } : current);
    setMenu((current) => current ? { ...current, items: current.items.map((entry) => (entry.sku === item.sku ? item : entry)) } : current);
  };

  const updateEditedPromo = (promo: PromoCardType) => {
    setEditingPromo(promo);
    setPromoForm((current) => current ? { ...current, imageUrl: promo.asset.imageUrl ?? '', imageKey: promo.asset.imageKey ?? '' } : current);
    setMenu((current) => current ? { ...current, promos: current.promos.map((entry) => (entry.id === promo.id ? promo : entry)) } : current);
  };

  const onFileChange = (file: File | null) => {
    setSelectedFile(file);
    setImageError(validateSelectedFile(file));
  };

  const onPromoFileChange = (file: File | null) => {
    setSelectedPromoFile(file);
    setPromoImageError(validateSelectedFile(file));
  };

  const onUploadImage = async () => {
    if (!editing || !form) return;

    if (menu?.source !== 'd1') { setImageError('La carga de imágenes requiere catálogo editable'); return; }
    const fileError = validateSelectedFile(selectedFile);
    if (fileError || !selectedFile) { setImageError(fileError); return; }

    setUploading(true);
    setImageError(null);
    try {
      const body = new FormData();
      body.append('file', selectedFile);
      const res = await fetch(`/api/menu-v2-admin/items/${encodeURIComponent(editing.sku)}/image`, { method: 'POST', credentials: 'include', body });
      const data = (await res.json()) as ItemImageMutationResponse;
      if (!res.ok || !data.ok || !data.item) throw new Error(data.error ?? 'Error al subir imagen');
      updateEditedImageFromItem(data.item);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setNotice(data.warning ? `Imagen actualizada (${data.warning})` : 'Imagen actualizada');
      await loadMenu();
    } catch (e) {
      setImageError(e instanceof Error ? e.message : 'Error al subir imagen');
    } finally {
      setUploading(false);
    }
  };

  const onPromoUploadImage = async () => {
    if (!editingPromo || !promoForm) return;

    if (menu?.source !== 'd1') { setPromoImageError('La carga de imágenes requiere catálogo editable'); return; }
    const fileError = validateSelectedFile(selectedPromoFile);
    if (fileError || !selectedPromoFile) { setPromoImageError(fileError); return; }

    setPromoUploading(true);
    setPromoImageError(null);
    try {
      const body = new FormData();
      body.append('file', selectedPromoFile);
      const res = await fetch(`/api/menu-v2-admin/promos/${encodeURIComponent(editingPromo.id)}/image`, { method: 'POST', credentials: 'include', body });
      const data = (await res.json()) as PromoMutationResponse;
      if (!res.ok || !data.ok || !data.promo) throw new Error(data.error ?? 'Error al subir imagen de promo');
      updateEditedPromo(data.promo);
      setSelectedPromoFile(null);
      if (promoFileInputRef.current) promoFileInputRef.current.value = '';
      setNotice(data.warning ? `Imagen de promo actualizada (${data.warning})` : 'Imagen de promo actualizada');
      await loadMenu();
    } catch (e) {
      setPromoImageError(e instanceof Error ? e.message : 'Error al subir imagen de promo');
    } finally {
      setPromoUploading(false);
    }
  };

  const onRemoveImage = async () => {
    if (!editing || !form) return;

    if (menu?.source !== 'd1') { setImageError('La eliminación de imágenes requiere catálogo editable'); return; }

    setRemovingImage(true);
    setImageError(null);
    try {
      const res = await fetch(`/api/menu-v2-admin/items/${encodeURIComponent(editing.sku)}/image`, { method: 'DELETE', credentials: 'include' });
      const data = (await res.json()) as ItemImageMutationResponse;
      if (!res.ok || !data.ok || !data.item) throw new Error(data.error ?? 'Error al quitar imagen');
      updateEditedImageFromItem(data.item);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setNotice(data.warning ? `Imagen quitada; placeholder activo (${data.warning})` : 'Imagen quitada; placeholder activo');
      await loadMenu();
    } catch (e) {
      setImageError(e instanceof Error ? e.message : 'Error al quitar imagen');
    } finally {
      setRemovingImage(false);
    }
  };

  const onPromoRemoveImage = async () => {
    if (!editingPromo || !promoForm) return;

    if (menu?.source !== 'd1') { setPromoImageError('La eliminación de imágenes requiere catálogo editable'); return; }

    setPromoRemovingImage(true);
    setPromoImageError(null);
    try {
      const res = await fetch(`/api/menu-v2-admin/promos/${encodeURIComponent(editingPromo.id)}/image`, { method: 'DELETE', credentials: 'include' });
      const data = (await res.json()) as PromoMutationResponse;
      if (!res.ok || !data.ok || !data.promo) throw new Error(data.error ?? 'Error al quitar imagen de promo');
      updateEditedPromo(data.promo);
      setSelectedPromoFile(null);
      if (promoFileInputRef.current) promoFileInputRef.current.value = '';
      setNotice(data.warning ? `Imagen de promo quitada; placeholder activo (${data.warning})` : 'Imagen de promo quitada; placeholder activo');
      await loadMenu();
    } catch (e) {
      setPromoImageError(e instanceof Error ? e.message : 'Error al quitar imagen de promo');
    } finally {
      setPromoRemovingImage(false);
    }
  };


  const setItemAvailability = async (item: MenuItem, isAvailable: boolean) => {
    if (!canEdit || availabilitySavingSku) return;
    setAvailabilitySavingSku(item.sku);
    setNotice(null);
    setError(null);
    try {
      const res = await fetch(`/api/menu-v2-admin/items/${encodeURIComponent(item.sku)}/availability`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ isAvailable })
      });
      const data = (await res.json()) as ItemAvailabilityMutationResponse;
      if (!res.ok || !data.ok || !data.item) throw new Error(data.error ?? 'Error al actualizar disponibilidad');
      const updatedItem = data.item;
      setMenu((current) => current ? { ...current, items: current.items.map((entry) => (entry.sku === updatedItem.sku ? updatedItem : entry)), updatedAt: updatedItem.updatedAt ?? current.updatedAt } : current);
      if (editing?.sku === updatedItem.sku) {
        setEditing(updatedItem);
        setForm((current) => current ? { ...current, isAvailable: updatedItem.isAvailable } : current);
      }
      setNotice(`${updatedItem.sku} marcado como ${updatedItem.isAvailable ? 'Disponible' : 'Agotado'}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al actualizar disponibilidad');
    } finally {
      setAvailabilitySavingSku(null);
    }
  };

  const onSave = async () => {
    if ((!editing && !creatingItem) || !form || validationError) return;
    setSaving(true);
    setSaveError(null);
    try {
      const endpoint = creatingItem ? '/api/menu-v2-admin/items' : `/api/menu-v2-admin/items/${encodeURIComponent(editing!.sku)}`;
      const res = await fetch(endpoint, {
        method: creatingItem ? 'POST' : 'PATCH',
        credentials: 'include', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sku: form.sku, name: form.name, description: form.description, price: Number(form.price), category: form.category, isAvailable: form.isAvailable, badge: form.badge || null, promoLabel: form.promoLabel || null, sortOrder: Number(form.sortOrder), imageUrl: form.imageUrl || null, imageKey: form.imageKey || null, stockManaged: form.stockManaged, stockLimit: form.stockLimit === '' ? null : Number(form.stockLimit), stockRemaining: form.stockRemaining === '' ? null : Number(form.stockRemaining) })
      });
      const data: unknown = await res.json();
      const response = (data && typeof data === 'object') ? (data as { ok?: boolean; error?: string }) : {};
      if (!res.ok || !response.ok) throw new Error(response.error ?? 'Error al actualizar producto');
      const createdOrUpdated = (response as { item?: MenuItem }).item;
      setCreatingItem(false);
      setEditing(null);
      setForm(null);
      setSelectedFile(null);
      setNotice(creatingItem ? `Producto ${createdOrUpdated?.sku ?? ''} creado` : 'Producto actualizado');
      await loadMenu();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Error al actualizar producto');
    } finally {
      setSaving(false);
    }
  };

  const onPromoSave = async () => {
    if (!editingPromo || !promoForm || promoValidationError) return;

    if (menu?.source !== 'd1') { setPromoSaveError('La edición requiere catálogo editable'); return; }

    setPromoSaving(true);
    setPromoSaveError(null);
    try {
      const res = await fetch(`/api/menu-v2-admin/promos/${encodeURIComponent(editingPromo.id)}`, {
        method: 'PATCH',
        credentials: 'include', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: promoForm.title, description: promoForm.description, badge: promoForm.badge || null, promoLabel: promoForm.promoLabel || null, isAvailable: promoForm.isAvailable, isFeatured: promoForm.isFeatured, sortOrder: Number(promoForm.sortOrder), imageUrl: promoForm.imageUrl || null, imageKey: promoForm.imageKey || null })
      });
      const data = (await res.json()) as PromoMutationResponse;
      if (!res.ok || !data.ok || !data.promo) throw new Error(data.error ?? 'Error al actualizar promo');
      setEditingPromo(null);
      setPromoForm(null);
      setSelectedPromoFile(null);
      setNotice('Promo actualizada');
      await loadMenu();
    } catch (e) {
      setPromoSaveError(e instanceof Error ? e.message : 'Error al actualizar promo');
    } finally {
      setPromoSaving(false);
    }
  };


  const onBannerSave = async () => {
    if (!canEdit || bannerSaving) return;
    const refError = validateImageRefs(bannerForm.imageUrl, bannerForm.imageKey);
    if (refError) { setBannerError(refError); return; }
    setBannerSaving(true);
    setBannerError(null);
    try {
      const res = await fetch('/api/menu-v2-admin/category-banners', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...bannerForm, title: bannerForm.title || null, subtitle: bannerForm.subtitle || null, imageUrl: bannerForm.imageUrl || null, imageKey: bannerForm.imageKey || null })
      });
      const data = (await res.json()) as CategoryBannerMutationResponse;
      if (!res.ok || !data.ok || !data.banner) throw new Error(data.error ?? 'Error al guardar banner');
      setMenu((current) => current ? { ...current, categoryBanners: [...(current.categoryBanners ?? []).filter((entry) => entry.categoryKey !== data.banner!.categoryKey), data.banner!] } : current);
      setNotice('Banner de categoría actualizado');
    } catch (e) {
      setBannerError(e instanceof Error ? e.message : 'Error al guardar banner');
    } finally {
      setBannerSaving(false);
    }
  };



  const loadIngredients = async () => { setIngredientsLoading(true); setIngredientError(null); try { setIngredients(await fetchIngredientsV2Admin()); } catch (err) { setIngredientError(err instanceof Error ? err.message : 'No se pudieron cargar ingredientes cuantificables'); } finally { setIngredientsLoading(false); } };
  useEffect(() => { if (catalogTab === 'ingredients') void loadIngredients(); }, [catalogTab]);
  const productOptions = useMemo(() => (menu?.items ?? []).filter((item) => ['burgers', 'combos', 'guarniciones'].includes(item.category)).sort((a, b) => a.category.localeCompare(b.category) || a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)), [menu]);
  useEffect(() => { if (catalogTab !== 'ingredients' || selectedRecipeSku || !productOptions.length) return; setSelectedRecipeSku(productOptions[0].sku); }, [catalogTab, productOptions, selectedRecipeSku]);
  useEffect(() => { if (catalogTab !== 'ingredients' || !selectedRecipeSku) return; setRecipeLoading(true); setRecipeError(null); fetchProductRecipeV2Admin(selectedRecipeSku).then((recipes) => setRecipeRows(recipes.map(recipeToFormRow))).catch((err) => setRecipeError(err instanceof Error ? err.message : 'No se pudo cargar la receta aproximada')).finally(() => setRecipeLoading(false)); }, [catalogTab, selectedRecipeSku]);
  const saveIngredient = async () => { const name = ingredientForm.name.trim(); const unitPriceCents = pesoInputToCents(ingredientForm.unitPrice); const sortOrder = Number(ingredientForm.sortOrder); if (name.length < 2) { setIngredientError('Captura un nombre de ingrediente.'); return; } if (ingredientForm.unitPrice.trim() && unitPriceCents === null) { setIngredientError('Precio por unidad inválido.'); return; } if (!Number.isInteger(sortOrder)) { setIngredientError('Orden inválido.'); return; } setIngredientSaving(true); setIngredientError(null); try { const payload = { name, unit: ingredientForm.unit, unitPriceCents, isActive: ingredientForm.isActive, sortOrder }; if (ingredientForm.id) await updateIngredientV2Admin(ingredientForm.id, payload); else await createIngredientV2Admin(payload); setIngredientForm(emptyIngredientForm()); setNotice('Ingrediente cuantificable guardado.'); await loadIngredients(); } catch (err) { setIngredientError(err instanceof Error ? err.message : 'No se pudo guardar ingrediente'); } finally { setIngredientSaving(false); } };
  const toggleIngredientActive = async (ingredient: IngredientV2) => { setIngredientError(null); try { await updateIngredientV2Admin(ingredient.id, { isActive: !ingredient.isActive }); await loadIngredients(); } catch (err) { setIngredientError(err instanceof Error ? err.message : 'No se pudo cambiar activo/inactivo'); } };
  const saveRecipe = async () => { if (!selectedRecipeSku) return; const recipes = recipeRows.map((row) => ({ ingredientId: row.ingredientId, quantityPerUnit: Number(row.quantityPerUnit) })).filter((row) => row.ingredientId && Number.isFinite(row.quantityPerUnit) && row.quantityPerUnit > 0); setRecipeSaving(true); setRecipeError(null); try { const saved = await saveProductRecipeV2Admin(selectedRecipeSku, recipes); setRecipeRows(saved.map(recipeToFormRow)); setNotice('Receta aproximada por producto guardada.'); } catch (err) { setRecipeError(err instanceof Error ? err.message : 'No se pudo guardar receta aproximada'); } finally { setRecipeSaving(false); } };
  const ingredientsPanel = catalogTab === 'ingredients' ? <div className='grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]'><Card className='border-emerald-500/20 bg-zinc-950/90 p-4'><h3 className='text-lg font-black text-emerald-100'>Ingredientes cuantificables</h3><p className='mt-1 text-sm text-zinc-400'>Administra insumos medibles como carne, pan, queso, tocino, papas o aros.</p><div className='mt-4 grid gap-3'><label className='text-xs uppercase tracking-widest text-zinc-300'>Nombre<input className='input md:mt-1' value={ingredientForm.name} onChange={(e) => setIngredientForm({ ...ingredientForm, name: e.target.value })} placeholder='Carne smash' /></label><div className='grid gap-3 sm:grid-cols-2'><label className='text-xs uppercase tracking-widest text-zinc-300'>Unidad<select className='input md:mt-1' value={ingredientForm.unit} onChange={(e) => setIngredientForm({ ...ingredientForm, unit: e.target.value })}>{INGREDIENT_UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select></label><label className='text-xs uppercase tracking-widest text-zinc-300'>Costo estimado<input className='input md:mt-1' inputMode='decimal' value={ingredientForm.unitPrice} onChange={(e) => setIngredientForm({ ...ingredientForm, unitPrice: e.target.value })} placeholder='0.00 opcional' /></label></div><div className='grid gap-3 sm:grid-cols-2'><label className='text-xs uppercase tracking-widest text-zinc-300'>Orden<input className='input md:mt-1' inputMode='numeric' value={ingredientForm.sortOrder} onChange={(e) => setIngredientForm({ ...ingredientForm, sortOrder: e.target.value })} /></label><label className='flex min-h-11 items-center gap-2 text-sm text-zinc-200'><input type='checkbox' checked={ingredientForm.isActive} onChange={(e) => setIngredientForm({ ...ingredientForm, isActive: e.target.checked })} /> Activo</label></div>{ingredientError ? <p className='rounded-lg border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-100'>{ingredientError}</p> : null}<div className='flex gap-2'><Button className='flex-1 border border-zinc-700 bg-zinc-900' onClick={() => setIngredientForm(emptyIngredientForm())}>Limpiar</Button><Button className='flex-1 bg-emerald-300 text-emerald-950 disabled:opacity-40' disabled={ingredientSaving} onClick={saveIngredient}>{ingredientSaving ? 'Guardando…' : ingredientForm.id ? 'Guardar edición' : 'Crear ingrediente'}</Button></div></div><div className='mt-4 space-y-2'>{ingredientsLoading ? <p className='text-sm text-zinc-400'>Cargando ingredientes…</p> : ingredients.map((ingredient) => <div key={ingredient.id} className='rounded-xl border border-zinc-800 bg-zinc-900/70 p-3'><div className='flex items-start justify-between gap-2'><div><p className='font-bold text-zinc-100'>{ingredient.name}</p><p className='text-xs text-zinc-400'>{ingredient.unit} · {ingredient.unitPriceCents == null ? 'sin costo estimado' : `$${(ingredient.unitPriceCents / 100).toFixed(2)}`} · orden {ingredient.sortOrder}</p></div><span className={`rounded-full border px-2 py-1 text-[11px] font-bold ${ingredient.isActive ? 'border-emerald-400/40 text-emerald-200' : 'border-zinc-600 text-zinc-400'}`}>{ingredient.isActive ? 'Activo' : 'Inactivo'}</span></div><div className='mt-2 flex gap-2'><Button className='flex-1 border border-zinc-700 bg-zinc-950' onClick={() => setIngredientForm(ingredientToForm(ingredient))}>Editar</Button><Button className='flex-1 border border-zinc-700 bg-zinc-950' onClick={() => void toggleIngredientActive(ingredient)}>{ingredient.isActive ? 'Desactivar' : 'Activar'}</Button></div></div>)}</div></Card><Card className='border-cyan-500/20 bg-zinc-950/90 p-4'><h3 className='text-lg font-black text-cyan-100'>Receta aproximada por producto</h3><p className='mt-1 text-sm text-zinc-400'>Asigna ingredientes y cantidad por producto. No modifica stock ni precios del menú.</p><label className='mt-4 block text-xs uppercase tracking-widest text-zinc-300'>Producto<select className='input md:mt-1' value={selectedRecipeSku} onChange={(e) => setSelectedRecipeSku(e.target.value)}>{productOptions.map((item) => <option key={item.sku} value={item.sku}>{item.name} · {item.category}</option>)}</select></label><div className='mt-4 space-y-2'>{recipeLoading ? <p className='text-sm text-zinc-400'>Cargando receta…</p> : recipeRows.map((row, index) => <div key={`${row.ingredientId}-${index}`} className='grid gap-2 rounded-xl border border-zinc-800 bg-zinc-900/70 p-3 sm:grid-cols-[1fr_0.6fr_auto]'><label className='text-xs uppercase tracking-widest text-zinc-300'>Ingrediente<select className='input md:mt-1' value={row.ingredientId} onChange={(e) => setRecipeRows((rows) => rows.map((entry, i) => i === index ? { ...entry, ingredientId: e.target.value } : entry))}><option value=''>Selecciona</option>{ingredients.filter((ingredient) => ingredient.isActive).map((ingredient) => <option key={ingredient.id} value={ingredient.id}>{ingredient.name} · {ingredient.unit}</option>)}</select></label><label className='text-xs uppercase tracking-widest text-zinc-300'>Cantidad por producto<input className='input md:mt-1' inputMode='decimal' value={row.quantityPerUnit} onChange={(e) => setRecipeRows((rows) => rows.map((entry, i) => i === index ? { ...entry, quantityPerUnit: e.target.value } : entry))} placeholder='1' /></label><Button className='min-h-11 self-end border border-rose-700 bg-zinc-950 text-rose-200' onClick={() => setRecipeRows((rows) => rows.filter((_, i) => i !== index))}>Quitar</Button></div>)}</div>{recipeError ? <p className='mt-3 rounded-lg border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-100'>{recipeError}</p> : null}<div className='mt-4 flex flex-col gap-2 sm:flex-row'><Button className='flex-1 border border-zinc-700 bg-zinc-900' onClick={() => setRecipeRows((rows) => [...rows, { ingredientId: '', quantityPerUnit: '' }])}>Agregar ingrediente</Button><Button className='flex-1 bg-cyan-300 text-cyan-950 disabled:opacity-40' disabled={recipeSaving || !selectedRecipeSku} onClick={saveRecipe}>{recipeSaving ? 'Guardando…' : 'Guardar receta'}</Button></div>{!recipeRows.length ? <p className='mt-4 rounded-xl border border-dashed border-zinc-700 p-4 text-sm text-zinc-400'>Este producto todavía no tiene receta aproximada.</p> : null}</Card></div> : null;

  return <section className='space-y-2'>
    <Card className='p-3'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div><h3 className='font-bold'>Catálogo</h3><p className='muted'>Estado: {sourceLabel}</p></div>
        {menu?.source !== 'd1' ? <p className='text-xs text-amber-300'>Edición deshabilitada por el momento.</p> : null}
      </div>
      <div className='mt-2 flex flex-wrap gap-2'><span className='chip'>Sesión activa</span><span className='chip'>Catálogo</span></div>
    </Card>

    <div className='flex gap-2 overflow-x-auto pb-1'>
      <Button className={`shrink-0 ${catalogTab === 'items' ? 'bg-cyan-400 text-black' : 'border border-zinc-700 bg-zinc-900'}`} onClick={() => setCatalogTab('items')}>Productos</Button>
      <Button className={`shrink-0 ${catalogTab === 'promos' ? 'bg-cyan-400 text-black' : 'border border-zinc-700 bg-zinc-900'}`} onClick={() => setCatalogTab('promos')}>Promos</Button>
      <Button className={`shrink-0 ${catalogTab === 'banners' ? 'bg-cyan-400 text-black' : 'border border-zinc-700 bg-zinc-900'}`} onClick={() => setCatalogTab('banners')}>Banners</Button>
      <Button className={`shrink-0 ${catalogTab === 'ingredients' ? 'bg-cyan-400 text-black' : 'border border-zinc-700 bg-zinc-900'}`} onClick={() => setCatalogTab('ingredients')}>Ingredientes</Button>
    </div>

    <Card className='p-3'>
      {ingredientsPanel}
    {catalogTab === 'items' ? <div className='grid gap-2 md:grid-cols-4'><input className='input md:mt-0' placeholder='Buscar por SKU o texto' value={query} onChange={(e) => setQuery(e.target.value)} /><select className='input md:mt-0' value={category} onChange={(e) => setCategory(e.target.value)}><option value='all'>Todas categorías</option>{(menu?.categories ?? []).map((cat) => <option key={cat.key} value={cat.key}>{cat.name}</option>)}</select><select className='input md:mt-0' value={availability} onChange={(e) => setAvailability(e.target.value)}><option value='all'>Todos</option><option value='available'>Disponibles</option><option value='unavailable'>Agotados</option></select><Button onClick={() => void loadMenu()}>Recargar</Button><Button disabled={!canEdit} className='bg-cyan-400 text-black disabled:opacity-40' onClick={beginCreate}>Crear producto</Button></div> : <div className='grid gap-2 md:grid-cols-[1fr_auto]'><input className='input md:mt-0' placeholder='Buscar promos por ID, título o texto' value={promoQuery} onChange={(e) => setPromoQuery(e.target.value)} /><Button onClick={() => void loadMenu()}>Recargar</Button></div>}
    </Card>

    {notice ? <p className='text-xs text-emerald-300'>{notice}</p> : null}
    {loading ? <Card>Cargando catálogo…</Card> : null}
    {error ? <Card className='text-rose-300'>{error}</Card> : null}

    {!loading && !error && catalogTab === 'items' ? <div className='grid gap-3'>{groupedFilteredItems.map((group) => (
      <section key={group.key} className='space-y-2'>
        <div className='flex items-center justify-between gap-2 px-1'>
          <h4 className='text-sm font-bold uppercase tracking-widest text-zinc-300'>{group.label}</h4>
          <span className='text-xs text-zinc-500'>{group.items.length} producto{group.items.length === 1 ? '' : 's'}</span>
        </div>
        {group.items.length ? <div className='grid gap-2'>{group.items.map((item) => {
          const availabilityBusy = availabilitySavingSku === item.sku;
          return <Card key={item.sku} className={`p-3 ${item.isAvailable ? '' : 'border-rose-500/40 bg-rose-950/20'}`}><div className='grid gap-3 md:grid-cols-[1fr_auto] md:items-start'><div className='min-w-0'><div className='flex flex-wrap items-center gap-2'><p className='font-semibold'>{item.name} <span className='muted'>({item.sku})</span></p><span className={`rounded-full px-2 py-1 text-[11px] font-bold uppercase tracking-wide ${item.isAvailable ? 'bg-emerald-500/15 text-emerald-200' : 'bg-rose-500/20 text-rose-200'}`}>{item.isAvailable ? 'Disponible' : 'Agotado'}</span></div><p className='text-xs text-zinc-400'>{item.description}</p><p className='text-xs'>${item.price} · {item.category} · Orden {item.sortOrder}</p>{item.stockManaged ? <p className='text-xs text-amber-200'>Stock: {item.stockRemaining ?? 0}{item.stockLimit == null ? '' : ` / ${item.stockLimit}`} · {item.soldOutAt ? 'agotado automático' : 'gestionado'}</p> : <p className='text-xs text-zinc-500'>Stock no gestionado</p>}{item.imageKey || item.imageUrl ? <p className='break-all text-xs text-cyan-200'>Asset: {item.imageKey ?? item.imageUrl}</p> : <p className='text-xs text-zinc-500'>Asset: placeholder</p>}</div><div className='grid min-w-[min(100%,18rem)] gap-2'><div className='grid grid-cols-2 gap-2' role='group' aria-label={`Disponibilidad de ${item.name}`}><Button disabled={!canEdit || availabilityBusy || item.isAvailable} className={`min-h-12 border text-sm disabled:opacity-40 ${item.isAvailable ? 'border-emerald-500 bg-emerald-400 text-black' : 'border-zinc-700 bg-zinc-900 text-zinc-200'}`} onClick={() => void setItemAvailability(item, true)}>{availabilityBusy ? 'Guardando…' : 'Disponible'}</Button><Button disabled={!canEdit || availabilityBusy || !item.isAvailable} className={`min-h-12 border text-sm disabled:opacity-40 ${!item.isAvailable ? 'border-rose-500 bg-rose-500 text-white' : 'border-zinc-700 bg-zinc-900 text-zinc-200'}`} onClick={() => void setItemAvailability(item, false)}>{availabilityBusy ? 'Guardando…' : 'Agotado'}</Button></div><Button disabled={!canEdit || availabilityBusy} className='min-h-11 border border-zinc-700 bg-zinc-900 disabled:opacity-40' onClick={() => beginEdit(item)}>Editar detalle</Button></div></div></Card>;
        })}</div> : <Card className='border-dashed border-zinc-800 bg-zinc-950/50 p-3 text-sm text-zinc-500'>Sin productos en {group.label} para los filtros actuales.</Card>}
      </section>
    ))}</div> : null}

    {!loading && !error && catalogTab === 'banners' ? <Card className='p-3'><div className='grid gap-3'><div><h4 className='font-bold'>Banners de categorías</h4><p className='muted'>Configura título, copy e imagen opcional por categoría. No bloquea el menú si queda vacío.</p></div><label className='text-xs uppercase tracking-widest text-zinc-300'>Categoría<select className='input md:mt-1' value={bannerForm.categoryKey} onChange={(e) => { const categoryKey = e.target.value as MenuCategory['key']; const current = (menu?.categoryBanners ?? []).find((entry) => entry.categoryKey === categoryKey); setBannerForm({ categoryKey, title: current?.title ?? '', subtitle: current?.subtitle ?? '', imageUrl: current?.imageUrl ?? '', imageKey: current?.imageKey ?? '' }); }}><option value='burgers'>burgers</option><option value='combos'>combos</option><option value='guarniciones'>guarniciones</option><option value='drinks'>bebidas</option><option value='extras'>extras</option></select></label><input className='input md:mt-0' value={bannerForm.title} onChange={(e) => setBannerForm({ ...bannerForm, title: e.target.value })} placeholder='Título del banner' /><textarea className='input md:mt-0' value={bannerForm.subtitle} onChange={(e) => setBannerForm({ ...bannerForm, subtitle: e.target.value })} placeholder='Subtítulo / copy' /><input className='input md:mt-0' value={bannerForm.imageUrl} onChange={(e) => setBannerForm({ ...bannerForm, imageUrl: e.target.value })} placeholder='Image URL opcional' /><input className='input md:mt-0' value={bannerForm.imageKey} onChange={(e) => setBannerForm({ ...bannerForm, imageKey: e.target.value })} placeholder='Image key opcional' />{bannerError ? <p className='text-xs text-rose-300'>{bannerError}</p> : null}<Button disabled={!canEdit || bannerSaving} className='bg-cyan-400 text-black disabled:opacity-40' onClick={onBannerSave}>{bannerSaving ? 'Guardando…' : 'Guardar banner'}</Button></div></Card> : null}

    {!loading && !error && catalogTab === 'promos' ? <div className='grid gap-2'>{filteredPromos.map((promo) => <Card key={promo.id} className='p-3'><div className='flex flex-wrap items-start justify-between gap-2'><div className='min-w-0'><p className='font-semibold'>{promo.title} <span className='muted'>({promo.id})</span></p><p className='text-xs text-zinc-400'>{promo.description}</p><p className='text-xs'>{promo.isAvailable ? 'Disponible' : 'Oculta'} · {promo.isFeatured ? 'Destacada' : 'No destacada'} · Orden {promo.sortOrder}</p><p className='text-xs text-zinc-300'>Badge: {promo.badge || '—'} · Promo label: {promo.promoLabel || '—'}</p>{promo.asset.imageKey || promo.asset.imageUrl ? <p className='break-all text-xs text-cyan-200'>Asset: {promo.asset.imageKey ?? promo.asset.imageUrl}</p> : <p className='text-xs text-zinc-500'>Asset: placeholder</p>}</div><Button disabled={!canEdit} className='border border-zinc-700 bg-zinc-900 disabled:opacity-40' onClick={() => beginPromoEdit(promo)}>Editar</Button></div></Card>)}</div> : null}

    {(editing || creatingItem) && form ? <div className='overlay' onClick={closeEditor}><section className='modal' onClick={(e) => e.stopPropagation()}><h3 className='font-bold'>{creatingItem ? 'Crear producto' : `Editar ${editing?.sku}`}</h3><p className='muted'>{creatingItem ? 'SKU nuevo requerido' : 'SKU solo lectura'}</p><div className='mt-2 grid gap-2'><input className='input md:mt-0' value={form.sku} readOnly={!creatingItem} onChange={(e) => setForm({ ...form, sku: e.target.value.toUpperCase().replace(/[^A-Z0-9-]+/g, '-') })} placeholder='SKU' /><input className='input md:mt-0' value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder='Nombre' /><textarea className='input md:mt-0' value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder='Descripción' /><input className='input md:mt-0' value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder='Precio' /><select className='input md:mt-0' value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as MenuCategory['key'] })}><option value='burgers'>burger</option><option value='combos'>combo</option><option value='guarniciones'>guarnición</option><option value='drinks'>bebida</option><option value='extras'>extra</option></select><label className='flex items-center gap-2 text-sm'><input type='checkbox' checked={form.isAvailable} onChange={(e) => setForm({ ...form, isAvailable: e.target.checked })} /> Disponible</label><input className='input md:mt-0' value={form.badge} onChange={(e) => setForm({ ...form, badge: e.target.value })} placeholder='Badge (opcional)' /><input className='input md:mt-0' value={form.promoLabel} onChange={(e) => setForm({ ...form, promoLabel: e.target.value })} placeholder='Promo label (opcional)' /><input className='input md:mt-0' value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} placeholder='Orden' /><div className='rounded-xl border border-zinc-800 bg-zinc-900/50 p-3'><label className='flex items-center gap-2 text-sm'><input type='checkbox' checked={form.stockManaged} onChange={(e) => setForm({ ...form, stockManaged: e.target.checked, stockRemaining: e.target.checked ? form.stockRemaining : '', stockLimit: e.target.checked ? form.stockLimit : '' })} /> Stock gestionado</label>{form.stockManaged ? <div className='mt-2 grid gap-2 sm:grid-cols-2'><input className='input md:mt-0' value={form.stockRemaining} onChange={(e) => setForm({ ...form, stockRemaining: e.target.value })} placeholder='Stock disponible' /><input className='input md:mt-0' value={form.stockLimit} onChange={(e) => setForm({ ...form, stockLimit: e.target.value })} placeholder='Límite inicial opcional' /></div> : <p className='mt-2 text-xs text-zinc-400'>Sin stock gestionado: mantiene comportamiento actual.</p>}</div>
        <div className='rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-3'><div className='flex flex-col gap-3 sm:flex-row'><div className='image-preview'>{imagePreviewUrl ? <img src={imagePreviewUrl} alt={`Imagen de ${editing?.name ?? form.name}`} loading='lazy' decoding='async' /> : <span>Sin imagen</span>}</div><div className='min-w-0 flex-1 space-y-2'><h4 className='text-sm font-bold text-cyan-100'>Imagen del producto</h4>{form.imageKey || form.imageUrl ? <p className='break-all text-xs text-cyan-200'>Imagen actual: {form.imageKey || form.imageUrl}</p> : <p className='text-xs text-zinc-400'>Sin imagen asignada: Public V2 usa una card compacta sin imagen.</p>}<input ref={fileInputRef} className='input md:mt-0' type='file' accept={ACCEPTED_IMAGE_TYPES.join(',')} disabled={imageBusy || saving} onChange={(e) => onFileChange(e.target.files?.[0] ?? null)} /><p className='text-xs text-zinc-400'>{ACCEPTED_IMAGE_TYPES_LABEL}. La ruta de imagen se genera automáticamente en <code>menu/</code>.</p><div className='flex flex-col gap-2 sm:flex-row'><Button className='flex-1 bg-cyan-400 text-black disabled:opacity-40' disabled={imageBusy || saving || creatingItem || !canEdit || !selectedFile || Boolean(validateSelectedFile(selectedFile))} onClick={onUploadImage}>{uploading ? 'Subiendo…' : 'Subir imagen'}</Button><Button className='flex-1 border border-rose-700 bg-zinc-900 text-rose-200 disabled:opacity-40' disabled={imageBusy || saving || creatingItem || !canEdit || (!form.imageKey && !form.imageUrl)} onClick={onRemoveImage}>{removingImage ? 'Quitando…' : 'Quitar imagen'}</Button></div>{imageError ? <p className='text-xs text-rose-300'>{imageError}</p> : null}</div></div></div>
        <details className='rounded-xl border border-zinc-800 bg-zinc-900/50 p-3'><summary className='cursor-pointer text-xs uppercase tracking-widest text-zinc-300'>Referencia manual avanzada</summary><div className='mt-2 grid gap-2'><label className='text-xs uppercase tracking-widest text-zinc-300'>Image URL<input className='input md:mt-1' value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder='Image URL' /></label><label className='text-xs uppercase tracking-widest text-zinc-300'>Image key<input className='input md:mt-1' value={form.imageKey} onChange={(e) => setForm({ ...form, imageKey: e.target.value })} placeholder='menu/burger-og.webp' /></label><p className='text-xs text-zinc-400'>Image URL puede ser /api/assets-v2/... o URL externa segura https://. Image key apunta a R2.</p></div></details>
      </div>{validationError ? <p className='mt-2 text-xs text-rose-300'>{validationError}</p> : null}{saveError ? <p className='mt-2 text-xs text-rose-300'>{saveError}</p> : null}<div className='mt-3 flex gap-2'><Button className='flex-1 border border-zinc-700 bg-zinc-900' onClick={closeEditor} disabled={saving || imageBusy}>Cancelar</Button><Button className='flex-1 bg-cyan-400 text-black disabled:opacity-40' onClick={onSave} disabled={saving || imageBusy || Boolean(validationError)}>Guardar</Button></div></section></div> : null}

    {editingPromo && promoForm ? <div className='overlay' onClick={closePromoEditor}><section className='modal' onClick={(e) => e.stopPropagation()}><h3 className='font-bold'>Editar promo {editingPromo.id}</h3><p className='muted'>ID solo lectura</p><div className='mt-2 grid gap-2'><label className='text-xs uppercase tracking-widest text-zinc-300'>ID<input className='input md:mt-1' value={editingPromo.id} readOnly /></label><input className='input md:mt-0' value={promoForm.title} onChange={(e) => setPromoForm({ ...promoForm, title: e.target.value })} placeholder='Título' /><textarea className='input md:mt-0' value={promoForm.description} onChange={(e) => setPromoForm({ ...promoForm, description: e.target.value })} placeholder='Descripción' /><input className='input md:mt-0' value={promoForm.badge} onChange={(e) => setPromoForm({ ...promoForm, badge: e.target.value })} placeholder='Badge (opcional)' /><input className='input md:mt-0' value={promoForm.promoLabel} onChange={(e) => setPromoForm({ ...promoForm, promoLabel: e.target.value })} placeholder='Promo label (opcional)' /><div className='grid gap-2 sm:grid-cols-2'><label className='flex items-center gap-2 text-sm'><input type='checkbox' checked={promoForm.isAvailable} onChange={(e) => setPromoForm({ ...promoForm, isAvailable: e.target.checked })} /> Disponible</label><label className='flex items-center gap-2 text-sm'><input type='checkbox' checked={promoForm.isFeatured} onChange={(e) => setPromoForm({ ...promoForm, isFeatured: e.target.checked })} /> Destacada</label></div><input className='input md:mt-0' value={promoForm.sortOrder} onChange={(e) => setPromoForm({ ...promoForm, sortOrder: e.target.value })} placeholder='Orden' />
        <div className='rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-3'><div className='flex flex-col gap-3 sm:flex-row'><div className='image-preview'>{promoImagePreviewUrl ? <img src={promoImagePreviewUrl} alt={`Imagen de ${editingPromo.title}`} loading='lazy' decoding='async' /> : <span>Sin imagen</span>}</div><div className='min-w-0 flex-1 space-y-2'><h4 className='text-sm font-bold text-cyan-100'>Imagen de promo</h4>{promoForm.imageKey || promoForm.imageUrl ? <p className='break-all text-xs text-cyan-200'>Imagen actual: {promoForm.imageKey || promoForm.imageUrl}</p> : <p className='text-xs text-zinc-400'>Sin imagen asignada: Public V2 muestra la promo sin imagen.</p>}<input ref={promoFileInputRef} className='input md:mt-0' type='file' accept={ACCEPTED_IMAGE_TYPES.join(',')} disabled={promoImageBusy || promoSaving} onChange={(e) => onPromoFileChange(e.target.files?.[0] ?? null)} /><p className='text-xs text-zinc-400'>{ACCEPTED_IMAGE_TYPES_LABEL}. La ruta de imagen se genera automáticamente en <code>promos/</code>.</p><div className='flex flex-col gap-2 sm:flex-row'><Button className='flex-1 bg-cyan-400 text-black disabled:opacity-40' disabled={promoImageBusy || promoSaving || !canEdit || !selectedPromoFile || Boolean(validateSelectedFile(selectedPromoFile))} onClick={onPromoUploadImage}>{promoUploading ? 'Subiendo…' : 'Subir imagen'}</Button><Button className='flex-1 border border-rose-700 bg-zinc-900 text-rose-200 disabled:opacity-40' disabled={promoImageBusy || promoSaving || !canEdit || (!promoForm.imageKey && !promoForm.imageUrl)} onClick={onPromoRemoveImage}>{promoRemovingImage ? 'Quitando…' : 'Quitar imagen'}</Button></div>{promoImageError ? <p className='text-xs text-rose-300'>{promoImageError}</p> : null}</div></div></div>
        <details className='rounded-xl border border-zinc-800 bg-zinc-900/50 p-3'><summary className='cursor-pointer text-xs uppercase tracking-widest text-zinc-300'>Referencia manual avanzada</summary><div className='mt-2 grid gap-2'><label className='text-xs uppercase tracking-widest text-zinc-300'>Image URL<input className='input md:mt-1' value={promoForm.imageUrl} onChange={(e) => setPromoForm({ ...promoForm, imageUrl: e.target.value })} placeholder='Image URL' /></label><label className='text-xs uppercase tracking-widest text-zinc-300'>Image key<input className='input md:mt-1' value={promoForm.imageKey} onChange={(e) => setPromoForm({ ...promoForm, imageKey: e.target.value })} placeholder='promos/combo-og.webp' /></label><p className='text-xs text-zinc-400'>Image URL puede ser /api/assets-v2/... o URL externa segura https://. Image key apunta a R2, ejemplo promos/combo-og.webp.</p></div></details>
      </div>{promoValidationError ? <p className='mt-2 text-xs text-rose-300'>{promoValidationError}</p> : null}{promoSaveError ? <p className='mt-2 text-xs text-rose-300'>{promoSaveError}</p> : null}<div className='mt-3 flex gap-2'><Button className='flex-1 border border-zinc-700 bg-zinc-900' onClick={closePromoEditor} disabled={promoSaving || promoImageBusy}>Cancelar</Button><Button className='flex-1 bg-cyan-400 text-black disabled:opacity-40' onClick={onPromoSave} disabled={promoSaving || promoImageBusy || Boolean(promoValidationError) || !canEdit}>Guardar</Button></div></section></div> : null}
  </section>;
}
