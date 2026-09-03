/* Payments: cash in/out ledger, plus AR (customer dues) and AP (supplier dues) */

const Payments = (() => {
  let tab = 'ledger';

  async function render(root) {
    root.innerHTML = '';
    root.appendChild(el('div', { class: 'subtabs' }, [
      subtab(root, 'ledger', 'Payment Ledger'),
      subtab(root, 'receivables', 'Receivables (AR)'),
      subtab(root, 'payables', 'Payables (AP)'),
    ]));
    const body = el('div', { class: 'panel-body', id: 'pay-body' });
    root.appendChild(body);
    await renderTab(body, root);
  }

  function subtab(root, key, label) {
    return el('button', { class: `subtab ${tab === key ? 'active' : ''}`, onclick: async (e) => {
      tab = key; document.querySelectorAll('.subtab').forEach(b => b.classList.remove('active')); e.target.classList.add('active');
      await renderTab(document.getElementById('pay-body'), root);
    } }, label);
  }

  async function renderTab(body, root) {
    body.innerHTML = '';
    if (tab === 'ledger') return renderLedger(body, root);
    if (tab === 'receivables') return renderReceivables(body);
    if (tab === 'payables') return renderPayables(body);
  }

  // ---------- Ledger ----------
  async function renderLedger(body, root) {
    const payments = await DB.getAll('payments');
    payments.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    body.appendChild(el('div', { class: 'toolbar' }, [
      el('button', { class: 'btn btn-primary', onclick: () => openForm(body, root) }, '+ Record Payment')
    ]));

    const totalIn = payments.filter(p => p.type === 'in').reduce((s, p) => s + p.amount, 0);
    const totalOut = payments.filter(p => p.type === 'out').reduce((s, p) => s + p.amount, 0);
    body.appendChild(el('div', { class: 'stat-strip' }, [
      statBox('Total Received', fmtMoney(totalIn)),
      statBox('Total Paid Out', fmtMoney(totalOut)),
      statBox('Net Cash Flow', fmtMoney(totalIn - totalOut)),
    ]));

    const rows = payments.map(p => el('tr', {}, [
      el('td', {}, fmtDate(p.date)),
      el('td', {}, el('span', { class: `badge badge-${p.type === 'in' ? 'ok' : 'pending'}` }, p.type === 'in' ? 'Received' : 'Paid Out')),
      el('td', {}, p.method || '—'), el('td', {}, p.note || '—'),
      el('td', { class: 'num' }, fmtMoney(p.amount)),
      el('td', { class: 'actions' }, [
        el('button', { class: 'btn-icon danger', onclick: async () => { if (confirmDialog('Delete this payment record?')) { await DB.delete('payments', p.id); renderLedger(body, root); } } }, 'Delete')
      ])
    ]));

    body.appendChild(el('table', { class: 'data-table' }, [
      el('thead', {}, el('tr', {}, ['Date', 'Type', 'Method', 'Note', 'Amount', ''].map(h => el('th', {}, h)))),
      el('tbody', {}, rows.length ? rows : el('tr', {}, el('td', { colspan: '6', class: 'empty' }, 'No payments recorded yet.')))
    ]));
  }

  function statBox(label, value) {
    return el('div', { class: 'stat-box' }, [el('div', { class: 'stat-value' }, String(value)), el('div', { class: 'stat-label' }, label)]);
  }

  function openForm(body, root) {
    const form = el('form', { class: 'modal-form' }, [
      selectField('Type', 'type', ['in', 'out'], 'in'),
      field('Date', 'date', todayISO(), true, 'date'),
      selectField('Method', 'method', ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Card'], 'Cash'),
      field('Amount (₹)', 'amount', 0, true, 'number'),
      field('Note', 'note', ''),
    ]);
    openModal('Record Payment', form, async () => {
      const data = formData(form);
      const record = { type: data.type, date: data.date, method: data.method, amount: parseFloat(data.amount) || 0, note: data.note };
      await DB.add('payments', record, 'pay');
      toast('Payment recorded', 'success');
      renderLedger(body, root);
    });
  }

  // ---------- Receivables ----------
  async function renderReceivables(body) {
    const invoices = await DB.getAll('salesInvoices');
    const customers = await DB.getAll('customers');
    const payments = await DB.getAll('payments');

    const rows = invoices.map(inv => {
      const total = (inv.items || []).reduce((s, i) => s + i.qty * i.rate, 0);
      const extraPayments = payments.filter(p => p.refId === inv.id && p.type === 'in').reduce((s, p) => s + p.amount, 0);
      const paid = (inv.paidAmount || 0);
      const balance = total - paid;
      if (balance <= 0.005) return null;
      const customer = customers.find(c => c.id === inv.customerId);
      return el('tr', {}, [
        el('td', {}, inv.invoiceNumber), el('td', {}, customer ? customer.name : '—'), el('td', {}, fmtDate(inv.date)),
        el('td', { class: 'num' }, fmtMoney(total)), el('td', { class: 'num' }, fmtMoney(paid)),
        el('td', { class: 'num' }, fmtMoney(balance)),
        el('td', {}, el('button', { class: 'btn-icon', onclick: () => recordAgainstInvoice(inv, balance, body) }, 'Record Payment'))
      ]);
    }).filter(Boolean);

    const totalDue = invoices.reduce((s, inv) => {
      const total = (inv.items || []).reduce((x, i) => x + i.qty * i.rate, 0);
      return s + Math.max(0, total - (inv.paidAmount || 0));
    }, 0);

    body.appendChild(el('div', { class: 'stat-strip' }, [statBox('Total Outstanding (AR)', fmtMoney(totalDue))]));
    body.appendChild(el('table', { class: 'data-table' }, [
      el('thead', {}, el('tr', {}, ['Invoice', 'Customer', 'Date', 'Total', 'Paid', 'Balance', ''].map(h => el('th', {}, h)))),
      el('tbody', {}, rows.length ? rows : el('tr', {}, el('td', { colspan: '7', class: 'empty' }, 'No outstanding receivables.')))
    ]));
  }

  function recordAgainstInvoice(inv, balance, body) {
    const form = el('form', { class: 'modal-form' }, [
      field('Date', 'date', todayISO(), true, 'date'),
      selectField('Method', 'method', ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Card'], 'Cash'),
      field(`Amount (balance ${fmtMoney(balance)})`, 'amount', balance, true, 'number'),
    ]);
    openModal(`Record Payment — ${inv.invoiceNumber}`, form, async () => {
      const data = formData(form);
      const amount = parseFloat(data.amount) || 0;
      inv.paidAmount = (inv.paidAmount || 0) + amount;
      await DB.put('salesInvoices', inv);
      await DB.add('payments', { type: 'in', refId: inv.id, refType: 'salesInvoice', amount, date: data.date, method: data.method, note: `Against ${inv.invoiceNumber}` }, 'pay');
      toast('Payment recorded', 'success');
      renderReceivables(body);
    });
  }

  // ---------- Payables ----------
  async function renderPayables(body) {
    const pos = await DB.getAll('purchaseOrders');
    const suppliers = await DB.getAll('suppliers');
    const payments = await DB.getAll('payments');

    const rows = pos.map(po => {
      const total = (po.items || []).reduce((s, i) => s + i.qty * i.rate, 0);
      const paid = payments.filter(p => p.refId === po.id && p.type === 'out').reduce((s, p) => s + p.amount, 0);
      const balance = total - paid;
      if (balance <= 0.005) return null;
      const supplier = suppliers.find(s => s.id === po.supplierId);
      return el('tr', {}, [
        el('td', {}, po.poNumber), el('td', {}, supplier ? supplier.name : '—'), el('td', {}, fmtDate(po.date)),
        el('td', { class: 'num' }, fmtMoney(total)), el('td', { class: 'num' }, fmtMoney(paid)),
        el('td', { class: 'num' }, fmtMoney(balance)),
        el('td', {}, el('button', { class: 'btn-icon', onclick: () => recordAgainstPO(po, balance, body) }, 'Record Payment'))
      ]);
    }).filter(Boolean);

    const totalDue = pos.reduce((s, po) => {
      const total = (po.items || []).reduce((x, i) => x + i.qty * i.rate, 0);
      const paid = payments.filter(p => p.refId === po.id && p.type === 'out').reduce((x, p) => x + p.amount, 0);
      return s + Math.max(0, total - paid);
    }, 0);

    body.appendChild(el('div', { class: 'stat-strip' }, [statBox('Total Outstanding (AP)', fmtMoney(totalDue))]));
    body.appendChild(el('table', { class: 'data-table' }, [
      el('thead', {}, el('tr', {}, ['PO', 'Supplier', 'Date', 'Total', 'Paid', 'Balance', ''].map(h => el('th', {}, h)))),
      el('tbody', {}, rows.length ? rows : el('tr', {}, el('td', { colspan: '7', class: 'empty' }, 'No outstanding payables.')))
    ]));
  }

  function recordAgainstPO(po, balance, body) {
    const form = el('form', { class: 'modal-form' }, [
      field('Date', 'date', todayISO(), true, 'date'),
      selectField('Method', 'method', ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Card'], 'Cash'),
      field(`Amount (balance ${fmtMoney(balance)})`, 'amount', balance, true, 'number'),
    ]);
    openModal(`Record Payment — ${po.poNumber}`, form, async () => {
      const data = formData(form);
      const amount = parseFloat(data.amount) || 0;
      await DB.add('payments', { type: 'out', refId: po.id, refType: 'purchaseOrder', amount, date: data.date, method: data.method, note: `Against ${po.poNumber}` }, 'pay');
      toast('Payment recorded', 'success');
      renderPayables(body);
    });
  }

  return { render };
})();

window.Payments = Payments;
