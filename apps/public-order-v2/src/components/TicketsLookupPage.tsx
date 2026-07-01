import type { RaffleTicketsLookupResult } from '@config/index';
import { useState } from 'react';
import { lookupRaffleTicketsV2 } from '../lib/raffles-v2';
import '../tickets.css';

type LookupState = 'idle' | 'loading' | 'success' | 'error';
type CopyKind = 'code' | 'link' | 'message';

const digitsOnly = (value: string) => value.replace(/\D/g, '');
const normalizeReferralCode = (value: string) => value.trim().toUpperCase().slice(0, 32);

const formatLookupDate = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

const buildShareUrl = (code: string) => `${window.location.origin}/?ref=${encodeURIComponent(code)}`;

const buildShareMessage = (code: string) => {
  const shareUrl = buildShareUrl(code);
  return `Ya estoy participando en el sorteo de Burgers.exe 🍔🎟️ Usa mi código ${code} cuando hagas tu pedido y me ayudas a sumar tickets. Pide aquí: ${shareUrl}`;
};

const copyTextToClipboard = async (text: string) => {
  if (!text) throw new Error('Nothing to copy');
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(textarea);
  if (!copied) throw new Error('Clipboard unavailable');
};

export const TicketsLookupPage = () => {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [status, setStatus] = useState<LookupState>('idle');
  const [statusText, setStatusText] = useState('');
  const [result, setResult] = useState<RaffleTicketsLookupResult | null>(null);
  const [copyFeedback, setCopyFeedback] = useState('');

  const validateLookup = () => {
    const normalizedPhone = digitsOnly(phone);
    const normalizedCode = normalizeReferralCode(code);
    if (!normalizedPhone && !normalizedCode) {
      setFieldError('Ingresa tu teléfono o tu código referido.');
      return null;
    }
    if (normalizedPhone && normalizedPhone.length < 10) {
      setFieldError('El teléfono debe tener al menos 10 dígitos.');
      return null;
    }
    setFieldError('');
    return { normalizedPhone, normalizedCode };
  };

  const handleLookup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = validateLookup();
    if (!values) return;

    setPhone(values.normalizedPhone);
    setCode(values.normalizedCode);
    setResult(null);
    setStatus('loading');
    setStatusText('Consultando tus tickets...');
    setCopyFeedback('');

    try {
      const response = await lookupRaffleTicketsV2({ phone: values.normalizedPhone, code: values.normalizedCode });
      if (!response.ok || !response.data) throw new Error('lookup failed');
      setResult(response.data);
      if (!response.data.campaign) {
        setStatus('error');
        setStatusText('No hay campaña activa en este momento. Vuelve pronto para consultar tickets.');
        return;
      }
      if (!response.data.found) {
        setStatus('error');
        setStatusText('No encontramos tickets con esos datos.');
        return;
      }
      setStatus('success');
      setStatusText('Tickets encontrados. Puedes revisar tu resumen y compartir tu código.');
    } catch {
      setStatus('error');
      setStatusText('No pudimos consultar tus tickets ahora. Intenta más tarde.');
    }
  };

  const handlePhoneInput = (value: string) => {
    setPhone(digitsOnly(value).slice(0, 16));
    if (fieldError) setFieldError('');
  };

  const handleCodeInput = (value: string) => {
    setCode(normalizeReferralCode(value));
    if (fieldError) setFieldError('');
  };

  const handleCopy = async (kind: CopyKind) => {
    const referralCode = result?.referralCode?.code;
    if (!referralCode) return;
    const shareUrl = buildShareUrl(referralCode);
    const value = kind === 'code' ? referralCode : kind === 'link' ? shareUrl : buildShareMessage(referralCode);
    try {
      await copyTextToClipboard(value);
      setCopyFeedback(kind === 'code' ? 'Código copiado.' : kind === 'link' ? 'Link copiado.' : 'Mensaje copiado.');
    } catch {
      setCopyFeedback('No se pudo copiar automáticamente. Puedes seleccionar el texto manualmente.');
    }
  };

  const participant = result?.participant ?? null;
  const referralCode = result?.referralCode ?? null;
  const canLookup = status !== 'loading' && (phone.length > 0 || code.length > 0);
  const shareMessage = referralCode?.code ? buildShareMessage(referralCode.code) : '';

  return (
    <main className="tickets-page app-shell" aria-labelledby="ticketsPageTitle">
      <section className="terminal-window tickets-hero-card">
        <div className="tickets-hero-lockup">
          <span className="terminal-path">Burgers.exe sorteo</span>
          <h1 id="ticketsPageTitle">Consulta tus tickets</h1>
        </div>
        <p className="hero-copy">Busca con tu teléfono o código referido. La consulta es privada: solo mostramos teléfonos enmascarados.</p>
        <div className="tickets-hero-signal" aria-hidden="true"><span>Tickets</span><strong>Comparte y suma</strong></div>
        <a className="tickets-back-link" href="/">← Volver al menú</a>
      </section>

      <section className="terminal-window tickets-lookup-card" aria-labelledby="lookupTitle">
        <div className="tickets-module-heading">
          <span className="terminal-path">Consulta privada</span>
          <h2 id="lookupTitle">Buscar tickets</h2>
        </div>
        <form onSubmit={handleLookup} noValidate>
          <label className="terminal-label" htmlFor="ticketPhoneInput">
            Teléfono
            <input
              id="ticketPhoneInput"
              name="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="10 dígitos"
              value={phone}
              onChange={(event) => handlePhoneInput(event.target.value)}
              aria-describedby="ticketLookupHelp ticketLookupError"
              aria-invalid={fieldError ? 'true' : 'false'}
              aria-busy={status === 'loading' ? 'true' : 'false'}
            />
          </label>
          <label className="terminal-label" htmlFor="ticketCodeInput">
            Código referido
            <input
              id="ticketCodeInput"
              name="code"
              type="text"
              autoCapitalize="characters"
              autoComplete="off"
              placeholder="TU-CODIGO-01"
              maxLength={32}
              value={code}
              onChange={(event) => handleCodeInput(event.target.value)}
              aria-describedby="ticketLookupHelp ticketLookupError"
              aria-invalid={fieldError ? 'true' : 'false'}
              aria-busy={status === 'loading' ? 'true' : 'false'}
            />
          </label>
          <p className="muted" id="ticketLookupHelp">Ingresa al menos uno. Si escribes teléfono, debe tener mínimo 10 dígitos.</p>
          {fieldError ? <p className="inline-error" id="ticketLookupError" role="alert">{fieldError}</p> : <p id="ticketLookupError" className="sr-only" />}
          <button className="terminal-button" type="submit" disabled={!canLookup}>{status === 'loading' ? 'Consultando...' : 'Consultar tickets'}</button>
        </form>
        <p className={status === 'error' ? 'tickets-status is-error' : status === 'success' ? 'tickets-status is-success' : 'tickets-status'} aria-live="polite">{statusText}</p>
      </section>

      {participant ? (
        <section className="terminal-window tickets-result-card" aria-labelledby="ticketsResultTitle" aria-live="polite">
          <div className="tickets-module-heading">
            <span className="terminal-path">Resultado encontrado</span>
            <h2 id="ticketsResultTitle">Tus oportunidades</h2>
          </div>
          <div className="tickets-count-card" aria-label="Total tickets"><strong>{participant.totalTickets}</strong><span>total tickets</span></div>
          <dl className="tickets-result-list">
            <div><dt>Tickets por burgers</dt><dd>{participant.burgerTickets}</dd></div>
            <div><dt>Tickets por referidos</dt><dd>{participant.referralTickets}</dd></div>
            <div><dt>Tickets extra manuales</dt><dd>{participant.manualExtraTickets}</dd></div>
            <div><dt>Último folio</dt><dd>{participant.lastOrderFolio || '—'}</dd></div>
            <div><dt>Última orden</dt><dd>{formatLookupDate(participant.lastOrderAt)}</dd></div>
            <div><dt>Teléfono</dt><dd>{participant.customerPhoneMasked || 'Teléfono confirmado'}</dd></div>
            {referralCode ? <div><dt>Código referido</dt><dd><code>{referralCode.code}</code></dd></div> : null}
            {referralCode ? <div><dt>Estado del código</dt><dd>{referralCode.isActive ? 'Activo' : 'Inactivo'}</dd></div> : null}
          </dl>
          {referralCode ? <p className="tickets-code-owner">Teléfono del código: {referralCode.ownerPhoneMasked}</p> : null}
          {referralCode ? (
            <>
              <label className="terminal-label" htmlFor="shareMessage">
                Mensaje para WhatsApp
                <textarea id="shareMessage" value={shareMessage} readOnly rows={5} />
              </label>
              <div className="tickets-actions-grid">
                <button type="button" onClick={() => handleCopy('code')}>Copiar código</button>
                <button type="button" onClick={() => handleCopy('link')}>Copiar link</button>
                <button type="button" onClick={() => handleCopy('message')}>Copiar mensaje</button>
                <a className="tickets-whatsapp-button" href={`https://wa.me/?text=${encodeURIComponent(shareMessage)}`} target="_blank" rel="noopener noreferrer">Compartir por WhatsApp</a>
              </div>
              {copyFeedback ? <p className="tickets-status is-success" aria-live="polite">{copyFeedback}</p> : null}
            </>
          ) : null}
        </section>
      ) : referralCode && result?.found ? (
        <section className="terminal-window tickets-result-card" aria-labelledby="ticketsCodeTitle" aria-live="polite">
          <div className="tickets-module-heading">
            <span className="terminal-path">Código encontrado</span>
            <h2 id="ticketsCodeTitle">Código referido</h2>
          </div>
          <div className="tickets-count-card compact" aria-label="Código referido"><strong>{referralCode.code}</strong><span>{referralCode.isActive ? 'activo' : 'inactivo'}</span></div>
          <dl className="tickets-result-list">
            <div><dt>Teléfono enmascarado</dt><dd>{referralCode.ownerPhoneMasked}</dd></div>
            <div><dt>Estado del código</dt><dd>{referralCode.isActive ? 'Activo' : 'Inactivo'}</dd></div>
          </dl>
          <label className="terminal-label" htmlFor="shareMessageCodeOnly">
            Mensaje para WhatsApp
            <textarea id="shareMessageCodeOnly" value={shareMessage} readOnly rows={5} />
          </label>
          <div className="tickets-actions-grid">
            <button type="button" onClick={() => handleCopy('code')}>Copiar código</button>
            <button type="button" onClick={() => handleCopy('link')}>Copiar link</button>
            <button type="button" onClick={() => handleCopy('message')}>Copiar mensaje</button>
            <a className="tickets-whatsapp-button" href={`https://wa.me/?text=${encodeURIComponent(shareMessage)}`} target="_blank" rel="noopener noreferrer">Compartir por WhatsApp</a>
          </div>
          {copyFeedback ? <p className="tickets-status is-success" aria-live="polite">{copyFeedback}</p> : null}
        </section>
      ) : null}
    </main>
  );
};
