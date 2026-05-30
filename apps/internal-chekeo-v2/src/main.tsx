import React from 'react';
import ReactDOM from 'react-dom/client';
import { InternalChekeoApp } from './components/InternalChekeoApp';
import { InternalV2ErrorBoundary } from './components/InternalV2ErrorBoundary';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <InternalV2ErrorBoundary>
      <InternalChekeoApp />
    </InternalV2ErrorBoundary>
  </React.StrictMode>
);
