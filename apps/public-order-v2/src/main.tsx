import React from 'react';
import ReactDOM from 'react-dom/client';
import { motion } from 'framer-motion';
import { ShellCard } from '@ui/shell-card';
import { menuItems, promoCards, siteConfig } from '@config/index';
import './styles.css';

function App() {
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <motion.header initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-neon/40 bg-zinc-900/80 p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-neon">V2 Placeholder Experience</p>
        <h1 className="mt-2 text-4xl font-black">{siteConfig.brandName} — Landing + Pedido</h1>
        <p className="mt-2 text-zinc-300">Hero radical inicial listo para iterar con datos reales.</p>
        <button className="mt-4 rounded-xl bg-neon px-4 py-2 font-semibold text-black">{siteConfig.heroCta}</button>
      </motion.header>
      <div className="grid gap-4 md:grid-cols-2">
        <ShellCard title="Promo Cards" subtitle="Bloques grandes y memorables">
          {promoCards.map((promo) => <p key={promo.id} className="mb-2 text-sm">• {promo.title} — {promo.description}</p>)}
        </ShellCard>
        <ShellCard title="Menu Preview" subtitle="Items destacados + upsell">
          {menuItems.slice(0, 3).map((item) => <p key={item.sku} className="mb-2 text-sm">• {item.name} (${item.price})</p>)}
        </ShellCard>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <ShellCard title="Order CTA Placeholder" subtitle="Entrada rápida desde hero o promos" />
        <ShellCard title="Summary Placeholder" subtitle="Resumen y checkout progresivo" />
      </div>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
