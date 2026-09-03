/* Expenses: recurring + one-off business costs */

const Expenses = (() => {
  async function render(root) {
    root.innerHTML = '';
    const expenses = await DB.getAll('expenses');
    expenses.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    root.appendChild(el('div', { class: 'toolbar' }, [
      el('button', { class: 'btn btn-primary', onclick: () => openForm(root) }, '+ Add Expense')
    ]));

    const total = expenses.reduce((s, e) => s + (e.amount || 0), 0);
    const byCat = {};
    expenses.forEach(e => { byCat[e.category] = (byCat[e.category] || 0) + e.amount; });

    root.appendChild(el('div', { class: 'stat-strip' }, [
      statBox('Total Recorded', fmtMoney(total)),
      ...Object.entries(byCat).slice(0, 3).map(([cat, amt]) => statBox(cat, fmtMoney(amt)))
    ]));

    const rows = expenses.map(e => el('tr', {}, [
      el('td', {}, fmtDate(e.date)), el('td', {}, e.category), el('td', {}, e.description || '—'),
      el('td', {}, e.recurring ? 'Yes' : 'No'),
      el('td', { class: 'num' }, fmtMoney(e.amount)),
      el('td', { class: 'actions' }, [
        el('button', { class: 'btn-icon', onclick: () => openForm(root, e) }, 'Edit'),
        el('button', { class: 'btn-icon danger', onclick: async () => { if (confirmDialog('Delete this expense?')) { await DB.delete('expenses', e.id); render(root); } } }, 'Delete')
      ])
    ]));

    root.appendChild(el('table', { class: 'data-table' }, [
      el('thead', {}, el('tr', {}, ['Date', 'Category', 'Description', 'Recurring', 'Amount', ''].map(h => el('th', {}, h)))),
      el('tbody', {}, rows.length ? rows : el('tr', {}, el('td', { colspan: '6', class: 'empty' }, 'No expenses recorded yet.')))
    ]));
  }

  function statBox(label, value) {
    return el('div', { class: 'stat-box' }, [el('div', { class: 'stat-value' }, String(value)), el('div', { class: 'stat-label' }, label)]);
  }

  function openForm(root, existing) {
    const form = el('form', { class: 'modal-form' }, [
      field('Date', 'date', existing?.date || todayISO(), true, 'date'),
      selectField('Category', 'category', ['Rent', 'Salaries', 'Packaging', 'Marketing', 'Utilities', 'Logistics/Courier', 'Lab Consumables', 'Software/Tools', 'Travel', 'Other'], existing?.category),
      field('Description', 'description', existing?.description),
      field('Amount (₹)', 'amount', existing?.amount ?? 0, true, 'number'),
      el('label', { class: 'checkbox-label' }, [
        el('input', { type: 'checkbox', name: 'recurring', ...(existing?.recurring ? { checked: 'checked' } : {}) }),
        ' Recurring monthly expense'
      ]),
    ]);
    openModal(existing ? 'Edit Expense' : 'Add Expense', form, async () => {
      const data = formData(form);
      const record = {
        ...(existing || {}), date: data.date, category: data.category, description: data.description,
        amount: parseFloat(data.amount) || 0, recurring: !!form.querySelector('[name=recurring]').checked
      };
      await DB.add('expenses', record, 'exp');
      toast('Expense saved', 'success');
      render(root);
    });
  }

  return { render };
})();

window.Expenses = Expenses;
