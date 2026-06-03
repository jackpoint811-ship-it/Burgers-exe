import { useState } from 'react';

type LookupState = 'idle' | 'loading' | 'success' | 'error';

type ReferralTicketsResult = {
  customerName?: string;
  phoneMasked?: string;
  referralCode?: string;
  ticketsCount?: number;
  shareUrl?: string;
  ticketsLabel?: string;
};

const digitsOnly = (value: string) => value.replace(/\D/g, '');

const buildShareMessage = (data: ReferralTicketsResult) => {
  const code = data.referralCode || '';
  const shareUrl = data.shareUrl || `${window.location.origin}/?ref=${encodeURIComponent(code)}`;
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
  const [phoneError, setPhoneError] = useState('');
  const [status, setStatus] = useState<LookupState>('idle');
  const [statusText, setStatusText] = useState('');
  const [result, setResult] = useState<ReferralTicketsResult | null>(null);
  const [copyFeedback, setCopyFeedback] = useState('');

  const validatePhone = () => {
    const normalized = digitsOnly(phone);
    if (normalized.length < 8) {
      setPhoneError('Escribe al menos 8 dígitos.');
      return '';
    }
    setPhoneError('');
    return normalized;
  };

  const handleLookup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedPhone = validatePhone();
    if (!normalizedPhone) return;

    setResult(null);
    setStatus('loading');
    setStatusText('Consultando tus tickets...');
    setCopyFeedback('');

    try {
      const response = await fetch(`/api/referral-tickets?phone=${encodeURIComponent(normalizedPhone)}`);
      const payload = await response.json().catch(() => null);
      if (response.status === 404 || payload?.error?.code === 'NOT_FOUND') {
        setStatus('error');
        setStatusText('No encontramos tickets con ese teléfono. Revisa el número o participa haciendo tu pedido.');
        return;
      }
      if (!response.ok || payload?.ok !== true || !payload.data) throw new Error('lookup failed');
      setResult(payload.data);
      setStatus('success');
      setStatusText('Tickets encontrados. Ya puedes copiar o compartir tu código.');
    } catch {
      setStatus('error');
      setStatusText('No pudimos consultar tus tickets ahora. Intenta más tarde.');
    }
  };

  const handlePhoneInput = (value: string) => {
    setPhone(digitsOnly(value).slice(0, 14));
    if (phoneError) setPhoneError('');
  };

  const handleCopy = async (kind: 'code' | 'link' | 'message') => {
    if (!result) return;
    const shareUrl = result.shareUrl || `${window.location.origin}/?ref=${encodeURIComponent(result.referralCode || '')}`;
    const value = kind === 'code' ? result.referralCode || '' : kind === 'link' ? shareUrl : buildShareMessage({ ...result, shareUrl });
    try {
      await copyTextToClipboard(value);
      setCopyFeedback(kind === 'code' ? 'Código copiado.' : kind === 'link' ? 'Link copiado.' : 'Mensaje copiado.');
    } catch {
      setCopyFeedback('No se pudo copiar automáticamente. Puedes seleccionar el texto manualmente.');
    }
  };

  const ticketsCount = Number(result?.ticketsCount || 0);
  const shareUrl = result?.shareUrl || (result?.referralCode ? `${window.location.origin}/?ref=${encodeURIComponent(result.referralCode)}` : '');
  const shareMessage = result ? buildShareMessage({ ...result, shareUrl }) : '';

  return (
    <main className="tickets-page app-shell" aria-labelledby="ticketsPageTitle">
      <section className="terminal-window tickets-hero-card">
        <span className="terminal-path">Burgers.exe campaign module</span>
        <h1 id="ticketsPageTitle">🎟️ Consulta tus tickets</h1>
        <p className="hero-copy">Ingresa tu teléfono para ver cuántos tickets tienes, copiar tu código de referido y compartirlo con tus compas.</p>
        <a className="tickets-back-link" href="/">← Volver al menú</a>
      </section>

      <section className="terminal-window tickets-lookup-card" aria-labelledby="lookupTitle">
        <span className="terminal-path">Lookup</span>
        <h2 id="lookupTitle">Buscar por teléfono</h2>
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
              aria-describedby="ticketPhoneHelp ticketPhoneError"
              aria-invalid={phoneError ? 'true' : 'false'}
              aria-busy={status === 'loading' ? 'true' : 'false'}
              required
            />
          </label>
          <p className="muted" id="ticketPhoneHelp">Usa el mismo número con el que hiciste tu pedido.</p>
          {phoneError ? <p className="inline-error" id="ticketPhoneError" role="alert">{phoneError}</p> : <p id="ticketPhoneError" className="sr-only" />}
          <button className="terminal-button" type="submit" disabled={status === 'loading'}>{status === 'loading' ? 'Consultando...' : 'Consultar tickets'}</button>
        </form>
        <p className={status === 'error' ? 'tickets-status is-error' : status === 'success' ? 'tickets-status is-success' : 'tickets-status'} aria-live="polite">{statusText}</p>
      </section>

      {result ? (
        <section className="terminal-window tickets-result-card" aria-labelledby="ticketsResultTitle" aria-live="polite">
          <span className="terminal-path">Resultado encontrado</span>
          <h2 id="ticketsResultTitle">Tus oportunidades</h2>
          <div className="tickets-count-card" aria-label="Cantidad de tickets"><strong>{ticketsCount}</strong><span>{result.ticketsLabel || 'tickets'}</span></div>
          <p className="tickets-copy">Tienes {ticketsCount} tickets.</p>
          <dl className="tickets-result-list">
            <div><dt>Cliente</dt><dd>{result.customerName || 'Cliente Burgers.exe'}</dd></div>
            <div><dt>Teléfono</dt><dd>{result.phoneMasked || 'Teléfono confirmado'}</dd></div>
            <div><dt>Código de referido</dt><dd><code>{result.referralCode || '—'}</code></dd></div>
          </dl>
          <label className="terminal-label" htmlFor="shareMessage">
            Copy listo para WhatsApp
            <textarea id="shareMessage" value={shareMessage} readOnly rows={5} />
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
