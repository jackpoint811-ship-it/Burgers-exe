const pinScreen = document.getElementById('pin-screen');
const panelScreen = document.getElementById('panel-screen');
const statusEl = document.getElementById('status');
const pinForm = document.getElementById('pin-form');
const pinInput = document.getElementById('pin-input');
const pinButton = document.getElementById('pin-button');
const logoutButton = document.getElementById('logout-button');

function showStatus(message) { statusEl.textContent = message || ''; }
function showPin() { pinScreen.classList.remove('hidden'); panelScreen.classList.add('hidden'); }
function showPanel() { panelScreen.classList.remove('hidden'); pinScreen.classList.add('hidden'); showStatus(''); }

async function checkSession() {
  const resp = await fetch('/api/session', { credentials: 'same-origin' });
  const data = await resp.json();
  if (data?.ok && data?.data?.authenticated) return showPanel();
  showPin();
}

pinForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  showStatus('Validando…');
  pinButton.disabled = true;
  try {
    const resp = await fetch('/api/auth', {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: pinInput.value })
    });
    const data = await resp.json();
    if (resp.ok && data?.ok) {
      pinInput.value = '';
      showPanel();
      return;
    }
    showStatus('PIN inválido. Intenta de nuevo.');
  } catch {
    showStatus('No se pudo validar el PIN.');
  } finally {
    pinButton.disabled = false;
  }
});

logoutButton.addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' });
  showStatus('Sesión cerrada.');
  showPin();
});

window.internalRpc = async (payload) => {
  const resp = await fetch('/api/rpc', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload || {}) });
  if (resp.status === 401) {
    showStatus('Sesión expirada. Ingresa PIN nuevamente.');
    showPin();
    return null;
  }
  return resp.json();
};

checkSession().catch(() => { showStatus('No se pudo verificar sesión.'); showPin(); });
