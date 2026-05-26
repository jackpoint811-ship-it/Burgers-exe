import { menuCategories, menuItems, promoCards, siteConfig, type MenuItem } from '@config/index';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { CartEntry, formatCurrency, getCartCount, getCartTotal } from '../lib/order';

type Payment = 'pickup' | 'delivery';

const PlaceholderVisual = ({ label }: { label: string }) => (
  <div className="relative h-36 overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-br from-fuchsia-500/20 via-amber-400/20 to-cyan-500/20 p-4">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.22),transparent_45%)]" />
    <div className="absolute bottom-2 left-3 text-[10px] uppercase tracking-[0.25em] text-zinc-300">{label}</div>
    <div className="absolute -right-8 -top-10 h-40 w-40 rounded-full border border-white/20" />
  </div>
);

export function PublicOrderApp() {
  const reduce = useReducedMotion();
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [customer, setCustomer] = useState({ name: '', phone: '', notes: '', payment: 'pickup' as Payment });
  const [success, setSuccess] = useState(false);
  const total = useMemo(() => getCartTotal(cart, menuItems), [cart]);
  const count = getCartCount(cart);

  const addToCart = (item: MenuItem) => {
    if (!item.isAvailable) return;
    setSuccess(false);
    setCart((prev) => {
      const found = prev.find((entry) => entry.sku === item.sku);
      if (found) return prev.map((entry) => (entry.sku === item.sku ? { ...entry, qty: entry.qty + 1 } : entry));
      return [...prev, { sku: item.sku, qty: 1 }];
    });
  };

  const updateQty = (sku: string, delta: number) => {
    setCart((prev) => prev.map((entry) => (entry.sku === sku ? { ...entry, qty: Math.max(0, entry.qty + delta) } : entry)).filter((entry) => entry.qty > 0));
  };

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-3 py-4 sm:px-6 lg:px-8">
      <section className="rounded-3xl border border-neon/40 bg-zinc-900/85 p-5 shadow-2xl">
        <motion.div initial={reduce ? undefined : { opacity: 0, y: 20 }} animate={reduce ? undefined : { opacity: 1, y: 0 }}>
          <p className="inline-flex rounded-full border border-neon/30 bg-neon/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-neon">Batch online ahora</p>
          <h1 className="mt-3 text-4xl font-black sm:text-5xl">Burgers que explotan en sabor. Pedido directo, rápido y sin drama.</h1>
          <p className="mt-3 max-w-2xl text-zinc-300">{siteConfig.brandName} mezcla cocina al momento con actitud digital. Elige promo, arma tu combo y simula tu pedido en segundos.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <a href="#menu" className="rounded-xl bg-neon px-5 py-3 font-semibold text-black">Pedir ahora</a>
            <a href="#promos" className="rounded-xl border border-white/30 px-5 py-3 font-semibold">Ver promos</a>
          </div>
        </motion.div>
      </section>

      <section id="promos" className="space-y-3">
        <h2 className="text-2xl font-bold">Promos del momento</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {promoCards.map((promo) => (
            <motion.article key={promo.id} whileHover={reduce ? undefined : { y: -4 }} className="rounded-3xl border border-white/15 bg-zinc-900/70 p-4">
              <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-widest text-zinc-300"><span>{promo.badge ?? 'Promo activa'}</span><span>{promo.promoLabel ?? 'Top pick'}</span></div>
              <h3 className="text-2xl font-extrabold">{promo.title}</h3><p className="mt-2 text-zinc-300">{promo.description}</p>
              <div className="mt-4"><PlaceholderVisual label={promo.asset.placeholder} /></div>
            </motion.article>
          ))}
        </div>
      </section>

      <section id="menu" className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Menú</h2>
          {menuCategories.map((category) => (
            <div key={category.id} className="space-y-3">
              <h3 className="text-xl font-semibold">{category.name}</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {menuItems.filter((item) => item.category === category.key).map((item) => (
                  <motion.article whileTap={reduce ? undefined : { scale: 0.98 }} key={item.sku} className="rounded-2xl border border-white/15 bg-zinc-900/70 p-3">
                    <PlaceholderVisual label={item.tags[0] ?? 'menu'} />
                    <div className="mt-3 flex items-start justify-between gap-2"><h4 className="font-semibold">{item.name}</h4><span className="text-neon">{formatCurrency(item.price)}</span></div>
                    <p className="mt-1 text-sm text-zinc-300">{item.description}</p>
                    <button disabled={!item.isAvailable} onClick={() => addToCart(item)} className="mt-3 w-full rounded-xl bg-neon px-3 py-2 font-semibold text-black disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400">{item.isAvailable ? 'Agregar' : 'No disponible'}</button>
                  </motion.article>
                ))}
              </div>
            </div>
          ))}
        </div>

        <aside className="sticky top-2 h-fit space-y-3 rounded-2xl border border-white/15 bg-zinc-950/90 p-4">
          <p className="text-xs text-amber-300">Vista V2 mock / no envía pedido real.</p>
          <h3 className="text-xl font-bold">Tu pedido ({count})</h3>
          <div className="max-h-52 space-y-2 overflow-auto">
            {cart.length === 0 ? <p className="text-sm text-zinc-400">Agrega algo del menú para empezar.</p> : cart.map((entry) => {
              const item = menuItems.find((menuItem) => menuItem.sku === entry.sku);
              if (!item) return null;
              return <div key={entry.sku} className="rounded-lg border border-white/10 p-2 text-sm"><div className="flex justify-between"><span>{item.name}</span><span>{formatCurrency(item.price * entry.qty)}</span></div><div className="mt-2 flex gap-2"><button className="rounded bg-zinc-700 px-2" onClick={() => updateQty(entry.sku, -1)}>-</button><span>{entry.qty}</span><button className="rounded bg-zinc-700 px-2" onClick={() => updateQty(entry.sku, 1)}>+</button></div></div>;
            })}
          </div>
          <p className="border-t border-white/10 pt-2 text-lg font-semibold">Total: {formatCurrency(total)}</p>

          <div className="space-y-2 pt-2">
            <label className="text-sm">Nombre<input className="mt-1 w-full rounded-lg border border-white/20 bg-zinc-900 px-3 py-2" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} /></label>
            <label className="text-sm">Teléfono<input className="mt-1 w-full rounded-lg border border-white/20 bg-zinc-900 px-3 py-2" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} /></label>
            <label className="text-sm">Método<select className="mt-1 w-full rounded-lg border border-white/20 bg-zinc-900 px-3 py-2" value={customer.payment} onChange={(e) => setCustomer({ ...customer, payment: e.target.value as Payment })}><option value="pickup">Pickup</option><option value="delivery">Delivery</option></select></label>
            <label className="text-sm">Notas<textarea className="mt-1 w-full rounded-lg border border-white/20 bg-zinc-900 px-3 py-2" rows={2} value={customer.notes} onChange={(e) => setCustomer({ ...customer, notes: e.target.value })} /></label>
            <button onClick={() => setSuccess(true)} className="w-full rounded-xl bg-white px-4 py-2 font-semibold text-black">Simular pedido</button>
          </div>
          <AnimatePresence>{success ? <motion.p initial={reduce ? undefined : { opacity: 0 }} animate={reduce ? undefined : { opacity: 1 }} className="rounded-lg border border-emerald-400/40 bg-emerald-500/15 p-2 text-sm text-emerald-300">Pedido simulado con éxito. Estado enviado a cocina mock.</motion.p> : null}</AnimatePresence>
        </aside>
      </section>

      <section className="grid gap-3 rounded-2xl border border-white/15 bg-zinc-900/70 p-4 sm:grid-cols-3">
        <article><h3 className="font-semibold">Cómo funciona</h3><p className="text-sm text-zinc-300">Elige promo, agrega ítems, confirma datos y simula pedido.</p></article>
        <article><h3 className="font-semibold">Estado pickup/delivery</h3><p className="text-sm text-zinc-300">Pickup 12 min · Delivery 28 min estimado.</p></article>
        <article><h3 className="font-semibold">Fresh batch</h3><p className="text-sm text-zinc-300">Hecho al momento, carne sellada y papas recién fritas.</p></article>
      </section>
    </main>
  );
}
