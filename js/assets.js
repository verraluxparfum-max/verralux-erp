/* Assets: lab equipment, furniture, vehicles etc. (NAM-EQP linked) */

const Assets = (() => {
  async function render(root) {
    root.innerHTML = '';
    const assets = await DB.getAll('assets');
    assets.sort((a, b) => (b.purchaseDate || '').localeCompare(a.purchaseDate || ''));

    root.appendChild(el('div', { class: 'toolbar' }, [
      el('button', { class: 'btn btn-primary', onclick: () => openForm() }, '+ Add Asset')
    ]));

    const totalValue = assets.reduce((s, a) => s + (currentValue(a)), 0);
    root.appendChild(el('div', { class: 'stat-strip' }, [
      statBox('Total Assets', assets.length),
      statBox('Book Value (after depreciation)', fmtMoney(totalValue)),
    ]));

    const rows = assets.map(a => el('tr', {}, [
      el('td', {}, a.name),
      el('td', {}, a.category || '—'),
      el('td', {}, fmtDate(a.purchaseDate)),
      el('td', { class: 'num' }, fmtMoney(a.cost)),
      el('td', { class: 'num' }, `${a.depreciationPct || 0}%/yr`),
      el('td', { class: 'num' }, fmtMoney(currentValue(a))),
      el('td', {}, a.location || '—'),
      el('td', {}, el('span', { class: `badge badge-${a.status === 'Active' ? 'ok' : 'pending'}` }, a.status || 'Active')),
      el('td', { class: 'actions' }, [
        el('button', { class: 'btn-icon', onclick: () => openForm(a) }, 'Edit'),
        el('button', { class: 'btn-icon danger', onclick: async () => { if (confirmDialog(`Delete ${a.name}?`)) { await DB.delete('assets', a.id); render(root); } } }, 'Delete')
      ])
    ]));

    root.appendChild(el('table', { class: 'data-table' }, [
      el('thead', {}, el('tr', {}, ['Asset', 'Category', 'Purchased', 'Cost', 'Depreciation', 'Book Value', 'Location', 'Status', ''].map(h => el('th', {}, h)))),
      el('tbody', {}, rows.length ? rows : el('tr', {}, el('td', { colspan: '9', class: 'empty' }, 'No assets recorded yet.')))
    ]));
  }

  function currentValue(a) {
    if (!a.purchaseDate) return a.cost || 0;
    const years = (Date.now() - new Date(a.purchaseDate).getTime()) / (365.25 * 24 * 3600 * 1000);
    const rate = (a.depreciationPct || 0) / 100;
    const value = (a.cost || 0) * Math.max(0, 1 - rate * years);
    return Math.max(value, 0);
  }

  function statBox(label, value) {
    return el('div', { class: 'stat-box' }, [el('div', { class: 'stat-value' }, String(value)), el('div', { class: 'stat-label' }, label)]);
  }

  function openForm(existing) {
    const form = el('form', { class: 'modal-form' }, [
      field('Asset Name', 'name', existing?.name, true),
      selectField('Category', 'category', ['Lab Equipment', 'Blending/Filling Machinery', 'Furniture', 'IT/Computer', 'Vehicle', 'Other'], existing?.category),
      field('Purchase Date', 'purchaseDate', existing?.purchaseDate || todayISO(), true, 'date'),
      field('Cost (₹)', 'cost', existing?.cost ?? 0, true, 'number'),
      field('Depreciation % per year', 'depreciationPct', existing?.depreciationPct ?? 10, false, 'number'),
      field('Location', 'location', existing?.location, false),
      selectField('Status', 'status', ['Active', 'Under Repair', 'Disposed'], existing?.status || 'Active'),
    ]);
    openModal(existing ? 'Edit Asset' : 'Add Asset', form, async () => {
      const data = formData(form);
      const record = {
        ...(existing || {}),
        name: data.name.trim(), category: data.category, purchaseDate: data.purchaseDate,
        cost: parseFloat(data.cost) || 0, depreciationPct: parseFloat(data.depreciationPct) || 0,
        location: data.location, status: data.status
      };
      await DB.add('assets', record, 'ast');
      toast(`Saved ${record.name}`, 'success');
      render(document.getElementById('view'));
    });
  }

  return { render };
})();

window.Assets = Assets;
