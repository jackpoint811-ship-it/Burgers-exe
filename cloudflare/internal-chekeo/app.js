(() => {
  const state = { activeTab: 'inicio' };

  const tabButtons = Array.from(document.querySelectorAll('[data-tab-target]'));
  const tabPanels = Array.from(document.querySelectorAll('[data-tab-panel]'));
  const toast = document.querySelector('.status-toast');

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove('is-hidden');
    window.setTimeout(() => {
      toast.classList.add('is-hidden');
    }, 1600);
  }

  function renderTabs() {
    tabButtons.forEach((button) => {
      const isActive = button.dataset.tabTarget === state.activeTab;
      button.classList.toggle('is-active', isActive);
    });

    tabPanels.forEach((panel) => {
      const isActive = panel.dataset.tabPanel === state.activeTab;
      panel.classList.toggle('is-hidden', !isActive);
    });
  }

  function setActiveTab(nextTab) {
    if (!nextTab || nextTab === state.activeTab) return;
    state.activeTab = nextTab;
    renderTabs();
    showToast(`Vista local: ${nextTab}`);
  }

  tabButtons.forEach((button) => {
    button.addEventListener('click', () => setActiveTab(button.dataset.tabTarget));
  });

  document.querySelectorAll('[data-placeholder-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const section = button.dataset.placeholderAction;
      showToast(`Acción de prueba en ${section}. Sin conexión backend.`);
    });
  });

  renderTabs();
})();
