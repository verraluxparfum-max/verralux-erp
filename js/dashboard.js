/* Dashboard: snapshot on app open */

const Dashboard = (() => {
  async function render(root) {
    root.innerHTML = '';
    const [materials, finishedGoods, invoices, expenses, pos, payments, assets] = await Promise.all([
      DB.getAll('materials'), DB.getAll('finishedGoods'), DB.getAll('salesInvoices'),
      DB.getAll('expenses'), DB.getAll('purchaseOrders'), DB.getAll('payments'), DB.getAll('assets')
    ]);

    const rawValue = materials.reduce((s, m) => s + (m.currentStock || 0) * (m.avgCost || 0), 0);
    const fgValue = finishedGoods.reduce((s, f) => s + (f.stockQty || 0) * (f.costPrice || 0), 0);
    const revenue = invoices.reduce((s, inv) => s + (inv.items || []).reduce((x, i) => x + i.qty * i.rate, 0), 0);
    const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
    const arOutstanding = invoices.reduce((s, inv) => {
      const total = (inv.items || []).reduce((x, i) => x + i.qty * i.rate, 0);
      return s + Math.max(0, total - (inv.paidAmount || 0));
    }, 0);
    const apOutstanding = pos.reduce((s, po) => {
      const total = (po.items || []).reduce((x, i) => x + i.qty * i.rate, 0);
      const paid = payments.filter(p => p.refId === po.id && p.type === 'out').reduce((x, p) => x + p.amount, 0);
      return s + Math.max(0, total - paid);
    }, 0);
    const lowStockCount = materials.filter(m => m.reorderLevel != null && (m.currentStock || 0) <= m.reorderLevel).length;
    const assetValue = assets.reduce((s, a) => {
      const years = a.purchaseDate ? (Date.now() - new Date(a.purchaseDate).getTime()) / (365.25 * 24 * 3600 * 1000) : 0;
      const rate = (a.depreciationPct || 0) / 100;
      return s + Math.max(0, (a.cost || 0) * Math.max(0, 1 - rate * years));
    }, 0);

    root.appendChild(el('div', { class: 'stat-grid' }, [
      dashCard('Revenue to date', fmtMoney(revenue), 'primary'),
      dashCard('Total Expenses', fmtMoney(totalExpenses)),
      dashCard('Inventory Value', fmtMoney(rawValue + fgValue)),
      dashCard('Asset Book Value', fmtMoney(assetValue)),
      dashCard('Receivables Due (AR)', fmtMoney(arOutstanding), arOutstanding > 0 ? 'warn' : null),
      dashCard('Payables Due (AP)', fmtMoney(apOutstanding), apOutstanding > 0 ? 'warn' : null),
      dashCard('Low Stock Items', String(lowStockCount), lowStockCount > 0 ? 'warn' : null),
      dashCard('Finished SKUs', String(finishedGoods.length)),
    ]));

    root.appendChild(el('div', { class: 'quick-links' }, [
      el('h4', {}, 'Quick actions'),
      el('div', { class: 'quick-link-row' }, [
        quickBtn('Produce Batch', 'inventory'),
        quickBtn('New Purchase Order', 'purchases'),
        quickBtn('New Sales Invoice', 'sales'),
        quickBtn('Add Expense', 'expenses'),
      ])
    ]));
  }

  function dashCard(label, value, kind) {
    return el('div', { class: `dash-card ${kind ? 'dash-' + kind : ''}` }, [
      el('div', { class: 'dash-value' }, value), el('div', { class: 'dash-label' }, label)
    ]);
  }

  function quickBtn(label, route) {
    return el('button', { class: 'btn-secondary', onclick: () => window.App.navigate(route) }, label);
  }

  return { render };
})();

window.Dashboard = Dashboard;
