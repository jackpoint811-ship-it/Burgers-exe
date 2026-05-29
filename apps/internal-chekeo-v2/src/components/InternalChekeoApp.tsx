import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { mockOrders, operatorStats, type MockOrder, type OrderStatus, type OrderV2, type OrderV2Event, type OrderV2Status } from '@config/index';
import { Button, Card, StatusPill } from '@ui/index';
import { ADMIN_TOKEN_CHANGED_EVENT, clearAdminToken, getAdminToken, setAdminToken as persistAdminToken } from '../lib/admin-token';
import { fetchOrdersV2Admin, updateOrderV2Status } from '../lib/orders-v2-admin';
import { CatalogAdminPanel } from './CatalogAdminPanel';

type TabKey = 'inicio' | 'pedidos' | 'cocina' | 'pagos' | 'historial' | 'catalogo';
type OrdersSource = 'd1' | 'mock' | 'fallback';
type InternalOrder = Omit<MockOrder, 'paymentMethod' | 'paymentState' | 'channel'> & {
  channel: 'walk-in' | 'pickup' | 'delivery';
  paymentMethod: string;
  paymentState: string;
  customerPhone?: string;
  source?: string;
  updatedAt?: string;
};

type StatusAction = { status: OrderStatus; label: string; tone?: 'danger' };
type OrdersRuntime = {
  source: OrdersSource;
  loading: boolean;
  actionOrderId: string | null;
  error: string | null;
  notice: string | null;
  adminToken: string;
  setTokenInput: (value: string) => void;
  tokenInput: string;
  activateToken: () => void;
  clearToken: () => void;
  reload: (includeTerminal?: boolean) => void;
};

const statusLabel: Record<OrderStatus, string> = { new: 'Nuevo', preparing: 'En preparación', ready: 'Listo', delivered: 'Entregado', cancelled: 'Cancelado' };
const statusTone: Record<OrderStatus, string> = { new: 'border-sky-400/40 text-sky-200', preparing: 'border-amber-400/40 text-amber-200', ready: 'border-emerald-400/40 text-emerald-200', delivered: 'border-zinc-500/40 text-zinc-200', cancelled: 'border-rose-500/40 text-rose-300' };
const terminalStatuses = new Set<OrderStatus>(['delivered', 'cancelled']);

const asInternalOrders = (orders: MockOrder[]): InternalOrder[] => orders;
const formatCurrency = (value: number) => `$${value.toFixed(2)}`;
const formatDateTime = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
};
const mapKitchenStation = (status: OrderV2Status): InternalOrder['kitchenStation'] => (status === 'new' ? 'grill' : status === 'preparing' ? 'assembly' : 'dispatch');

const mapOrderV2ToInternalOrder = (order: OrderV2): InternalOrder => {
  const events: OrderV2Event[] = order.events?.length ? order.events : [{ id: `created-${order.id}`, orderId: order.id, type: 'created', actor: order.source, createdAt: order.createdAt }];
  return {
  id: order.id,
  folio: order.folio,
  customer: order.customerName,
  customerPhone: order.customerPhone,
  channel: order.orderMode,
  createdAt: formatDateTime(order.createdAt),
  updatedAt: formatDateTime(order.updatedAt),
  status: order.status,
  priority: 'normal',
  paymentMethod: order.paymentMethod,
  paymentState: order.paymentStatus,
  note: order.notes,
  items: order.items.map((item) => ({ name: item.name, qty: item.qty, price: item.unitPrice })),
  total: order.total,
  kitchenStation: mapKitchenStation(order.status),
  source: order.source,
  timeline: events.map((event) => ({
    id: event.id,
    label: event.type === 'status_changed' && event.nextStatus ? `Estado: ${statusLabel[event.nextStatus]}` : event.type,
    time: formatDateTime(event.createdAt),
    tone: event.nextStatus === 'ready' || event.nextStatus === 'delivered' ? 'success' : event.nextStatus === 'cancelled' ? 'warning' : 'default'
  }))
};
};

const StatusBadge = ({ status }: { status: OrderStatus }) => <StatusPill className={statusTone[status]}>{statusLabel[status]}</StatusPill>;

const SourcePanel = ({ runtime, includeTerminal = false }: { runtime: OrdersRuntime; includeTerminal?: boolean }) => (
  <Card className='mb-2.5 p-3'>
    <div className='flex flex-col gap-2 md:flex-row md:items-center md:justify-between'>
      <div>
        <p className='text-xs font-bold uppercase tracking-[0.2em] text-cyan-200'>{runtime.source === 'd1' ? 'Pedidos live D1' : 'Fallback mock'}</p>
        <p className='text-[11px] text-zinc-400'>Source: {runtime.source === 'd1' ? 'Órdenes live · Backend V2' : runtime.adminToken ? 'Fallback mock por error de Backend V2' : 'Activa modo admin para operar órdenes live'}</p>
      </div>
      <div className='flex flex-col gap-2 md:flex-row'>
        <Button className='border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs disabled:opacity-40' onClick={() => runtime.reload(includeTerminal)} disabled={runtime.loading || !runtime.adminToken}>{runtime.loading ? 'Cargando…' : 'Recargar órdenes'}</Button>
      </div>
    </div>
    {!runtime.adminToken ? <div className='mt-3 rounded-lg border border-cyan-400/20 bg-cyan-400/10 p-2'><p className='text-xs text-cyan-100'>Activa modo admin para cargar órdenes live.</p><div className='mt-2 flex flex-col gap-2 md:flex-row'><input className='input md:mt-0' type='password' placeholder='Token admin preview' value={runtime.tokenInput} onChange={(e) => runtime.setTokenInput(e.target.value)} /><Button className='bg-cyan-400 text-black' onClick={runtime.activateToken}>Activar modo admin</Button></div></div> : <div className='mt-3 flex items-center gap-2'><span className='chip'>Token admin activo en sessionStorage</span><Button className='border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px]' onClick={runtime.clearToken}>Cerrar modo admin</Button></div>}
    {runtime.error ? <p className='mt-2 rounded bg-rose-500/10 px-2 py-1 text-xs text-rose-200'>{runtime.error}</p> : null}
    {runtime.notice ? <p className='mt-2 rounded bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200'>{runtime.notice}</p> : null}
  </Card>
);

const PinLoginMock = ({ onLogin }: { onLogin: () => void }) => <main className='shell'><section className='login card'><h1>Internal Chekeo V2</h1><p className='muted'>Vista V2 · Backend V2 con fallback local</p><label htmlFor='pin'>PIN</label><input id='pin' type='password' className='input' placeholder='••••' /><Button className='mt-3 bg-cyan-400 text-black' onClick={onLogin}>Entrar a consola</Button></section></main>;
const OperatorHeader = ({ active, onLogout, source }: { active: number; onLogout: () => void; source: OrdersSource }) => <header className='card header-compact'><div><h1 className='text-sm font-bold md:text-base'>Burgers.exe Operator Console</h1><p className='text-[11px] text-zinc-400'>Activos {active} · {source === 'd1' ? 'Backend V2' : 'Fallback mock'} · {new Date().toLocaleTimeString()}</p></div><Button className='border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px]' onClick={onLogout}>Logout mock</Button></header>;
const DashboardHome = ({ orders, source }: { orders: InternalOrder[]; source: OrdersSource }) => { const active = orders.filter((o) => !terminalStatuses.has(o.status)).length; const pending = orders.filter((o) => o.status === 'new').length; return <section className='grid gap-2.5 md:grid-cols-3'><Card className='p-2.5'><p className='muted'>Órdenes activas</p><p className='text-xl font-black'>{source === 'd1' ? active : operatorStats.activeOrders}</p></Card><Card className='p-2.5'><p className='muted'>Pendientes</p><p className='text-xl font-black'>{source === 'd1' ? pending : operatorStats.pendingOrders}</p></Card><Card className='p-2.5'><p className='muted'>Carga cocina</p><p className='text-xl font-black'>{operatorStats.kitchenLoad}%</p></Card><Card className='md:col-span-2 p-2.5'><h3 className='mb-2 font-bold'>Urgentes ahora</h3>{orders.filter((o) => o.priority === 'urgent' || o.status === 'new').slice(0, 4).map((o) => <div key={o.id} className='row'>{o.folio} · {o.customer} · {o.createdAt}</div>)}</Card><Card className='p-2.5'><h3 className='font-bold'>Estado del turno</h3><p className='muted'>{source === 'd1' ? 'Órdenes live desde D1' : 'Fallback mock para QA visual'}</p></Card></section>; };

const getPedidoActions = (status: OrderStatus): StatusAction[] => terminalStatuses.has(status) ? [] : [{ status: status === 'new' ? 'preparing' : status === 'preparing' ? 'ready' : 'delivered', label: status === 'new' ? 'Marcar en preparación' : status === 'preparing' ? 'Marcar listo' : 'Marcar entregado' }, { status: 'cancelled', label: 'Cancelar', tone: 'danger' }];
const getKitchenActions = (status: OrderStatus): StatusAction[] => status === 'new' ? [{ status: 'preparing', label: 'Iniciar' }] : status === 'preparing' ? [{ status: 'ready', label: 'Listo' }] : status === 'ready' ? [{ status: 'delivered', label: 'Entregar' }] : [];

const ActionButtons = ({ order, actions, onMove, actionOrderId }: { order: InternalOrder; actions: StatusAction[]; onMove: (id: string, next: OrderStatus) => void; actionOrderId: string | null }) => {
  const busy = actionOrderId === order.id;
  return <div className='flex flex-wrap gap-1'>{actions.map((action) => <button key={action.status} className={`btn-sm ${action.tone === 'danger' ? 'danger' : ''}`} onClick={() => onMove(order.id, action.status)} disabled={busy}>{busy ? 'Actualizando…' : action.label}</button>)}</div>;
};

const OrderItems = ({ order }: { order: InternalOrder }) => <div className='mt-2 space-y-1 rounded-lg border border-dashed border-zinc-700 p-2'>{order.items.map((i, idx) => <div key={`${order.id}-${idx}`} className='row'><span>{i.qty}x {i.name}</span><span>{formatCurrency(i.price)}</span></div>)}</div>;
const CompactRow = ({ order, onOpen }: { order: InternalOrder; onOpen: () => void }) => <Card className='p-2.5'><div className='flex items-start justify-between gap-2'><div><p className='text-sm font-bold'>{order.folio} · {order.customer}</p><p className='text-[11px] text-zinc-400'>{order.createdAt} · {order.channel} · {order.paymentMethod}/{order.paymentState}</p>{order.customerPhone ? <p className='text-[11px] text-zinc-500'>Tel: {order.customerPhone}</p> : null}</div><StatusBadge status={order.status} /></div>{order.note ? <p className='mt-1.5 rounded bg-amber-500/10 px-2 py-1 text-[11px] text-amber-200'>Nota crítica: {order.note}</p> : null}<Button className='mt-2 border border-zinc-700 bg-zinc-900 py-1 text-[11px]' onClick={onOpen}>Abrir ticket</Button></Card>;

const OrdersBoard = ({ orders, setSelected, runtime, move }: { orders: InternalOrder[]; setSelected: (o: InternalOrder) => void; runtime: OrdersRuntime; move: (id: string, s: OrderStatus) => void }) => <section><SourcePanel runtime={runtime} /><div className='grid gap-2'>{orders.map((o) => <Card key={o.id} className='p-3'><CompactRow order={o} onOpen={() => setSelected(o)} /><div className='mt-2 grid gap-1 text-xs text-zinc-300 md:grid-cols-2'><span>Modo entrega: {o.channel}</span><span>Método de pago: {o.paymentMethod}</span><span>Payment status: {o.paymentState}</span><span>Total: {formatCurrency(o.total)}</span><span>Source: {o.source ?? 'mock'}</span><span>Creado: {o.createdAt}</span></div><OrderItems order={o} /><div className='mt-2'><ActionButtons order={o} actions={getPedidoActions(o.status)} onMove={move} actionOrderId={runtime.actionOrderId} /></div></Card>)}</div></section>;

const KitchenQueue = ({ orders, move, runtime }: { orders: InternalOrder[]; move: (id: string, s: OrderStatus) => void; runtime: OrdersRuntime }) => { const activeOrders = orders.filter((o) => !terminalStatuses.has(o.status)); return <section><SourcePanel runtime={runtime} /><div className='grid gap-3 md:grid-cols-3'>{(['new', 'preparing', 'ready'] as OrderStatus[]).map((s) => { const list = activeOrders.filter((o) => o.status === s); return <Card key={s} className='p-3'><div className='mb-2 flex items-center justify-between'><h3 className='font-bold'>{statusLabel[s]}</h3><span className='chip'>{list.length}</span></div><div className='space-y-2'>{list.map((o) => <div key={o.id} className='rounded-lg border border-zinc-800 bg-zinc-950/50 p-2'><div className='flex items-start justify-between gap-2'><div><p className='text-xs font-semibold'>{o.folio} · {o.createdAt}</p><p className='text-[11px] text-zinc-400'>{o.customer} · {o.kitchenStation}</p></div><StatusBadge status={o.status} /></div>{o.note ? <p className='mt-1 rounded bg-amber-500/10 px-2 py-1 text-[11px] text-amber-200'>{o.note}</p> : null}<OrderItems order={o} /><div className='mt-2'><ActionButtons order={o} actions={getKitchenActions(o.status)} onMove={move} actionOrderId={runtime.actionOrderId} /></div></div>)}</div></Card>;})}</div></section>; };
const PaymentNotesPanel = ({ orders }: { orders: InternalOrder[] }) => <section className='card'><h3 className='mb-2'>Pagos pendientes y notas</h3>{orders.filter((o) => o.paymentState === 'pending' || o.note).map((o) => <div key={o.id} className='row'><span>{o.folio} · {o.paymentMethod} · {o.createdAt}</span><span className='muted'>{o.note ?? 'Sin nota'}</span></div>)}</section>;
const HistoryPanel = ({ orders, runtime }: { orders: InternalOrder[]; runtime: OrdersRuntime }) => <section><SourcePanel runtime={runtime} includeTerminal /><Card className='p-3'><h3 className='mb-2'>Historial {runtime.source === 'd1' ? 'Backend V2' : 'local'}</h3>{orders.filter((o) => terminalStatuses.has(o.status)).map((o) => <div key={o.id} className='row'><span>{o.folio} · {o.customer} · {o.createdAt}</span><StatusBadge status={o.status} /></div>)}</Card></section>;
const getNextStatus = (status: OrderStatus): OrderStatus => (status === 'new' ? 'preparing' : status === 'preparing' ? 'ready' : status === 'ready' ? 'delivered' : status);

const OrderDetailModal = ({ selected, onClose, onMove, actionOrderId }: { selected: InternalOrder | null; onClose: () => void; onMove: (id: string, next: OrderStatus) => void; actionOrderId: string | null }) => {
  useEffect(() => { const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [onClose]);
  if (!selected) return null;
  const nextStatus = getNextStatus(selected.status);
  const canAdvance = nextStatus !== selected.status;
  const canMarkReady = selected.status !== 'ready' && selected.status !== 'delivered' && selected.status !== 'cancelled';
  const canCancel = selected.status !== 'delivered' && selected.status !== 'cancelled';
  const busy = actionOrderId === selected.id;
  const runAction = (next: OrderStatus) => { onMove(selected.id, next); if (!busy) onClose(); };
  return <div className='overlay' role='dialog' aria-modal='true' aria-labelledby='order-title' onClick={onClose}><section className='modal' onClick={(e) => e.stopPropagation()}><div className='flex items-start justify-between'><div><h2 id='order-title' className='text-lg font-black'>{selected.folio}</h2><p className='text-xs text-zinc-400'>{selected.customer} · {selected.createdAt} · {selected.channel}</p>{selected.customerPhone ? <p className='text-xs text-zinc-500'>Tel: {selected.customerPhone}</p> : null}</div><StatusBadge status={selected.status} /></div><div className='mt-3 grid grid-cols-2 gap-2 text-sm'><p>Pago: {selected.paymentMethod}/{selected.paymentState}</p><p>Total: {formatCurrency(selected.total)}</p><p>Source: {selected.source ?? 'mock'}</p><p>Estación: {selected.kitchenStation}</p></div><OrderItems order={selected} /><div className='mt-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-2 text-xs text-zinc-300'>{selected.timeline.map((t) => <p key={t.id}>{t.time} · {t.label}</p>)}</div><div className='mt-3 flex flex-wrap gap-2'>{canAdvance ? <Button onClick={() => runAction(nextStatus)} className='flex-1 border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs disabled:opacity-40' disabled={busy}>{busy ? 'Actualizando…' : 'Avanzar'}</Button> : null}{canMarkReady ? <Button onClick={() => runAction('ready')} className='flex-1 border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs disabled:opacity-40' disabled={busy}>Marcar listo</Button> : null}{canCancel ? <Button onClick={() => runAction('cancelled')} className='flex-1 border border-rose-700 bg-rose-950/50 px-3 py-1.5 text-xs text-rose-200 disabled:opacity-40' disabled={busy}>Cancelar</Button> : null}</div><Button className='mt-2 w-full border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs' onClick={onClose}>Cerrar</Button></section></div>;
};

const OperatorTabs = ({ tab, setTab, content }: { tab: TabKey; setTab: (v: TabKey) => void; content: ReactNode }) => <Tabs.Root value={tab} onValueChange={(v) => setTab(v as TabKey)}><Tabs.List className='tabs'>{[['inicio', 'Inicio'], ['pedidos', 'Pedidos'], ['cocina', 'Cocina'], ['pagos', 'Pagos'], ['historial', 'Historial'], ['catalogo', 'Catálogo']].map(([k, l]) => <Tabs.Trigger key={k} value={k} className='tab'>{l}</Tabs.Trigger>)}</Tabs.List>{content}</Tabs.Root>;

export function InternalChekeoApp() {
  const [logged, setLogged] = useState(false);
  const [tab, setTab] = useState<TabKey>('inicio');
  const [orders, setOrders] = useState<InternalOrder[]>(asInternalOrders(mockOrders));
  const [selected, setSelected] = useState<InternalOrder | null>(null);
  const [ordersSource, setOrdersSource] = useState<OrdersSource>('mock');
  const [adminToken, setAdminTokenState] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [ordersNotice, setOrdersNotice] = useState<string | null>(null);
  const [actionOrderId, setActionOrderId] = useState<string | null>(null);
  const reduce = useReducedMotion();

  const loadLiveOrders = useCallback(async (includeTerminal = tab === 'historial') => {
    const token = getAdminToken();
    setAdminTokenState(token);
    if (!token) {
      setOrders(asInternalOrders(mockOrders));
      setOrdersSource('mock');
      setOrdersError('Activa modo admin para cargar órdenes live');
      return;
    }
    setLoadingOrders(true);
    setOrdersError(null);
    try {
      const liveOrders = await fetchOrdersV2Admin(token, { includeTerminal, limit: includeTerminal ? 50 : 25 });
      setOrders(liveOrders.map(mapOrderV2ToInternalOrder));
      setOrdersSource('d1');
      setOrdersNotice('Órdenes live actualizadas desde Backend V2');
    } catch (error) {
      setOrders(asInternalOrders(mockOrders));
      setOrdersSource('fallback');
      setOrdersError(error instanceof Error ? error.message : 'No se pudieron cargar órdenes live; mostrando fallback mock');
    } finally {
      setLoadingOrders(false);
    }
  }, [tab]);

  useEffect(() => {
    const syncToken = () => setAdminTokenState(getAdminToken());
    syncToken();
    window.addEventListener(ADMIN_TOKEN_CHANGED_EVENT, syncToken);
    return () => window.removeEventListener(ADMIN_TOKEN_CHANGED_EVENT, syncToken);
  }, []);

  useEffect(() => {
    if (logged && tab !== 'catalogo') void loadLiveOrders(tab === 'historial');
  }, [logged, tab, adminToken, loadLiveOrders]);

  const move = async (id: string, s: OrderStatus) => {
    if (ordersSource !== 'd1') {
      setOrders((p) => p.map((o) => (o.id === id ? { ...o, status: s } : o)));
      setOrdersNotice('Estado actualizado en fallback mock');
      return;
    }
    const token = getAdminToken();
    if (!token) { setOrdersError('Activa modo admin para operar órdenes live'); return; }
    setActionOrderId(id);
    setOrdersError(null);
    try {
      const updated = await updateOrderV2Status(token, id, s, `Internal V2 ${tab}`);
      const mapped = mapOrderV2ToInternalOrder(updated);
      setOrders((p) => {
        const next = p.map((o) => (o.id === id ? mapped : o));
        return tab === 'historial' ? next : next.filter((o) => !terminalStatuses.has(o.status));
      });
      setSelected((current) => (current?.id === id ? mapped : current));
      setOrdersNotice(`${mapped.folio} actualizado a ${statusLabel[mapped.status]}`);
    } catch (error) {
      setOrdersError(error instanceof Error ? error.message : 'No se pudo actualizar el estado live');
    } finally {
      setActionOrderId(null);
    }
  };

  const runtime: OrdersRuntime = {
    source: ordersSource,
    loading: loadingOrders,
    actionOrderId,
    error: ordersError,
    notice: ordersNotice,
    adminToken,
    tokenInput,
    setTokenInput,
    activateToken: () => { if (!tokenInput.trim()) return; persistAdminToken(tokenInput); setAdminTokenState(tokenInput.trim()); setTokenInput(''); void loadLiveOrders(tab === 'historial'); },
    clearToken: () => { clearAdminToken(); setAdminTokenState(''); setOrdersSource('mock'); setOrders(asInternalOrders(mockOrders)); setOrdersError('Activa modo admin para cargar órdenes live'); },
    reload: (includeTerminal?: boolean) => { void loadLiveOrders(Boolean(includeTerminal)); }
  };

  const active = orders.filter((o) => !terminalStatuses.has(o.status));
  const content = useMemo(() => ({ inicio: <DashboardHome orders={orders} source={ordersSource} />, pedidos: <OrdersBoard orders={orders.filter((o) => !terminalStatuses.has(o.status))} setSelected={setSelected} runtime={runtime} move={move} />, cocina: <KitchenQueue orders={orders} move={move} runtime={runtime} />, pagos: <PaymentNotesPanel orders={orders} />, historial: <HistoryPanel orders={orders} runtime={runtime} />, catalogo: <CatalogAdminPanel /> })[tab], [orders, ordersSource, tab, runtime]);
  if (!logged) return <PinLoginMock onLogin={() => setLogged(true)} />;
  return <main className='shell'><OperatorHeader active={active.length} source={ordersSource} onLogout={() => setLogged(false)} /><OperatorTabs tab={tab} setTab={setTab} content={<AnimatePresence mode='wait'><motion.div key={tab} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? {} : { opacity: 0, y: -8 }} transition={{ duration: 0.18 }} className='mt-2'>{content}</motion.div></AnimatePresence>} /><OrderDetailModal selected={selected} onClose={() => setSelected(null)} onMove={move} actionOrderId={actionOrderId} /></main>;
}
