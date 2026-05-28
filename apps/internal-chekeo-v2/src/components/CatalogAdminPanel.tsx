import { useEffect, useMemo, useState } from 'react';
import type { MenuItem, MenuV2Response } from '@config/index';
import { Button, Card } from '@ui/index';

const ADMIN_TOKEN_KEY = 'bog-menu-admin-token-v2';

type EditForm = { name: string; description: string; price: string; isAvailable: boolean; badge: string; promoLabel: string; sortOrder: string };

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
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const loadMenu = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/menu-v2');
      const data = (await res.json()) as MenuV2Response;
      setMenu(data);
    } catch {
      setError('No se pudo cargar el catálogo');
    } finally { setLoading(false); }
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

  const beginEdit = (item: MenuItem) => {
    setEditing(item);
    setForm({ name: item.name, description: item.description, price: String(item.price), isAvailable: item.isAvailable, badge: item.badge ?? '', promoLabel: item.promoLabel ?? '', sortOrder: String(item.sortOrder) });
    setSaveError(null);
  };

  const validationError = useMemo(() => {
    if (!form) return null;
    if (!form.name.trim()) return 'Nombre requerido';
    if (!form.description.trim()) return 'Descripción requerida';
    if (!(Number(form.price) > 0)) return 'Precio debe ser mayor a 0';
    if (!Number.isInteger(Number(form.sortOrder))) return 'Orden debe ser entero';
    return null;
  }, [form]);

  const onSave = async () => {
    if (!editing || !form || validationError) return;
    setSaving(true); setSaveError(null);
    try {
      const res = await fetch(`/api/menu-v2-admin/items/${encodeURIComponent(editing.sku)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ name: form.name, description: form.description, price: Number(form.price), isAvailable: form.isAvailable, badge: form.badge || null, promoLabel: form.promoLabel || null, sortOrder: Number(form.sortOrder) })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Error al actualizar producto');
      setEditing(null); setForm(null); setNotice('Producto actualizado');
      await loadMenu();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Error al actualizar producto');
    } finally { setSaving(false); }
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

    {!loading && !error ? <div className='grid gap-2'>{filtered.map((item) => <Card key={item.sku} className='p-3'><div className='flex flex-wrap items-start justify-between gap-2'><div><p className='font-semibold'>{item.name} <span className='muted'>({item.sku})</span></p><p className='text-xs text-zinc-400'>{item.description}</p><p className='text-xs'>${item.price} · {item.category} · {item.isAvailable ? 'Disponible' : 'Agotado'} · Orden {item.sortOrder}</p></div><Button disabled={!adminToken || menu?.source !== 'd1'} className='border border-zinc-700 bg-zinc-900 disabled:opacity-40' onClick={() => beginEdit(item)}>Editar</Button></div></Card>)}</div> : null}

    {editing && form ? <div className='overlay' onClick={() => { if (!saving) { setEditing(null); setForm(null); } }}><section className='modal' onClick={(e) => e.stopPropagation()}><h3 className='font-bold'>Editar {editing.sku}</h3><p className='muted'>SKU solo lectura</p><div className='mt-2 grid gap-2'><input className='input md:mt-0' value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder='Nombre' /><textarea className='input md:mt-0' value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder='Descripción' /><input className='input md:mt-0' value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder='Precio' /><label className='flex items-center gap-2 text-sm'><input type='checkbox' checked={form.isAvailable} onChange={(e) => setForm({ ...form, isAvailable: e.target.checked })} /> Disponible</label><input className='input md:mt-0' value={form.badge} onChange={(e) => setForm({ ...form, badge: e.target.value })} placeholder='Badge (opcional)' /><input className='input md:mt-0' value={form.promoLabel} onChange={(e) => setForm({ ...form, promoLabel: e.target.value })} placeholder='Promo label (opcional)' /><input className='input md:mt-0' value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} placeholder='Orden' /></div>{validationError ? <p className='mt-2 text-xs text-rose-300'>{validationError}</p> : null}{saveError ? <p className='mt-2 text-xs text-rose-300'>{saveError}</p> : null}<div className='mt-3 flex gap-2'><Button className='flex-1 border border-zinc-700 bg-zinc-900' onClick={() => { setEditing(null); setForm(null); }} disabled={saving}>Cancelar</Button><Button className='flex-1 bg-cyan-400 text-black disabled:opacity-40' onClick={onSave} disabled={saving || Boolean(validationError)}>Guardar</Button></div></section></div> : null}
  </section>;
}
