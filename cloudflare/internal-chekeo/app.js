(() => {
  const state = { activeTab: 'inicio' };
  let hasBootedInternalApp = false;

  const pinScreen = document.querySelector('#pin-screen');
  const internalApp = document.querySelector('#internal-app');
  const pinForm = document.querySelector('#pin-form');
  const pinInput = document.querySelector('#pin-input');
  const pinSubmit = document.querySelector('#pin-submit');
  const authStatus = document.querySelector('#auth-status');
  const logoutButton = document.querySelector('#logout-button');

  function showAuthStatus(message) {
    if (authStatus) authStatus.textContent = message;
  }

  function setPinVisibility(visible) {
    pinScreen?.classList.toggle('is-hidden', !visible);
  }

  function setAppVisibility(visible) {
    internalApp?.classList.toggle('is-hidden', !visible);
  }

  async function checkSession() {
    const response = await fetch('/api/session', { method: 'GET', credentials: 'same-origin' });
    const payload = await response.json();
    return Boolean(payload?.ok && payload?.data?.authenticated);
  }

  async function authenticateWithPin(pin) {
    const response = await fetch('/api/auth', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    });

    const payload = await response.json();
    return Boolean(response.ok && payload?.ok && payload?.data?.authenticated);
  }

  async function logoutSession() {
    await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' });
  }

  function showToast(message) {
    const toast = document.querySelector('.status-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove('is-hidden');
    window.setTimeout(() => toast.classList.add('is-hidden'), 1600);
  }

  function renderTabs() {
    const tabButtons = Array.from(document.querySelectorAll('[data-tab-target]'));
    const tabPanels = Array.from(document.querySelectorAll('[data-tab-panel]'));
    tabButtons.forEach((button) => button.classList.toggle('is-active', button.dataset.tabTarget === state.activeTab));
    tabPanels.forEach((panel) => panel.classList.toggle('is-hidden', panel.dataset.tabPanel !== state.activeTab));
  }

  function setActiveTab(nextTab) {
    if (!nextTab || nextTab === state.activeTab) return;
    state.activeTab = nextTab;
    renderTabs();
    showToast(`Vista local: ${nextTab}`);
  }

  function initScaffold() {
    document.querySelectorAll('[data-tab-target]').forEach((button) => {
      button.addEventListener('click', () => setActiveTab(button.dataset.tabTarget));
    });

    document.querySelectorAll('[data-placeholder-action]').forEach((button) => {
      button.addEventListener('click', () => {
        showToast(`Acción de prueba en ${button.dataset.placeholderAction}. Sin conexión backend.`);
      });
    });

    logoutButton?.addEventListener('click', async () => {
      await logoutSession();
      setAppVisibility(false);
      setPinVisibility(true);
      showAuthStatus('Sesión cerrada.');
    });

    renderTabs();
  }

  function bootInternalAppOnce() {
    if (hasBootedInternalApp) return;
    initScaffold();
    hasBootedInternalApp = true;
  }

  async function handlePinSubmit(event) {
    event.preventDefault();
    const pin = pinInput?.value?.trim() || '';
    pinSubmit.disabled = true;
    showAuthStatus('Validando…');

    try {
      const ok = await authenticateWithPin(pin);
      if (!ok) {
        showAuthStatus('PIN inválido. Intenta de nuevo.');
        return;
      }

      if (pinInput) pinInput.value = '';
      showAuthStatus('');
      setPinVisibility(false);
      setAppVisibility(true);
      bootInternalAppOnce();
    } catch {
      showAuthStatus('PIN inválido. Intenta de nuevo.');
    } finally {
      pinSubmit.disabled = false;
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    pinForm?.addEventListener('submit', handlePinSubmit);

    try {
      const authenticated = await checkSession();
      if (authenticated) {
        setPinVisibility(false);
        setAppVisibility(true);
        bootInternalAppOnce();
        return;
      }
    } catch {
      // Si falla checkSession, se muestra pantalla de PIN.
    }

    setAppVisibility(false);
    setPinVisibility(true);
  });
})();
