/* Purchases: Suppliers, Purchase Orders, Goods Received (NAM-GRN-01 linked) */

const Purchases = (() => {
  let tab = 'orders';

  async function render(root) {
    root.innerHTML = '';
    root.appendChild(el('div', { class: 'subtabs' }, [
      subtab(root, 'orders', 'Purchase Orders'),
      subtab(root, 'suppliers', 'Suppliers'),
    ]));
    const body = el('div', { class: 'panel-body', id: 'pur-body' });
    root.appendChild(body);
    await renderTab(body, root);
  }

  function subtab(root, key, label) {
    return el('button', { class: `subtab ${tab === key ? 'active' : ''}`, onclick: async (e) => {
      tab = key; document.querySelectorAll('.subtab').forEach(b => b.classList.remove('active')); e.target.classList.add('active');
      await renderTab(document.getElementById('pur-body'), root);
    } }, label);
  }

  async function renderTab(body, root) {
    body.innerHTML = '';
    if (tab === 'orders') return renderOrders(body, root);
    if (tab === 'suppliers') return renderSuppliers(body, root);
  }

  // ---------- Suppliers ----------
  async function renderSuppliers(body, root) {
    const suppliers = await DB.getAll('suppliers');
    body.appendChild(el('div', { class: 'toolbar' }, [
      el('button', { class: 'btn btn-primary', onclick: () => openSupplierForm(body, root) }, '+ Add Supplier')
    ]));
    const rows = suppliers.map(s => el('tr', {}, [
      el('td', {}, s.name), el('td', {}, s.contact || '—'), el('td', {}, s.address || '—'),
      el('td', { class: 'actions' }, [
        el('button', { class: 'btn-icon', onclick: () => openSupplierForm(body, root, s) }, 'Edit'),
        el('button', { class: 'btn-icon danger', onclick: async () => { if (confirmDialog(`Delete ${s.name}?`)) { await DB.delete('suppliers', s.id); renderSuppliers(body, root); } } }, 'Delete')
      ])
    ]));
    body.appendChild(el('table', { class: 'data-table' }, [
      el('thead', {}, el('tr', {}, ['Supplier', 'Contact', 'Address', ''].map(h => el('th', {}, h)))),
      el('tbody', {}, rows.length ? rows : el('tr', {}, el('td', { colspan: '4', class: 'empty' }, 'No suppliers yet.')))
    ]));
  }

  function openSupplierForm(body, root, existing) {
    const form = el('form', { class: 'modal-form' }, [
      field('Supplier Name', 'name', existing?.name, true),
      field('Contact (phone/email)', 'contact', existing?.contact),
      textareaField('Address', 'address', existing?.address),
    ]);
    openModal(existing ? 'Edit Supplier' : 'Add Supplier', form, async () => {
      const data = formData(form);
      const record = { ...(existing || {}), name: data.name.trim(), contact: data.contact, address: data.address };
      await DB.add('suppliers', record, 'sup');
      toast(`Saved ${record.name}`, 'success');
      renderSuppliers(body, root);
    });
  }

  // ---------- Purchase Orders + GRN ----------
  async function renderOrders(body, root) {
    const pos = await DB.getAll('purchaseOrders');
    const suppliers = await DB.getAll('suppliers');
    const materials = await DB.getAll('materials');
    pos.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    body.appendChild(el('div', { class: 'toolbar' }, [
      el('button', { class: 'btn btn-primary', onclick: () => openPOForm(materials, suppliers, body, root) }, '+ New Purchase Order')
    ]));

    const rows = pos.map(po => {
      const supplier = suppliers.find(s => s.id === po.supplierId);
      const total = (po.items || []).reduce((s, i) => s + i.qty * i.rate, 0);
      return el('tr', {}, [
        el('td', {}, po.poNumber), el('td', {}, supplier ? supplier.name : '—'), el('td', {}, fmtDate(po.date)),
        el('td', { class: 'num' }, fmtMoney(total)),
        el('td', {}, el('span', { class: `badge badge-${po.status === 'Received' ? 'ok' : 'pending'}` }, po.status)),
        el('td', { class: 'actions' }, [
          po.status !== 'Received' ? el('button', { class: 'btn-icon', onclick: () => receiveGoods(po, materials, body, root) }, 'Receive (GRN)') : el('span', { class: 'muted' }, `GRN done`),
          el('button', { class: 'btn-icon danger', onclick: async () => { if (confirmDialog(`Delete PO ${po.poNumber}?`)) { await DB.delete('purchaseOrders', po.id); renderOrders(body, root); } } }, 'Delete')
        ])
      ]);
    });

    body.appendChild(el('table', { class: 'data-table' }, [
      el('thead', {}, el('tr', {}, ['PO No.', 'Supplier', 'Date', 'Total', 'Status', ''].map(h => el('th', {}, h)))),
      el('tbody', {}, rows.length ? rows : el('tr', {}, el('td', { colspan: '6', class: 'empty' }, 'No purchase orders yet.')))
    ]));
  }

  function openPOForm(materials, suppliers, body, root) {
    let items = [{ materialId: '', qty: '', rate: '' }];
    const form = el('form', { class: 'modal-form' }, []);
    form.appendChild(el('label', {}, ['Supplier', el('select', { name: 'supplierId', required: true },
      [el('option', { value: '' }, '— select —')].concat(suppliers.map(s => el('option', { value: s.id }, s.name))))]));
    form.appendChild(field('Date', 'date', todayISO(), true, 'date'));

    const itemsWrap = el('div', { class: 'ingredient-list' });
    form.appendChild(el('label', {}, 'Items'));
    form.appendChild(itemsWrap);

    function redraw() {
      itemsWrap.innerHTML = '';
      items.forEach((it, idx) => {
        const matSelect = el('select', { onchange: (e) => items[idx].materialId = e.target.value },
          [el('option', { value: '' }, '— material —')].concat(materials.map(m => el('option', { value: m.id, selected: it.materialId === m.id }, m.name))));
        const qtyInput = el('input', { type: 'number', step: '0.01', placeholder: 'Qty', value: it.qty, oninput: (e) => items[idx].qty = e.target.value });
        const rateInput = el('input', { type: 'number', step: '0.01', placeholder: 'Rate ₹', value: it.rate, oninput: (e) => items[idx].rate = e.target.value });
        itemsWrap.appendChild(el('div', { class: 'ingredient-row' }, [matSelect, qtyInput, rateInput,
          el('button', { type: 'button', class: 'btn-icon danger', onclick: () => { items.splice(idx, 1); redraw(); } }, '✕')]));
      });
      itemsWrap.appendChild(el('button', { type: 'button', class: 'btn-secondary', onclick: () => { items.push({ materialId: '', qty: '', rate: '' }); redraw(); } }, '+ Add Item'));
    }
    redraw();

    openModal('New Purchase Order', form, async () => {
      const data = formData(form);
      const cleanItems = items.filter(i => i.materialId && i.qty && i.rate).map(i => ({ materialId: i.materialId, qty: parseFloat(i.qty), rate: parseFloat(i.rate) }));
      if (!cleanItems.length) { toast('Add at least one item', 'error'); return; }
      const allPOs = await DB.getAll('purchaseOrders');
      const poNumber = `PO-${todayISO().replace(/-/g, '')}-${String(allPOs.length + 1).padStart(3, '0')}`;
      const record = { supplierId: data.supplierId, date: data.date, items: cleanItems, status: 'Pending', poNumber };
      await DB.add('purchaseOrders', record, 'po');
      toast(`Created ${poNumber}`, 'success');
      renderOrders(body, root);
    }, { wide: true });
  }

  function receiveGoods(po, materials, body, root) {
    const form = el('form', { class: 'modal-form' }, [
      field('GRN Date', 'date', todayISO(), true, 'date'),
      el('p', { class: 'muted-note' }, `Receiving all items on ${po.poNumber} into stock at ordered rates. Raw material stock and average cost will update.`)
    ]);
    openModal(`Receive Goods — ${po.poNumber} (NAM-GRN-01)`, form, async () => {
      const data = formData(form);
      for (const item of po.items) {
        const mat = materials.find(m => m.id === item.materialId) || await DB.get('materials', item.materialId);
        if (!mat) continue;
        const oldQty = mat.currentStock || 0;
        const oldCost = mat.avgCost || 0;
        const newQty = oldQty + item.qty;
        mat.avgCost = newQty ? ((oldQty * oldCost) + (item.qty * item.rate)) / newQty : item.rate;
        mat.currentStock = newQty;
        await DB.put('materials', mat);
      }
      const allGRNs = await DB.getAll('grns');
      const grnNumber = `GRN-${todayISO().replace(/-/g, '')}-${String(allGRNs.length + 1).padStart(3, '0')}`;
      await DB.add('grns', { grnNumber, poId: po.id, date: data.date, items: po.items }, 'grn');
      po.status = 'Received';
      await DB.put('purchaseOrders', po);
      toast(`${grnNumber} recorded, stock updated`, 'success');
      renderOrders(body, root);
    });
  }

  return { render };
})();

window.Purchases = Purchases;
