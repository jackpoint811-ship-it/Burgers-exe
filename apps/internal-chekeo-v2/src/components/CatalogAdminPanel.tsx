import { useEffect, useMemo, useRef, useState } from 'react';
import type { MenuItem, MenuV2Response } from '@config/index';
import { Button, Card } from '@ui/index';

const ADMIN_TOKEN_KEY = 'bog-menu-admin-token-v2';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const ACCEPTED_IMAGE_TYPES_LABEL = 'JPG, PNG, WebP o AVIF hasta 5 MB';

type EditForm = { name: string; description: string; price: string; isAvailable: boolean; badge: string; promoLabel: string; sortOrder: string; imageUrl: string; imageKey: string };
type ImageMutationResponse = { ok?: boolean; error?: string; warning?: string; item?: MenuItem; imageKey?: string; assetUrl?: string; removed?: boolean };

const getAssetUrl = (imageUrl?: string, imageKey?: string): string | undefined => {
  const trimmedUrl = imageUrl?.trim();
  if (trimmedUrl && ((trimmedUrl.startsWith('/') && !trimmedUrl.startsWith('//')) || trimmedUrl.startsWith('https://'))) return trimmedUrl;
  const trimmedKey = imageKey?.trim();
  if (!trimmedKey) return undefined;
  return `/api/assets-v2/${trimmedKey.split('/').map((segment) => encodeURIComponent(segment)).join('/')}`;
};

export function CatalogAdminPanel() {
  const [menu, setMenu] = useState<MenuV2Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [availability, setAvailability] = useState('all');
  const [adminToken, setAdminToken] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [removingImage, setRemovingImage] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
    const stored = window.sessionStorage.getItem(ADMIN_TOKEN_KEY);
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

  const sourceLabel = menu?.source === 'd1' ? 'Catálogo live' : menu?.source === 'fallback' ? 'Fallback local' : 'Catálogo local';
  const imagePreviewUrl = getAssetUrl(form?.imageUrl, form?.imageKey);
  const imageBusy = uploading || removingImage;

  const beginEdit = (item: MenuItem) => {
    setEditing(item);
    setForm({ name: item.name, description: item.description, price: String(item.price), isAvailable: item.isAvailable, badge: item.badge ?? '', promoLabel: item.promoLabel ?? '', sortOrder: String(item.sortOrder), imageUrl: item.imageUrl ?? '', imageKey: item.imageKey ?? '' });
    setSelectedFile(null);
    setSaveError(null);
    setImageError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const closeEditor = () => {
    if (saving || imageBusy) return;
    setEditing(null);
    setForm(null);
    setSelectedFile(null);
    setSaveError(null);
    setImageError(null);
  };

  const validationError = useMemo(() => {
    if (!form) return null;
    if (!form.name.trim()) return 'Nombre requerido';
    if (!form.description.trim()) return 'Descripción requerida';
    if (!(Number(form.price) > 0)) return 'Precio debe ser mayor a 0';
    if (!Number.isInteger(Number(form.sortOrder))) return 'Orden debe ser entero';
    const imageUrl = form.imageUrl.trim();
    if (imageUrl && !((imageUrl.startsWith('/') && !imageUrl.startsWith('//')) || imageUrl.startsWith('https://'))) return 'Image URL debe empezar con / o https://';
    const imageKey = form.imageKey.trim();
    if (imageKey && (imageKey.includes('..') || imageKey.includes('\\') || imageKey.includes('//'))) return 'Image key no debe contener .., \\ ni //';
    if (imageKey && !/\.(jpe?g|png|webp|avif)$/i.test(imageKey)) return 'Image key debe terminar en .jpg, .jpeg, .png, .webp o .avif';
    return null;
  }, [form]);

  const validateSelectedFile = (file: File | null): string | null => {
    if (!file) return 'Selecciona una imagen primero';
    if (file.size > MAX_IMAGE_BYTES) return 'La imagen debe pesar 5 MB o menos';
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) return `Tipo no permitido. Usa ${ACCEPTED_IMAGE_TYPES_LABEL}.`;
    return null;
  };

  const updateEditedImageFromItem = (item: MenuItem) => {
    setEditing(item);
    setForm((current) => current ? { ...current, imageUrl: item.imageUrl ?? '', imageKey: item.imageKey ?? '' } : current);
    setMenu((current) => current ? { ...current, items: current.items.map((entry) => (entry.sku === item.sku ? item : entry)) } : current);
  };

  const onFileChange = (file: File | null) => {
    setSelectedFile(file);
    setImageError(validateSelectedFile(file));
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
      const res = await fetch(`/api/menu-v2-admin/items/${encodeURIComponent(editing.sku)}/image`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body
      });
      const data = (await res.json()) as ImageMutationResponse;
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

  const onRemoveImage = async () => {
    if (!editing || !form) return;
    if (!adminToken) { setImageError('Activa el token admin antes de quitar imágenes'); return; }
    if (menu?.source !== 'd1') { setImageError('La eliminación de imagen solo está disponible con source d1'); return; }

    setRemovingImage(true);
    setImageError(null);
    try {
      const res = await fetch(`/api/menu-v2-admin/items/${encodeURIComponent(editing.sku)}/image`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const data = (await res.json()) as ImageMutationResponse;
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

  return <section className='space-y-2'>
    <Card className='p-3'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div><h3 className='font-bold'>Catálogo V2</h3><p className='muted'>Source: {sourceLabel}</p></div>
        {menu?.source !== 'd1' ? <p className='text-xs text-amber-300'>Edición deshabilitada hasta conectar D1.</p> : null}
      </div>
      {!adminToken ? <div className='mt-2 flex flex-col gap-2 md:flex-row'><input className='input md:mt-0' type='password' placeholder='Token admin preview' value={tokenInput} onChange={(e) => setTokenInput(e.target.value)} /><Button onClick={() => { if (!tokenInput.trim()) return; window.sessionStorage.setItem(ADMIN_TOKEN_KEY, tokenInput.trim()); setAdminToken(tokenInput.trim()); setTokenInput(''); }}>Activar edición</Button></div> : <div className='mt-2'><Button className='border border-zinc-700 bg-zinc-900' onClick={() => { window.sessionStorage.removeItem(ADMIN_TOKEN_KEY); setAdminToken(''); }}>Cerrar modo admin</Button></div>}
    </Card>

    <Card className='p-3'>
      <div className='grid gap-2 md:grid-cols-4'><input className='input md:mt-0' placeholder='Buscar por SKU o texto' value={query} onChange={(e) => setQuery(e.target.value)} /><select className='input md:mt-0' value={category} onChange={(e) => setCategory(e.target.value)}><option value='all'>Todas categorías</option>{(menu?.categories ?? []).map((cat) => <option key={cat.key} value={cat.key}>{cat.name}</option>)}</select><select className='input md:mt-0' value={availability} onChange={(e) => setAvailability(e.target.value)}><option value='all'>Todos</option><option value='available'>Disponibles</option><option value='unavailable'>Agotados</option></select><Button onClick={() => void loadMenu()}>Recargar</Button></div>
    </Card>

    {notice ? <p className='text-xs text-emerald-300'>{notice}</p> : null}
    {loading ? <Card>Cargando catálogo…</Card> : null}
    {error ? <Card className='text-rose-300'>{error}</Card> : null}

    {!loading && !error ? <div className='grid gap-2'>{filtered.map((item) => <Card key={item.sku} className='p-3'><div className='flex flex-wrap items-start justify-between gap-2'><div><p className='font-semibold'>{item.name} <span className='muted'>({item.sku})</span></p><p className='text-xs text-zinc-400'>{item.description}</p><p className='text-xs'>${item.price} · {item.category} · {item.isAvailable ? 'Disponible' : 'Agotado'} · Orden {item.sortOrder}</p>{item.imageKey || item.imageUrl ? <p className='break-all text-xs text-cyan-200'>Asset: {item.imageKey ?? item.imageUrl}</p> : <p className='text-xs text-zinc-500'>Asset: placeholder</p>}</div><Button disabled={!adminToken || menu?.source !== 'd1'} className='border border-zinc-700 bg-zinc-900 disabled:opacity-40' onClick={() => beginEdit(item)}>Editar</Button></div></Card>)}</div> : null}

    {editing && form ? <div className='overlay' onClick={closeEditor}><section className='modal' onClick={(e) => e.stopPropagation()}><h3 className='font-bold'>Editar {editing.sku}</h3><p className='muted'>SKU solo lectura</p><div className='mt-2 grid gap-2'><input className='input md:mt-0' value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder='Nombre' /><textarea className='input md:mt-0' value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder='Descripción' /><input className='input md:mt-0' value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder='Precio' /><label className='flex items-center gap-2 text-sm'><input type='checkbox' checked={form.isAvailable} onChange={(e) => setForm({ ...form, isAvailable: e.target.checked })} /> Disponible</label><input className='input md:mt-0' value={form.badge} onChange={(e) => setForm({ ...form, badge: e.target.value })} placeholder='Badge (opcional)' /><input className='input md:mt-0' value={form.promoLabel} onChange={(e) => setForm({ ...form, promoLabel: e.target.value })} placeholder='Promo label (opcional)' /><input className='input md:mt-0' value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} placeholder='Orden' />
        <div className='rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-3'>
          <div className='flex flex-col gap-3 sm:flex-row'>
            <div className='image-preview'>{imagePreviewUrl ? <img src={imagePreviewUrl} alt={`Preview ${editing.name}`} loading='lazy' decoding='async' /> : <span>Placeholder</span>}</div>
            <div className='min-w-0 flex-1 space-y-2'>
              <h4 className='text-sm font-bold text-cyan-100'>Imagen del producto</h4>
              {form.imageKey || form.imageUrl ? <p className='break-all text-xs text-cyan-200'>Asset actual: {form.imageKey || form.imageUrl}</p> : <p className='text-xs text-zinc-400'>Sin imagen asignada: Public V2 usa placeholder automático.</p>}
              <input ref={fileInputRef} className='input md:mt-0' type='file' accept={ACCEPTED_IMAGE_TYPES.join(',')} disabled={imageBusy || saving} onChange={(e) => onFileChange(e.target.files?.[0] ?? null)} />
              <p className='text-xs text-zinc-400'>{ACCEPTED_IMAGE_TYPES_LABEL}. El key R2 se genera automáticamente bajo <code>menu/</code>.</p>
              <div className='flex flex-col gap-2 sm:flex-row'>
                <Button className='flex-1 bg-cyan-400 text-black disabled:opacity-40' disabled={imageBusy || saving || !adminToken || menu?.source !== 'd1' || !selectedFile || Boolean(validateSelectedFile(selectedFile))} onClick={onUploadImage}>{uploading ? 'Subiendo…' : 'Subir imagen'}</Button>
                <Button className='flex-1 border border-rose-700 bg-zinc-900 text-rose-200 disabled:opacity-40' disabled={imageBusy || saving || !adminToken || menu?.source !== 'd1' || (!form.imageKey && !form.imageUrl)} onClick={onRemoveImage}>{removingImage ? 'Quitando…' : 'Quitar imagen / usar placeholder'}</Button>
              </div>
              {imageError ? <p className='text-xs text-rose-300'>{imageError}</p> : null}
            </div>
          </div>
        </div>
        <details className='rounded-xl border border-zinc-800 bg-zinc-900/50 p-3'><summary className='cursor-pointer text-xs uppercase tracking-widest text-zinc-300'>Referencia manual avanzada</summary><div className='mt-2 grid gap-2'><label className='text-xs uppercase tracking-widest text-zinc-300'>Image URL<input className='input md:mt-1' value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder='Image URL' /></label><label className='text-xs uppercase tracking-widest text-zinc-300'>Image key<input className='input md:mt-1' value={form.imageKey} onChange={(e) => setForm({ ...form, imageKey: e.target.value })} placeholder='menu/burger-og.webp' /></label><p className='text-xs text-zinc-400'>Image URL puede ser /api/assets-v2/... o URL externa segura https://. Image key apunta a R2, ejemplo menu/burger-og.webp.</p></div></details>
      </div>{validationError ? <p className='mt-2 text-xs text-rose-300'>{validationError}</p> : null}{saveError ? <p className='mt-2 text-xs text-rose-300'>{saveError}</p> : null}<div className='mt-3 flex gap-2'><Button className='flex-1 border border-zinc-700 bg-zinc-900' onClick={closeEditor} disabled={saving || imageBusy}>Cancelar</Button><Button className='flex-1 bg-cyan-400 text-black disabled:opacity-40' onClick={onSave} disabled={saving || imageBusy || Boolean(validationError)}>Guardar</Button></div></section></div> : null}
  </section>;
}
