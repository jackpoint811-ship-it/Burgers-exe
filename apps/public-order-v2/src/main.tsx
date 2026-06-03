import React from 'react';
import ReactDOM from 'react-dom/client';
import { PublicOrderApp } from './components/PublicOrderApp';
import { TicketsLookupPage } from './components/TicketsLookupPage';
import './styles.css';
import './tickets.css';

const normalizedPath = window.location.pathname.replace(/\/+$/, '') || '/';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {normalizedPath === '/tickets' ? <TicketsLookupPage /> : <PublicOrderApp />}
  </React.StrictMode>
);
