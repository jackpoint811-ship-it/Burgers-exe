import React from 'react';
import ReactDOM from 'react-dom/client';
import { PublicOrderApp } from './components/PublicOrderApp';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PublicOrderApp />
  </React.StrictMode>
);
