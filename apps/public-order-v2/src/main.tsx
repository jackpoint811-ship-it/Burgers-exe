import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { createPortal } from 'react-dom';
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
  const [target, setTarget] = useState<HTMLElement | null>(null);

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

  useEffect(() => {
    if (!config) return undefined;

    const updateTarget = () => {
      const candidate = document.querySelector<HTMLElement>('.raffle-banner-copy');
      if (candidate) {
        setTarget(candidate);
        return true;
      }
      return false;
    };

    if (updateTarget()) return undefined;

    const observer = new MutationObserver(() => {
      if (updateTarget()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [config]);

  if (!config || !target) return null;

  return createPortal(
    <a className="raffle-ticket-cta terminal-button" href={config.ticketsPageUrl || '/tickets'}>🎟️ Consulta tus tickets</a>,
    target
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {normalizedPath === '/tickets' ? <TicketsLookupPage /> : <><PublicOrderApp /><HomeTicketsCta /></>}
  </React.StrictMode>
);
