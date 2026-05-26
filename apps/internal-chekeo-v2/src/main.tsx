import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Tabs from '@radix-ui/react-tabs';
import { Activity, ShieldCheck, Timer } from 'lucide-react';
import { ShellCard } from '@ui/shell-card';
import './styles.css';

function App() {
  return (
    <main className="mx-auto min-h-screen max-w-6xl space-y-6 bg-black p-6 text-zinc-100">
      <header className="rounded-2xl border border-zinc-700 bg-zinc-900 p-5">
        <h1 className="text-3xl font-bold">Internal Chekeo V2 Console (Dark Only)</h1>
        <p className="mt-2 text-zinc-400">PIN shell + dashboard operativo placeholder.</p>
      </header>
      <div className="grid gap-4 md:grid-cols-3">
        <ShellCard title="PIN Shell" subtitle="Entrada operador segura" />
        <ShellCard title="Operator Status" subtitle="Estado en línea"><Activity className="text-emerald-400" /></ShellCard>
        <ShellCard title="Session Guard" subtitle="Auth boundary V2"><ShieldCheck className="text-cyan-400" /></ShellCard>
      </div>
      <Tabs.Root defaultValue="orders">
        <Tabs.List className="flex gap-2">
          <Tabs.Trigger value="orders" className="rounded-lg bg-zinc-800 px-3 py-2">Orders</Tabs.Trigger>
          <Tabs.Trigger value="kitchen" className="rounded-lg bg-zinc-800 px-3 py-2">Kitchen</Tabs.Trigger>
          <Tabs.Trigger value="metrics" className="rounded-lg bg-zinc-800 px-3 py-2">Metrics</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="orders" className="mt-4 grid gap-3 md:grid-cols-2">
          <ShellCard title="Order Card #A102" subtitle="Preparación"><Timer className="text-amber-400" /></ShellCard>
          <ShellCard title="Order Card #A103" subtitle="Listo para entregar" />
        </Tabs.Content>
        <Tabs.Content value="kitchen" className="mt-4"><ShellCard title="Kitchen Queue Placeholder" /></Tabs.Content>
        <Tabs.Content value="metrics" className="mt-4"><ShellCard title="Dashboard Placeholder" /></Tabs.Content>
      </Tabs.Root>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
