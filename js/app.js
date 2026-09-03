/* App shell: nav + router + backup/restore (critical for single-device offline data) */

const ROUTES = {
  dashboard: { label: 'Dashboard', module: () => window.Dashboard },
  inventory: { label: 'Inventory', module: () => window.Inventory },
  purchases: { label: 'Purchases', module: () => window.Purchases },
  sales: { label: 'Sales', module: () => window.Sales },
  expenses: { label: 'Expenses', module: () => window.Expenses },
  payments: { label: 'Payments', module: () => window.Payments },
  assets: { label: 'Assets', module: () => window.Assets },
  reports: { label: 'Reports', module: () => window.Reports },
};

const App = (() => {
  let current = 'dashboard';

  async function init() {
    await openDB();
    renderNav();
    await navigate('dashboard');
    wireBackup();
  }

  function renderNav() {
    const nav = document.getElementById('nav');
    nav.innerHTML = '';
    for (const [key, cfg] of Object.entries(ROUTES)) {
      nav.appendChild(el('button', {
        class: `nav-btn ${key === current ? 'active' : ''}`,
        'data-route': key,
        onclick: () => navigate(key)
      }, cfg.label));
    }
  }

  async function navigate(route) {
    current = route;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.route === route));
    document.getElementById('view-title').textContent = ROUTES[route].label;
    const view = document.getElementById('view');
    view.innerHTML = '<div class="loading">Loading…</div>';
    const mod = ROUTES[route].module();
    await mod.render(view);
    document.getElementById('mobile-nav-drawer')?.classList.remove('open');
  }

  function wireBackup() {
    document.getElementById('btn-export').addEventListener('click', async () => {
      const data = await DB.exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `verralux-erp-backup-${todayISO()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast('Backup downloaded', 'success');
    });

    document.getElementById('file-import').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (!confirmDialog('Import will merge this backup into your current data. Continue?')) { e.target.value = ''; return; }
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        await DB.importAll(data);
        toast('Backup imported', 'success');
        navigate(current);
      } catch (err) {
        toast('Import failed: invalid file', 'error');
      }
      e.target.value = '';
    });

    document.getElementById('btn-menu-toggle')?.addEventListener('click', (e) => {
      e.stopPropagation();
      document.getElementById('mobile-nav-drawer').classList.toggle('open');
    });
    document.querySelector('.main').addEventListener('click', () => {
      document.getElementById('mobile-nav-drawer').classList.remove('open');
    });
  }

  return { init, navigate };
})();

window.App = App;
window.addEventListener('DOMContentLoaded', () => App.init());

// Register service worker if served over http(s) — no-op on file://
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
