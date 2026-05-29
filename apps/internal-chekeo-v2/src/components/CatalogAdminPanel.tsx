import { useEffect, useMemo, useRef, useState } from 'react';
import type { MenuItem, MenuV2Response, PromoCard as PromoCardType } from '@config/index';
import { Button, Card } from '@ui/index';
import { clearAdminToken, getAdminToken, setAdminToken as persistAdminToken } from '../lib/admin-token';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const ACCEPTED_IMAGE_TYPES_LABEL = 'JPG, PNG, WebP o AVIF hasta 5 MB';

type CatalogTab = 'items' | 'promos';
type EditForm = { name: string; description: string; price: string; isAvailable: boolean; badge: string; promoLabel: string; sortOrder: string; imageUrl: string; imageKey: string };
type PromoEditForm = { title: string; description: string; badge: string; promoLabel: string; isAvailable: boolean; isFeatured: boolean; sortOrder: string; imageUrl: string; imageKey: string };
type ItemImageMutationResponse = { ok?: boolean; error?: string; warning?: string; item?: MenuItem; imageKey?: string; assetUrl?: string; removed?: boolean };
type PromoMutationResponse = { ok?: boolean; error?: string; warning?: string; promo?: PromoCardType; imageKey?: string; assetUrl?: string; removed?: boolean };

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
  const [adminToken, setAdminToken] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [editingPromo, setEditingPromo] = useState<PromoCardType | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [promoForm, setPromoForm] = useState<PromoEditForm | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [removingImage, setRemovingImage] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [promoSaveError, setPromoSaveError] = useState<string | null>(null);
  const [promoImageError, setPromoImageError] = useState<string | null>(null);
  const [promoSaving, setPromoSaving] = useState(false);
  const [promoUploading, setPromoUploading] = useState(false);
  const [promoRemovingImage, setPromoRemovingImage] = useState(false);
  const [selectedPromoFile, setSelectedPromoFile] = useState<File | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const promoFileInputRef = useRef<HTMLInputElement | null>(null);

  const loadMenu = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/menu-v2');
      const data = (await res.json()) as MenuV2Response;
      setMenu(data);
    } catch {
      setError('No se pudo cargar el catálogo');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const stored = getAdminToken();
    if (stored) setAdminToken(stored);
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

  const filteredPromos = useMemo(() => {
    const q = promoQuery.toLowerCase();
    return (menu?.promos ?? []).filter((promo) => !q || [promo.id, promo.title, promo.description, promo.badge, promo.promoLabel].join(' ').toLowerCase().includes(q));
  }, [menu, promoQuery]);

  const sourceLabel = menu?.source === 'd1' ? 'Catálogo live' : menu?.source === 'fallback' ? 'Fallback local' : 'Catálogo local';
  const canEdit = Boolean(adminToken && menu?.source === 'd1');
  const imagePreviewUrl = getAssetUrl(form?.imageUrl, form?.imageKey);
  const promoImagePreviewUrl = getAssetUrl(promoForm?.imageUrl, promoForm?.imageKey);
  const imageBusy = uploading || removingImage;
  const promoImageBusy = promoUploading || promoRemovingImage;

  const beginEdit = (item: MenuItem) => {
    setEditing(item);
    setForm({ name: item.name, description: item.description, price: String(item.price), isAvailable: item.isAvailable, badge: item.badge ?? '', promoLabel: item.promoLabel ?? '', sortOrder: String(item.sortOrder), imageUrl: item.imageUrl ?? '', imageKey: item.imageKey ?? '' });
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
    if (!form.name.trim()) return 'Nombre requerido';
    if (!form.description.trim()) return 'Descripción requerida';
    if (!(Number(form.price) > 0)) return 'Precio debe ser mayor a 0';
    if (!Number.isInteger(Number(form.sortOrder))) return 'Orden debe ser entero';
    return validateImageRefs(form.imageUrl, form.imageKey);
  }, [form]);

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
    if (!adminToken) { setImageError('Activa el token admin antes de subir imágenes'); return; }
    if (menu?.source !== 'd1') { setImageError('El upload solo está disponible con source d1'); return; }
    const fileError = validateSelectedFile(selectedFile);
    if (fileError || !selectedFile) { setImageError(fileError); return; }

    setUploading(true);
    setImageError(null);
    try {
      const body = new FormData();
      body.append('file', selectedFile);
      const res = await fetch(`/api/menu-v2-admin/items/${encodeURIComponent(editing.sku)}/image`, { method: 'POST', headers: { Authorization: `Bearer ${adminToken}` }, body });
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
    if (!adminToken) { setPromoImageError('Activa el token admin antes de subir imágenes'); return; }
    if (menu?.source !== 'd1') { setPromoImageError('El upload solo está disponible con source d1'); return; }
    const fileError = validateSelectedFile(selectedPromoFile);
    if (fileError || !selectedPromoFile) { setPromoImageError(fileError); return; }

    setPromoUploading(true);
    setPromoImageError(null);
    try {
      const body = new FormData();
      body.append('file', selectedPromoFile);
      const res = await fetch(`/api/menu-v2-admin/promos/${encodeURIComponent(editingPromo.id)}/image`, { method: 'POST', headers: { Authorization: `Bearer ${adminToken}` }, body });
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
    if (!adminToken) { setImageError('Activa el token admin antes de quitar imágenes'); return; }
    if (menu?.source !== 'd1') { setImageError('La eliminación de imagen solo está disponible con source d1'); return; }

    setRemovingImage(true);
    setImageError(null);
    try {
      const res = await fetch(`/api/menu-v2-admin/items/${encodeURIComponent(editing.sku)}/image`, { method: 'DELETE', headers: { Authorization: `Bearer ${adminToken}` } });
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
    if (!adminToken) { setPromoImageError('Activa el token admin antes de quitar imágenes'); return; }
    if (menu?.source !== 'd1') { setPromoImageError('La eliminación de imagen solo está disponible con source d1'); return; }

    setPromoRemovingImage(true);
    setPromoImageError(null);
    try {
      const res = await fetch(`/api/menu-v2-admin/promos/${encodeURIComponent(editingPromo.id)}/image`, { method: 'DELETE', headers: { Authorization: `Bearer ${adminToken}` } });
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

  const onSave = async () => {
    if (!editing || !form || validationError) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/menu-v2-admin/items/${encodeURIComponent(editing.sku)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ name: form.name, description: form.description, price: Number(form.price), isAvailable: form.isAvailable, badge: form.badge || null, promoLabel: form.promoLabel || null, sortOrder: Number(form.sortOrder), imageUrl: form.imageUrl || null, imageKey: form.imageKey || null })
      });
      const data: unknown = await res.json();
      const response = (data && typeof data === 'object') ? (data as { ok?: boolean; error?: string }) : {};
      if (!res.ok || !response.ok) throw new Error(response.error ?? 'Error al actualizar producto');
      setEditing(null);
      setForm(null);
      setSelectedFile(null);
      setNotice('Producto actualizado');
      await loadMenu();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Error al actualizar producto');
    } finally {
      setSaving(false);
    }
  };

  const onPromoSave = async () => {
    if (!editingPromo || !promoForm || promoValidationError) return;
    if (!adminToken) { setPromoSaveError('Activa el token admin antes de editar promos'); return; }
    if (menu?.source !== 'd1') { setPromoSaveError('La edición solo está disponible con source d1'); return; }

    setPromoSaving(true);
    setPromoSaveError(null);
    try {
      const res = await fetch(`/api/menu-v2-admin/promos/${encodeURIComponent(editingPromo.id)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', Authorization: `Bearer ${adminToken}` },
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

  return <section className='space-y-2'>
    <Card className='p-3'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div><h3 className='font-bold'>Catálogo V2</h3><p className='muted'>Source: {sourceLabel}</p></div>
        {menu?.source !== 'd1' ? <p className='text-xs text-amber-300'>Edición deshabilitada hasta conectar D1.</p> : null}
      </div>
      {!adminToken ? <div className='mt-2 flex flex-col gap-2 md:flex-row'><input className='input md:mt-0' type='password' placeholder='Token admin preview' value={tokenInput} onChange={(e) => setTokenInput(e.target.value)} /><Button onClick={() => { if (!tokenInput.trim()) return; persistAdminToken(tokenInput.trim()); setAdminToken(tokenInput.trim()); setTokenInput(''); }}>Activar edición</Button></div> : <div className='mt-2'><Button className='border border-zinc-700 bg-zinc-900' onClick={() => { clearAdminToken(); setAdminToken(''); }}>Cerrar modo admin</Button></div>}
    </Card>

    <div className='flex gap-2 overflow-x-auto pb-1'>
      <Button className={`shrink-0 ${catalogTab === 'items' ? 'bg-cyan-400 text-black' : 'border border-zinc-700 bg-zinc-900'}`} onClick={() => setCatalogTab('items')}>Productos</Button>
      <Button className={`shrink-0 ${catalogTab === 'promos' ? 'bg-cyan-400 text-black' : 'border border-zinc-700 bg-zinc-900'}`} onClick={() => setCatalogTab('promos')}>Promos</Button>
    </div>

    <Card className='p-3'>
      {catalogTab === 'items' ? <div className='grid gap-2 md:grid-cols-4'><input className='input md:mt-0' placeholder='Buscar por SKU o texto' value={query} onChange={(e) => setQuery(e.target.value)} /><select className='input md:mt-0' value={category} onChange={(e) => setCategory(e.target.value)}><option value='all'>Todas categorías</option>{(menu?.categories ?? []).map((cat) => <option key={cat.key} value={cat.key}>{cat.name}</option>)}</select><select className='input md:mt-0' value={availability} onChange={(e) => setAvailability(e.target.value)}><option value='all'>Todos</option><option value='available'>Disponibles</option><option value='unavailable'>Agotados</option></select><Button onClick={() => void loadMenu()}>Recargar</Button></div> : <div className='grid gap-2 md:grid-cols-[1fr_auto]'><input className='input md:mt-0' placeholder='Buscar promos por ID, título o texto' value={promoQuery} onChange={(e) => setPromoQuery(e.target.value)} /><Button onClick={() => void loadMenu()}>Recargar</Button></div>}
    </Card>

    {notice ? <p className='text-xs text-emerald-300'>{notice}</p> : null}
    {loading ? <Card>Cargando catálogo…</Card> : null}
    {error ? <Card className='text-rose-300'>{error}</Card> : null}

    {!loading && !error && catalogTab === 'items' ? <div className='grid gap-2'>{filtered.map((item) => <Card key={item.sku} className='p-3'><div className='flex flex-wrap items-start justify-between gap-2'><div><p className='font-semibold'>{item.name} <span className='muted'>({item.sku})</span></p><p className='text-xs text-zinc-400'>{item.description}</p><p className='text-xs'>${item.price} · {item.category} · {item.isAvailable ? 'Disponible' : 'Agotado'} · Orden {item.sortOrder}</p>{item.imageKey || item.imageUrl ? <p className='break-all text-xs text-cyan-200'>Asset: {item.imageKey ?? item.imageUrl}</p> : <p className='text-xs text-zinc-500'>Asset: placeholder</p>}</div><Button disabled={!canEdit} className='border border-zinc-700 bg-zinc-900 disabled:opacity-40' onClick={() => beginEdit(item)}>Editar</Button></div></Card>)}</div> : null}

    {!loading && !error && catalogTab === 'promos' ? <div className='grid gap-2'>{filteredPromos.map((promo) => <Card key={promo.id} className='p-3'><div className='flex flex-wrap items-start justify-between gap-2'><div className='min-w-0'><p className='font-semibold'>{promo.title} <span className='muted'>({promo.id})</span></p><p className='text-xs text-zinc-400'>{promo.description}</p><p className='text-xs'>{promo.isAvailable ? 'Disponible' : 'Oculta'} · {promo.isFeatured ? 'Destacada' : 'No destacada'} · Orden {promo.sortOrder}</p><p className='text-xs text-zinc-300'>Badge: {promo.badge || '—'} · Promo label: {promo.promoLabel || '—'}</p>{promo.asset.imageKey || promo.asset.imageUrl ? <p className='break-all text-xs text-cyan-200'>Asset: {promo.asset.imageKey ?? promo.asset.imageUrl}</p> : <p className='text-xs text-zinc-500'>Asset: placeholder</p>}</div><Button disabled={!canEdit} className='border border-zinc-700 bg-zinc-900 disabled:opacity-40' onClick={() => beginPromoEdit(promo)}>Editar</Button></div></Card>)}</div> : null}

    {editing && form ? <div className='overlay' onClick={closeEditor}><section className='modal' onClick={(e) => e.stopPropagation()}><h3 className='font-bold'>Editar {editing.sku}</h3><p className='muted'>SKU solo lectura</p><div className='mt-2 grid gap-2'><input className='input md:mt-0' value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder='Nombre' /><textarea className='input md:mt-0' value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder='Descripción' /><input className='input md:mt-0' value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder='Precio' /><label className='flex items-center gap-2 text-sm'><input type='checkbox' checked={form.isAvailable} onChange={(e) => setForm({ ...form, isAvailable: e.target.checked })} /> Disponible</label><input className='input md:mt-0' value={form.badge} onChange={(e) => setForm({ ...form, badge: e.target.value })} placeholder='Badge (opcional)' /><input className='input md:mt-0' value={form.promoLabel} onChange={(e) => setForm({ ...form, promoLabel: e.target.value })} placeholder='Promo label (opcional)' /><input className='input md:mt-0' value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} placeholder='Orden' />
        <div className='rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-3'><div className='flex flex-col gap-3 sm:flex-row'><div className='image-preview'>{imagePreviewUrl ? <img src={imagePreviewUrl} alt={`Preview ${editing.name}`} loading='lazy' decoding='async' /> : <span>Placeholder</span>}</div><div className='min-w-0 flex-1 space-y-2'><h4 className='text-sm font-bold text-cyan-100'>Imagen del producto</h4>{form.imageKey || form.imageUrl ? <p className='break-all text-xs text-cyan-200'>Asset actual: {form.imageKey || form.imageUrl}</p> : <p className='text-xs text-zinc-400'>Sin imagen asignada: Public V2 usa placeholder automático.</p>}<input ref={fileInputRef} className='input md:mt-0' type='file' accept={ACCEPTED_IMAGE_TYPES.join(',')} disabled={imageBusy || saving} onChange={(e) => onFileChange(e.target.files?.[0] ?? null)} /><p className='text-xs text-zinc-400'>{ACCEPTED_IMAGE_TYPES_LABEL}. El key R2 se genera automáticamente bajo <code>menu/</code>.</p><div className='flex flex-col gap-2 sm:flex-row'><Button className='flex-1 bg-cyan-400 text-black disabled:opacity-40' disabled={imageBusy || saving || !canEdit || !selectedFile || Boolean(validateSelectedFile(selectedFile))} onClick={onUploadImage}>{uploading ? 'Subiendo…' : 'Subir imagen'}</Button><Button className='flex-1 border border-rose-700 bg-zinc-900 text-rose-200 disabled:opacity-40' disabled={imageBusy || saving || !canEdit || (!form.imageKey && !form.imageUrl)} onClick={onRemoveImage}>{removingImage ? 'Quitando…' : 'Quitar imagen / usar placeholder'}</Button></div>{imageError ? <p className='text-xs text-rose-300'>{imageError}</p> : null}</div></div></div>
        <details className='rounded-xl border border-zinc-800 bg-zinc-900/50 p-3'><summary className='cursor-pointer text-xs uppercase tracking-widest text-zinc-300'>Referencia manual avanzada</summary><div className='mt-2 grid gap-2'><label className='text-xs uppercase tracking-widest text-zinc-300'>Image URL<input className='input md:mt-1' value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder='Image URL' /></label><label className='text-xs uppercase tracking-widest text-zinc-300'>Image key<input className='input md:mt-1' value={form.imageKey} onChange={(e) => setForm({ ...form, imageKey: e.target.value })} placeholder='menu/burger-og.webp' /></label><p className='text-xs text-zinc-400'>Image URL puede ser /api/assets-v2/... o URL externa segura https://. Image key apunta a R2.</p></div></details>
      </div>{validationError ? <p className='mt-2 text-xs text-rose-300'>{validationError}</p> : null}{saveError ? <p className='mt-2 text-xs text-rose-300'>{saveError}</p> : null}<div className='mt-3 flex gap-2'><Button className='flex-1 border border-zinc-700 bg-zinc-900' onClick={closeEditor} disabled={saving || imageBusy}>Cancelar</Button><Button className='flex-1 bg-cyan-400 text-black disabled:opacity-40' onClick={onSave} disabled={saving || imageBusy || Boolean(validationError)}>Guardar</Button></div></section></div> : null}

    {editingPromo && promoForm ? <div className='overlay' onClick={closePromoEditor}><section className='modal' onClick={(e) => e.stopPropagation()}><h3 className='font-bold'>Editar promo {editingPromo.id}</h3><p className='muted'>ID solo lectura</p><div className='mt-2 grid gap-2'><label className='text-xs uppercase tracking-widest text-zinc-300'>ID<input className='input md:mt-1' value={editingPromo.id} readOnly /></label><input className='input md:mt-0' value={promoForm.title} onChange={(e) => setPromoForm({ ...promoForm, title: e.target.value })} placeholder='Título' /><textarea className='input md:mt-0' value={promoForm.description} onChange={(e) => setPromoForm({ ...promoForm, description: e.target.value })} placeholder='Descripción' /><input className='input md:mt-0' value={promoForm.badge} onChange={(e) => setPromoForm({ ...promoForm, badge: e.target.value })} placeholder='Badge (opcional)' /><input className='input md:mt-0' value={promoForm.promoLabel} onChange={(e) => setPromoForm({ ...promoForm, promoLabel: e.target.value })} placeholder='Promo label (opcional)' /><div className='grid gap-2 sm:grid-cols-2'><label className='flex items-center gap-2 text-sm'><input type='checkbox' checked={promoForm.isAvailable} onChange={(e) => setPromoForm({ ...promoForm, isAvailable: e.target.checked })} /> Disponible</label><label className='flex items-center gap-2 text-sm'><input type='checkbox' checked={promoForm.isFeatured} onChange={(e) => setPromoForm({ ...promoForm, isFeatured: e.target.checked })} /> Destacada</label></div><input className='input md:mt-0' value={promoForm.sortOrder} onChange={(e) => setPromoForm({ ...promoForm, sortOrder: e.target.value })} placeholder='Orden' />
        <div className='rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-3'><div className='flex flex-col gap-3 sm:flex-row'><div className='image-preview'>{promoImagePreviewUrl ? <img src={promoImagePreviewUrl} alt={`Preview ${editingPromo.title}`} loading='lazy' decoding='async' /> : <span>Placeholder</span>}</div><div className='min-w-0 flex-1 space-y-2'><h4 className='text-sm font-bold text-cyan-100'>Imagen de promo</h4>{promoForm.imageKey || promoForm.imageUrl ? <p className='break-all text-xs text-cyan-200'>Asset actual: {promoForm.imageKey || promoForm.imageUrl}</p> : <p className='text-xs text-zinc-400'>Sin imagen asignada: Public V2 usa placeholder de promo.</p>}<input ref={promoFileInputRef} className='input md:mt-0' type='file' accept={ACCEPTED_IMAGE_TYPES.join(',')} disabled={promoImageBusy || promoSaving} onChange={(e) => onPromoFileChange(e.target.files?.[0] ?? null)} /><p className='text-xs text-zinc-400'>{ACCEPTED_IMAGE_TYPES_LABEL}. El key R2 se genera automáticamente bajo <code>promos/</code>.</p><div className='flex flex-col gap-2 sm:flex-row'><Button className='flex-1 bg-cyan-400 text-black disabled:opacity-40' disabled={promoImageBusy || promoSaving || !canEdit || !selectedPromoFile || Boolean(validateSelectedFile(selectedPromoFile))} onClick={onPromoUploadImage}>{promoUploading ? 'Subiendo…' : 'Subir imagen'}</Button><Button className='flex-1 border border-rose-700 bg-zinc-900 text-rose-200 disabled:opacity-40' disabled={promoImageBusy || promoSaving || !canEdit || (!promoForm.imageKey && !promoForm.imageUrl)} onClick={onPromoRemoveImage}>{promoRemovingImage ? 'Quitando…' : 'Quitar imagen / usar placeholder'}</Button></div>{promoImageError ? <p className='text-xs text-rose-300'>{promoImageError}</p> : null}</div></div></div>
        <details className='rounded-xl border border-zinc-800 bg-zinc-900/50 p-3'><summary className='cursor-pointer text-xs uppercase tracking-widest text-zinc-300'>Referencia manual avanzada</summary><div className='mt-2 grid gap-2'><label className='text-xs uppercase tracking-widest text-zinc-300'>Image URL<input className='input md:mt-1' value={promoForm.imageUrl} onChange={(e) => setPromoForm({ ...promoForm, imageUrl: e.target.value })} placeholder='Image URL' /></label><label className='text-xs uppercase tracking-widest text-zinc-300'>Image key<input className='input md:mt-1' value={promoForm.imageKey} onChange={(e) => setPromoForm({ ...promoForm, imageKey: e.target.value })} placeholder='promos/combo-og.webp' /></label><p className='text-xs text-zinc-400'>Image URL puede ser /api/assets-v2/... o URL externa segura https://. Image key apunta a R2, ejemplo promos/combo-og.webp.</p></div></details>
      </div>{promoValidationError ? <p className='mt-2 text-xs text-rose-300'>{promoValidationError}</p> : null}{promoSaveError ? <p className='mt-2 text-xs text-rose-300'>{promoSaveError}</p> : null}<div className='mt-3 flex gap-2'><Button className='flex-1 border border-zinc-700 bg-zinc-900' onClick={closePromoEditor} disabled={promoSaving || promoImageBusy}>Cancelar</Button><Button className='flex-1 bg-cyan-400 text-black disabled:opacity-40' onClick={onPromoSave} disabled={promoSaving || promoImageBusy || Boolean(promoValidationError) || !canEdit}>Guardar</Button></div></section></div> : null}
  </section>;
}
