/* Reports: stock valuation, batch costing, P&L, low-stock alerts */

const Reports = (() => {
  let tab = 'pnl';

  async function render(root) {
    root.innerHTML = '';
    root.appendChild(el('div', { class: 'subtabs' }, [
      subtab(root, 'pnl', 'Profit & Loss'),
      subtab(root, 'stock', 'Stock Valuation'),
      subtab(root, 'batches', 'Batch Costing'),
      subtab(root, 'lowstock', 'Low Stock Alerts'),
    ]));
    const body = el('div', { class: 'panel-body', id: 'rep-body' });
    root.appendChild(body);
    await renderTab(body, root);
  }

  function subtab(root, key, label) {
    return el('button', { class: `subtab ${tab === key ? 'active' : ''}`, onclick: async (e) => {
      tab = key; document.querySelectorAll('.subtab').forEach(b => b.classList.remove('active')); e.target.classList.add('active');
      await renderTab(document.getElementById('rep-body'), root);
    } }, label);
  }

  async function renderTab(body, root) {
    body.innerHTML = '';
    if (tab === 'pnl') return renderPnL(body);
    if (tab === 'stock') return renderStockValuation(body);
    if (tab === 'batches') return renderBatchCosting(body);
    if (tab === 'lowstock') return renderLowStock(body);
  }

  function statBox(label, value, kind) {
    return el('div', { class: `stat-box ${kind ? 'stat-' + kind : ''}` }, [el('div', { class: 'stat-value' }, String(value)), el('div', { class: 'stat-label' }, label)]);
  }

  // ---------- P&L ----------
  async function renderPnL(body) {
    const invoices = await DB.getAll('salesInvoices');
    const expenses = await DB.getAll('expenses');
    const finishedGoods = await DB.getAll('finishedGoods');

    let revenue = 0, cogs = 0;
    for (const inv of invoices) {
      for (const item of (inv.items || [])) {
        revenue += item.qty * item.rate;
        const fg = finishedGoods.find(f => f.sku === item.sku);
        cogs += item.qty * (fg?.costPrice || 0);
      }
    }
    const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
    const grossProfit = revenue - cogs;
    const netProfit = grossProfit - totalExpenses;

    body.appendChild(el('div', { class: 'stat-strip' }, [
      statBox('Revenue', fmtMoney(revenue)),
      statBox('COGS', fmtMoney(cogs)),
      statBox('Gross Profit', fmtMoney(grossProfit)),
      statBox('Expenses', fmtMoney(totalExpenses)),
      statBox('Net Profit', fmtMoney(netProfit), netProfit >= 0 ? 'positive' : 'negative'),
    ]));

    const expByCat = {};
    expenses.forEach(e => { expByCat[e.category] = (expByCat[e.category] || 0) + e.amount; });
    const rows = Object.entries(expByCat).map(([cat, amt]) => el('tr', {}, [el('td', {}, cat), el('td', { class: 'num' }, fmtMoney(amt))]));

    body.appendChild(el('h4', {}, 'Expense Breakdown'));
    body.appendChild(el('table', { class: 'data-table compact' }, [
      el('thead', {}, el('tr', {}, ['Category', 'Amount'].map(h => el('th', {}, h)))),
      el('tbody', {}, rows.length ? rows : el('tr', {}, el('td', { colspan: '2', class: 'empty' }, 'No expenses recorded.')))
    ]));
  }

  // ---------- Stock Valuation ----------
  async function renderStockValuation(body) {
    const materials = await DB.getAll('materials');
    const finishedGoods = await DB.getAll('finishedGoods');

    const rawValue = materials.reduce((s, m) => s + (m.currentStock || 0) * (m.avgCost || 0), 0);
    const fgValue = finishedGoods.reduce((s, f) => s + (f.stockQty || 0) * (f.costPrice || 0), 0);

    body.appendChild(el('div', { class: 'stat-strip' }, [
      statBox('Raw Material Value', fmtMoney(rawValue)),
      statBox('Finished Goods Value', fmtMoney(fgValue)),
      statBox('Total Inventory Value', fmtMoney(rawValue + fgValue)),
    ]));

    body.appendChild(el('h4', {}, 'Raw Materials'));
    body.appendChild(el('table', { class: 'data-table compact' }, [
      el('thead', {}, el('tr', {}, ['Material', 'Stock', 'Avg Cost', 'Value'].map(h => el('th', {}, h)))),
      el('tbody', {}, materials.map(m => el('tr', {}, [
        el('td', {}, m.name), el('td', { class: 'num' }, `${fmtNum(m.currentStock, 2)} ${m.unit || ''}`),
        el('td', { class: 'num' }, fmtMoney(m.avgCost)), el('td', { class: 'num' }, fmtMoney((m.currentStock || 0) * (m.avgCost || 0)))
      ])))
    ]));

    body.appendChild(el('h4', {}, 'Finished Goods'));
    body.appendChild(el('table', { class: 'data-table compact' }, [
      el('thead', {}, el('tr', {}, ['Product', 'Stock', 'Cost Price', 'Value'].map(h => el('th', {}, h)))),
      el('tbody', {}, finishedGoods.map(f => el('tr', {}, [
        el('td', {}, f.name), el('td', { class: 'num' }, fmtNum(f.stockQty, 2)),
        el('td', { class: 'num' }, fmtMoney(f.costPrice)), el('td', { class: 'num' }, fmtMoney((f.stockQty || 0) * (f.costPrice || 0)))
      ])))
    ]));
  }

  // ---------- Batch Costing ----------
  async function renderBatchCosting(body) {
    const batches = await DB.getAll('batches');
    const formulas = await DB.getAll('formulas');
    batches.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    const rows = batches.map(b => {
      const f = formulas.find(x => x.id === b.formulaId);
      return el('tr', {}, [
        el('td', {}, el('code', {}, b.batchNumber)), el('td', {}, f ? f.name : '—'), el('td', {}, fmtDate(b.date)),
        el('td', { class: 'num' }, `${fmtNum(b.quantityProduced, 2)} ${b.unit || ''}`),
        el('td', { class: 'num' }, fmtMoney(b.costPerUnit)),
        el('td', { class: 'num' }, fmtMoney((b.costPerUnit || 0) * (b.quantityProduced || 0)))
      ]);
    });
    body.appendChild(el('table', { class: 'data-table' }, [
      el('thead', {}, el('tr', {}, ['Batch No.', 'Formula', 'Date', 'Qty', 'Cost/Unit', 'Total Cost'].map(h => el('th', {}, h)))),
      el('tbody', {}, rows.length ? rows : el('tr', {}, el('td', { colspan: '6', class: 'empty' }, 'No batches recorded.')))
    ]));
  }

  // ---------- Low Stock ----------
  async function renderLowStock(body) {
    const materials = await DB.getAll('materials');
    const low = materials.filter(m => (m.currentStock || 0) <= (m.reorderLevel || 0) && m.reorderLevel != null);

    body.appendChild(el('table', { class: 'data-table' }, [
      el('thead', {}, el('tr', {}, ['Material', 'Current Stock', 'Reorder Level', 'Shortfall'].map(h => el('th', {}, h)))),
      el('tbody', {}, low.length ? low.map(m => el('tr', { class: 'row-warn' }, [
        el('td', {}, m.name), el('td', { class: 'num' }, `${fmtNum(m.currentStock, 2)} ${m.unit || ''}`),
        el('td', { class: 'num' }, `${fmtNum(m.reorderLevel, 2)} ${m.unit || ''}`),
        el('td', { class: 'num' }, `${fmtNum(Math.max(0, m.reorderLevel - m.currentStock), 2)} ${m.unit || ''}`)
      ])) : el('tr', {}, el('td', { colspan: '4', class: 'empty' }, 'All materials above reorder level.')))
    ]));
  }

  return { render };
})();

window.Reports = Reports;
