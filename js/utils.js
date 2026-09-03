/* Shared helpers */

const fmtMoney = (n) => {
  const v = Number(n) || 0;
  return '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtNum = (n, dp = 2) => {
  const v = Number(n) || 0;
  return v.toLocaleString('en-IN', { minimumFractionDigits: dp, maximumFractionDigits: dp });
};

const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const todayISO = () => new Date().toISOString().slice(0, 10);

const el = (tag, attrs = {}, children = []) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  (Array.isArray(children) ? children : [children]).forEach(c => {
    if (c === null || c === undefined) return;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return node;
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, m => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[m]));

function toast(msg, kind = 'info') {
  const host = document.getElementById('toast-host');
  const node = el('div', { class: `toast toast-${kind}` }, msg);
  host.appendChild(node);
  requestAnimationFrame(() => node.classList.add('show'));
  setTimeout(() => {
    node.classList.remove('show');
    setTimeout(() => node.remove(), 250);
  }, 2600);
}

function confirmDialog(message) {
  return window.confirm(message);
}

// Batch numbering convention aligned with NAM-MFR-01 style: VLX-MFR-YYYYMMDD-XXX
function nextBatchNumber(existingBatches, dateStr) {
  const datePart = (dateStr || todayISO()).replace(/-/g, '');
  const sameDay = existingBatches.filter(b => (b.batchNumber || '').includes(datePart));
  const seq = String(sameDay.length + 1).padStart(3, '0');
  return `VLX-MFR-${datePart}-${seq}`;
}

window.fmtMoney = fmtMoney;
window.fmtNum = fmtNum;
window.fmtDate = fmtDate;
window.todayISO = todayISO;
window.el = el;
window.esc = esc;
window.toast = toast;
window.confirmDialog = confirmDialog;
window.nextBatchNumber = nextBatchNumber;
