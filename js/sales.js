/* Sales: Customers + Invoices. Deducts finished-goods stock on invoice creation. */

const Sales = (() => {
  let tab = 'invoices';

  async function render(root) {
    root.innerHTML = '';
    root.appendChild(el('div', { class: 'subtabs' }, [
      subtab(root, 'invoices', 'Invoices'),
      subtab(root, 'customers', 'Customers'),
    ]));
    const body = el('div', { class: 'panel-body', id: 'sal-body' });
    root.appendChild(body);
    await renderTab(body, root);
  }

  function subtab(root, key, label) {
    return el('button', { class: `subtab ${tab === key ? 'active' : ''}`, onclick: async (e) => {
      tab = key; document.querySelectorAll('.subtab').forEach(b => b.classList.remove('active')); e.target.classList.add('active');
      await renderTab(document.getElementById('sal-body'), root);
    } }, label);
  }

  async function renderTab(body, root) {
    body.innerHTML = '';
    if (tab === 'invoices') return renderInvoices(body, root);
    if (tab === 'customers') return renderCustomers(body, root);
  }

  // ---------- Customers ----------
  async function renderCustomers(body, root) {
    const customers = await DB.getAll('customers');
    body.appendChild(el('div', { class: 'toolbar' }, [
      el('button', { class: 'btn btn-primary', onclick: () => openCustomerForm(body, root) }, '+ Add Customer')
    ]));
    const rows = customers.map(c => el('tr', {}, [
      el('td', {}, c.name), el('td', {}, c.contact || '—'),
      el('td', { class: 'actions' }, [
        el('button', { class: 'btn-icon', onclick: () => openCustomerForm(body, root, c) }, 'Edit'),
        el('button', { class: 'btn-icon danger', onclick: async () => { if (confirmDialog(`Delete ${c.name}?`)) { await DB.delete('customers', c.id); renderCustomers(body, root); } } }, 'Delete')
      ])
    ]));
    body.appendChild(el('table', { class: 'data-table' }, [
      el('thead', {}, el('tr', {}, ['Customer', 'Contact', ''].map(h => el('th', {}, h)))),
      el('tbody', {}, rows.length ? rows : el('tr', {}, el('td', { colspan: '3', class: 'empty' }, 'No customers yet.')))
    ]));
  }

  function openCustomerForm(body, root, existing) {
    const form = el('form', { class: 'modal-form' }, [
      field('Customer / Distributor Name', 'name', existing?.name, true),
      field('Contact (phone/email)', 'contact', existing?.contact),
    ]);
    openModal(existing ? 'Edit Customer' : 'Add Customer', form, async () => {
      const data = formData(form);
      const record = { ...(existing || {}), name: data.name.trim(), contact: data.contact };
      await DB.add('customers', record, 'cus');
      toast(`Saved ${record.name}`, 'success');
      renderCustomers(body, root);
    });
  }

  // ---------- Invoices ----------
  async function renderInvoices(body, root) {
    const invoices = await DB.getAll('salesInvoices');
    const customers = await DB.getAll('customers');
    invoices.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    body.appendChild(el('div', { class: 'toolbar' }, [
      el('button', { class: 'btn btn-primary', onclick: () => openInvoiceForm(body, root) }, '+ New Invoice')
    ]));

    const rows = invoices.map(inv => {
      const customer = customers.find(c => c.id === inv.customerId);
      const total = (inv.items || []).reduce((s, i) => s + i.qty * i.rate, 0);
      const paid = (inv.paidAmount || 0);
      const balance = total - paid;
      return el('tr', {}, [
        el('td', {}, inv.invoiceNumber), el('td', {}, customer ? customer.name : '—'), el('td', {}, fmtDate(inv.date)),
        el('td', { class: 'num' }, fmtMoney(total)),
        el('td', { class: 'num' }, fmtMoney(paid)),
        el('td', { class: 'num' }, fmtMoney(balance)),
        el('td', {}, el('span', { class: `badge badge-${balance <= 0 ? 'ok' : 'pending'}` }, balance <= 0 ? 'Paid' : 'Unpaid')),
        el('td', { class: 'actions' }, [
          el('button', { class: 'btn-icon danger', onclick: async () => { if (confirmDialog(`Delete ${inv.invoiceNumber}?`)) { await DB.delete('salesInvoices', inv.id); renderInvoices(body, root); } } }, 'Delete')
        ])
      ]);
    });

    body.appendChild(el('table', { class: 'data-table' }, [
      el('thead', {}, el('tr', {}, ['Invoice No.', 'Customer', 'Date', 'Total', 'Paid', 'Balance', 'Status', ''].map(h => el('th', {}, h)))),
      el('tbody', {}, rows.length ? rows : el('tr', {}, el('td', { colspan: '8', class: 'empty' }, 'No invoices yet.')))
    ]));
  }

  function openInvoiceForm(body, root) {
    let items = [{ sku: '', qty: '', rate: '' }];
    DB.getAll('customers').then(async customers => {
      const fgs = await DB.getAll('finishedGoods');
      const form = el('form', { class: 'modal-form' }, []);
      form.appendChild(el('label', {}, ['Customer', el('select', { name: 'customerId', required: true },
        [el('option', { value: '' }, '— select —')].concat(customers.map(c => el('option', { value: c.id }, c.name))))]));
      form.appendChild(field('Date', 'date', todayISO(), true, 'date'));

      const itemsWrap = el('div', { class: 'ingredient-list' });
      form.appendChild(el('label', {}, 'Items'));
      form.appendChild(itemsWrap);

      function redraw() {
        itemsWrap.innerHTML = '';
        items.forEach((it, idx) => {
          const fgSelect = el('select', {
            onchange: (e) => {
              items[idx].sku = e.target.value;
              const fg = fgs.find(f => f.sku === e.target.value);
              if (fg) { items[idx].rate = fg.sellingPrice || 0; redraw(); }
            }
          }, [el('option', { value: '' }, '— product —')].concat(fgs.map(f => el('option', { value: f.sku, selected: it.sku === f.sku }, `${f.name} (stock: ${fmtNum(f.stockQty, 1)})`))));
          const qtyInput = el('input', { type: 'number', step: '0.01', placeholder: 'Qty', value: it.qty, oninput: (e) => items[idx].qty = e.target.value });
          const rateInput = el('input', { type: 'number', step: '0.01', placeholder: 'Rate ₹', value: it.rate, oninput: (e) => items[idx].rate = e.target.value });
          itemsWrap.appendChild(el('div', { class: 'ingredient-row' }, [fgSelect, qtyInput, rateInput,
            el('button', { type: 'button', class: 'btn-icon danger', onclick: () => { items.splice(idx, 1); redraw(); } }, '✕')]));
        });
        itemsWrap.appendChild(el('button', { type: 'button', class: 'btn-secondary', onclick: () => { items.push({ sku: '', qty: '', rate: '' }); redraw(); } }, '+ Add Item'));
      }
      redraw();
      form.appendChild(field('Amount Paid Now (₹)', 'paidAmount', 0, false, 'number'));

      openModal('New Sales Invoice', form, async () => {
        const data = formData(form);
        const cleanItems = items.filter(i => i.sku && i.qty && i.rate).map(i => ({ sku: i.sku, qty: parseFloat(i.qty), rate: parseFloat(i.rate) }));
        if (!cleanItems.length) { toast('Add at least one item', 'error'); return; }

        // Deduct finished goods stock
        for (const item of cleanItems) {
          const fg = fgs.find(f => f.sku === item.sku);
          if (fg) {
            fg.stockQty = (fg.stockQty || 0) - item.qty;
            await DB.put('finishedGoods', fg);
          }
        }

        const allInv = await DB.getAll('salesInvoices');
        const invoiceNumber = `INV-${todayISO().replace(/-/g, '')}-${String(allInv.length + 1).padStart(3, '0')}`;
        const total = cleanItems.reduce((s, i) => s + i.qty * i.rate, 0);
        const paidAmount = parseFloat(data.paidAmount) || 0;
        const invoice = { invoiceNumber, customerId: data.customerId, date: data.date, items: cleanItems, paidAmount };
        await DB.add('salesInvoices', invoice, 'inv');

        if (paidAmount > 0) {
          await DB.add('payments', { type: 'in', refId: invoice.id, refType: 'salesInvoice', amount: paidAmount, date: data.date, method: 'Not specified', note: `Against ${invoiceNumber}` }, 'pay');
        }
        toast(`Created ${invoiceNumber} — total ${fmtMoney(total)}`, 'success');
        renderInvoices(body, root);
      }, { wide: true });
    });
  }

  return { render };
})();

window.Sales = Sales;
