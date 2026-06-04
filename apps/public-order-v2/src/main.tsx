import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { PublicOrderApp } from './components/PublicOrderApp';
import { TicketsLookupPage } from './components/TicketsLookupPage';
import './styles.css';
import './tickets.css';

const normalizedPath = window.location.pathname.replace(/\/+$/, '') || '/';

type CampaignConfig = {
  enabled?: boolean;
  ticketsPageEnabled?: boolean;
  ticketsPageUrl?: string;
  menuCtaLabel?: string;
  name?: string;
};

const HomeTicketsCta = () => {
  const [config, setConfig] = useState<CampaignConfig | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/campaign-config')
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => {
        if (!active) return;
        const data = payload?.data as CampaignConfig | undefined;
        if (data?.enabled === true && data?.ticketsPageEnabled === true) setConfig(data);
      })
      .catch(() => {
        if (active) setConfig(null);
      });
    return () => { active = false; };
  }, []);

  if (!config) return null;
  return (
    <aside className="home-tickets-cta" aria-label="Consulta de tickets del sorteo">
      <div>
        <span>{config.name || 'Sorteo activo'}</span>
        <strong>Consulta tus tickets y comparte tu código.</strong>
      </div>
      <a href={config.ticketsPageUrl || '/tickets'}>{config.menuCtaLabel || 'Consulta tus tickets'}</a>
    </aside>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {normalizedPath === '/tickets' ? <TicketsLookupPage /> : <><HomeTicketsCta /><PublicOrderApp /></>}
  </React.StrictMode>
);
