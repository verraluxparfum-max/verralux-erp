/* Inventory: Raw Materials, Formulas, Batches (NAM-MFR/PBR linked), Finished Goods */

const Inventory = (() => {
  let tab = 'materials';

  async function render(root) {
    root.innerHTML = '';
    const tabs = el('div', { class: 'subtabs' }, [
      subtab('materials', 'Raw Materials'),
      subtab('formulas', 'Formulas'),
      subtab('batches', 'Batches (NAM-MFR)'),
      subtab('finished', 'Finished Goods'),
    ]);
    root.appendChild(tabs);
    const body = el('div', { class: 'panel-body', id: 'inv-body' });
    root.appendChild(body);
    await renderTab(body);
  }

  function subtab(key, label) {
    return el('button', {
      class: `subtab ${tab === key ? 'active' : ''}`,
      onclick: async () => { tab = key; await renderTab(document.getElementById('inv-body')); document.querySelectorAll('.subtab').forEach(b => b.classList.remove('active')); event.target.classList.add('active'); }
    }, label);
  }

  async function renderTab(body) {
    body.innerHTML = '';
    if (tab === 'materials') return renderMaterials(body);
    if (tab === 'formulas') return renderFormulas(body);
    if (tab === 'batches') return renderBatches(body);
    if (tab === 'finished') return renderFinished(body);
  }

  // ---------- Raw Materials ----------
  async function renderMaterials(body) {
    const materials = await DB.getAll('materials');
    const suppliers = await DB.getAll('suppliers');
    materials.sort((a, b) => a.name.localeCompare(b.name));

    body.appendChild(el('div', { class: 'toolbar' }, [
      el('button', { class: 'btn btn-primary', onclick: () => openMaterialForm(suppliers) }, '+ Add Raw Material')
    ]));

    const rows = materials.map(m => {
      const supplier = suppliers.find(s => s.id === m.supplierId);
      const low = m.currentStock <= (m.reorderLevel || 0);
      return el('tr', { class: low ? 'row-warn' : '' }, [
        el('td', {}, m.name),
        el('td', {}, m.category || '—'),
        el('td', { class: 'num' }, `${fmtNum(m.currentStock, 3)} ${m.unit || ''}`),
        el('td', { class: 'num' }, fmtMoney(m.avgCost)),
        el('td', { class: 'num' }, fmtMoney((m.currentStock || 0) * (m.avgCost || 0))),
        el('td', {}, supplier ? supplier.name : '—'),
        el('td', { class: 'num' }, m.reorderLevel != null ? `${m.reorderLevel} ${m.unit || ''}` : '—'),
        el('td', { class: 'actions' }, [
          el('button', { class: 'btn-icon', onclick: () => openMaterialForm(suppliers, m) }, 'Edit'),
          el('button', { class: 'btn-icon danger', onclick: async () => { if (confirmDialog(`Delete ${m.name}?`)) { await DB.delete('materials', m.id); renderMaterials(body); } } }, 'Delete')
        ])
      ]);
    });

    body.appendChild(el('table', { class: 'data-table' }, [
      el('thead', {}, el('tr', {}, ['Material', 'Category', 'Stock', 'Avg Cost/Unit', 'Stock Value', 'Supplier', 'Reorder Lvl', ''].map(h => el('th', {}, h)))),
      el('tbody', {}, rows.length ? rows : el('tr', {}, el('td', { colspan: '8', class: 'empty' }, 'No raw materials yet.')))
    ]));
  }

  function openMaterialForm(suppliers, existing) {
    const isEdit = !!existing;
    const supplierOptions = [el('option', { value: '' }, '— none —')].concat(
      suppliers.map(s => el('option', { value: s.id, selected: existing?.supplierId === s.id }, s.name))
    );

    const form = el('form', { class: 'modal-form' }, [
      field('Name', 'name', existing?.name, true),
      selectField('Category', 'category', ['Essential Oil', 'Absolute', 'Aroma Chemical', 'Alcohol/Solvent', 'Fixative', 'Bottle', 'Cap/Closure', 'Label/Packaging', 'Other'], existing?.category),
      field('Unit (ml, g, kg, pcs)', 'unit', existing?.unit || 'ml', true),
      field('Current Stock', 'currentStock', existing?.currentStock ?? 0, true, 'number'),
      field('Avg Cost per Unit (₹)', 'avgCost', existing?.avgCost ?? 0, true, 'number'),
      field('Reorder Level', 'reorderLevel', existing?.reorderLevel ?? '', false, 'number'),
      el('label', {}, ['Supplier', el('select', { name: 'supplierId' }, supplierOptions)]),
    ]);

    openModal(isEdit ? 'Edit Raw Material' : 'Add Raw Material', form, async () => {
      const data = formData(form);
      const record = {
        ...(existing || {}),
        name: data.name.trim(),
        category: data.category,
        unit: data.unit.trim(),
        currentStock: parseFloat(data.currentStock) || 0,
        avgCost: parseFloat(data.avgCost) || 0,
        reorderLevel: data.reorderLevel ? parseFloat(data.reorderLevel) : null,
        supplierId: data.supplierId || null
      };
      await DB.add('materials', record, 'mat');
      toast(`Saved ${record.name}`, 'success');
      renderMaterials(document.getElementById('inv-body'));
    });
  }

  // ---------- Formulas ----------
  async function renderFormulas(body) {
    const formulas = await DB.getAll('formulas');
    const materials = await DB.getAll('materials');

    body.appendChild(el('div', { class: 'toolbar' }, [
      el('button', { class: 'btn btn-primary', onclick: () => openFormulaForm(materials) }, '+ Add Formula')
    ]));

    const cards = formulas.map(f => {
      const costPerMl = formulaCostPerUnit(f, materials);
      return el('div', { class: 'card' }, [
        el('div', { class: 'card-head' }, [
          el('div', {}, [el('strong', {}, f.name), el('span', { class: 'muted' }, ` (${f.sku})`)]),
          el('div', { class: 'card-actions' }, [
            el('button', { class: 'btn-icon', onclick: () => openFormulaForm(materials, f) }, 'Edit'),
            el('button', { class: 'btn-icon danger', onclick: async () => { if (confirmDialog(`Delete formula ${f.name}?`)) { await DB.delete('formulas', f.id); renderFormulas(body); } } }, 'Delete')
          ])
        ]),
        el('div', { class: 'card-sub' }, `Batch size: ${f.batchSize} ${f.batchUnit || 'ml'} · Est. cost: ${fmtMoney(costPerMl)} per ${f.batchUnit || 'ml'}`),
        el('table', { class: 'data-table compact' }, [
          el('thead', {}, el('tr', {}, ['Ingredient', '%', 'Qty in batch', 'Cost'].map(h => el('th', {}, h)))),
          el('tbody', {}, (f.ingredients || []).map(ing => {
            const mat = materials.find(m => m.id === ing.materialId);
            const qty = (f.batchSize || 0) * (ing.pct / 100);
            const cost = qty * (mat?.avgCost || 0);
            return el('tr', {}, [
              el('td', {}, mat ? mat.name : '(deleted material)'),
              el('td', { class: 'num' }, `${ing.pct}%`),
              el('td', { class: 'num' }, `${fmtNum(qty, 2)} ${mat?.unit || ''}`),
              el('td', { class: 'num' }, fmtMoney(cost))
            ]);
          }))
        ])
      ]);
    });

    body.appendChild(el('div', { class: 'card-grid' }, cards.length ? cards : el('div', { class: 'empty' }, 'No formulas yet.')));
  }

  function formulaCostPerUnit(f, materials) {
    const total = (f.ingredients || []).reduce((sum, ing) => {
      const mat = materials.find(m => m.id === ing.materialId);
      const qty = (f.batchSize || 0) * (ing.pct / 100);
      return sum + qty * (mat?.avgCost || 0);
    }, 0);
    return f.batchSize ? total / f.batchSize : 0;
  }

  function openFormulaForm(materials, existing) {
    const isEdit = !!existing;
    let ingredients = existing ? JSON.parse(JSON.stringify(existing.ingredients || [])) : [];

    const form = el('form', { class: 'modal-form' }, []);
    form.appendChild(field('Formula/SKU Name', 'name', existing?.name, true));
    form.appendChild(field('SKU Code', 'sku', existing?.sku, true));
    form.appendChild(field('Batch Size', 'batchSize', existing?.batchSize ?? 1000, true, 'number'));
    form.appendChild(field('Batch Unit', 'batchUnit', existing?.batchUnit || 'ml', true));

    const ingWrap = el('div', { class: 'ingredient-list' });
    form.appendChild(el('label', {}, 'Ingredients (% of batch)'));
    form.appendChild(ingWrap);

    function redrawIngredients() {
      ingWrap.innerHTML = '';
      const totalPct = ingredients.reduce((s, i) => s + (parseFloat(i.pct) || 0), 0);
      ingredients.forEach((ing, idx) => {
        const matSelect = el('select', {
          onchange: (e) => { ingredients[idx].materialId = e.target.value; }
        }, [el('option', { value: '' }, '— select —')].concat(
          materials.map(m => el('option', { value: m.id, selected: ing.materialId === m.id }, m.name))
        ));
        const pctInput = el('input', {
          type: 'number', step: '0.01', value: ing.pct ?? '',
          oninput: (e) => { ingredients[idx].pct = e.target.value; redrawTotal(); }
        });
        ingWrap.appendChild(el('div', { class: 'ingredient-row' }, [
          matSelect, pctInput, el('span', {}, '%'),
          el('button', { type: 'button', class: 'btn-icon danger', onclick: () => { ingredients.splice(idx, 1); redrawIngredients(); } }, '✕')
        ]));
      });
      ingWrap.appendChild(el('div', { class: 'ingredient-total', id: 'ing-total' }, `Total: ${totalPct.toFixed(2)}%`));
      ingWrap.appendChild(el('button', { type: 'button', class: 'btn-secondary', onclick: () => { ingredients.push({ materialId: '', pct: '' }); redrawIngredients(); } }, '+ Add Ingredient'));
    }
    function redrawTotal() {
      const totalEl = document.getElementById('ing-total');
      if (totalEl) {
        const totalPct = ingredients.reduce((s, i) => s + (parseFloat(i.pct) || 0), 0);
        totalEl.textContent = `Total: ${totalPct.toFixed(2)}%`;
        totalEl.style.color = Math.abs(totalPct - 100) < 0.01 ? 'var(--color-success)' : 'var(--color-warn)';
      }
    }
    redrawIngredients();

    openModal(isEdit ? 'Edit Formula' : 'Add Formula', form, async () => {
      const data = formData(form);
      const record = {
        ...(existing || {}),
        name: data.name.trim(),
        sku: data.sku.trim(),
        batchSize: parseFloat(data.batchSize) || 0,
        batchUnit: data.batchUnit.trim(),
        ingredients: ingredients.filter(i => i.materialId && i.pct !== '').map(i => ({ materialId: i.materialId, pct: parseFloat(i.pct) }))
      };
      await DB.add('formulas', record, 'frm');
      toast(`Saved formula ${record.name}`, 'success');
      renderFormulas(document.getElementById('inv-body'));
    }, { wide: true });
  }

  // ---------- Batches (NAM-MFR / NAM-PBR linked) ----------
  async function renderBatches(body) {
    const batches = await DB.getAll('batches');
    const formulas = await DB.getAll('formulas');
    batches.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    body.appendChild(el('div', { class: 'toolbar' }, [
      el('button', { class: 'btn btn-primary', onclick: () => openBatchForm(formulas, batches) }, '+ Produce Batch')
    ]));

    const rows = batches.map(b => {
      const formula = formulas.find(f => f.id === b.formulaId);
      return el('tr', {}, [
        el('td', {}, el('code', {}, b.batchNumber)),
        el('td', {}, formula ? formula.name : '(deleted formula)'),
        el('td', {}, fmtDate(b.date)),
        el('td', { class: 'num' }, `${fmtNum(b.quantityProduced, 2)} ${b.unit || ''}`),
        el('td', { class: 'num' }, fmtMoney(b.costPerUnit)),
        el('td', { class: 'num' }, fmtMoney((b.costPerUnit || 0) * (b.quantityProduced || 0))),
        el('td', {}, fmtDate(b.expiryDate)),
        el('td', {}, el('span', { class: `badge badge-${b.status === 'Released' ? 'ok' : 'pending'}` }, b.status || 'In Process')),
      ]);
    });

    body.appendChild(el('table', { class: 'data-table' }, [
      el('thead', {}, el('tr', {}, ['Batch No. (NAM-MFR)', 'Formula', 'Date', 'Qty Produced', 'Cost/Unit', 'Total Cost', 'Expiry', 'Status'].map(h => el('th', {}, h)))),
      el('tbody', {}, rows.length ? rows : el('tr', {}, el('td', { colspan: '8', class: 'empty' }, 'No batches recorded yet.')))
    ]));
  }

  function openBatchForm(formulas, existingBatches) {
    const form = el('form', { class: 'modal-form' }, [
      el('label', {}, ['Formula', el('select', { name: 'formulaId', required: true },
        [el('option', { value: '' }, '— select —')].concat(formulas.map(f => el('option', { value: f.id }, `${f.name} (${f.sku})`))))]),
      field('Production Date', 'date', todayISO(), true, 'date'),
      field('Multiplier (x batch size)', 'multiplier', 1, true, 'number'),
      field('Expiry Date', 'expiryDate', '', false, 'date'),
      el('label', { class: 'muted-note' }, 'Batch number auto-generated (NAM-MFR-01 convention). Consumes raw materials from stock and computes cost automatically on save.')
    ]);

    openModal('Produce Batch', form, async () => {
      const data = formData(form);
      const formula = formulas.find(f => f.id === data.formulaId);
      if (!formula) { toast('Select a formula', 'error'); return; }
      const multiplier = parseFloat(data.multiplier) || 1;
      const qtyProduced = (formula.batchSize || 0) * multiplier;

      const materials = await DB.getAll('materials');
      let totalCost = 0;
      // Consume raw materials proportionally and update stock
      for (const ing of (formula.ingredients || [])) {
        const mat = materials.find(m => m.id === ing.materialId);
        if (!mat) continue;
        const qtyUsed = (formula.batchSize || 0) * multiplier * (ing.pct / 100);
        totalCost += qtyUsed * (mat.avgCost || 0);
        mat.currentStock = (mat.currentStock || 0) - qtyUsed;
        await DB.put('materials', mat);
      }
      const costPerUnit = qtyProduced ? totalCost / qtyProduced : 0;
      const batchNumber = nextBatchNumber(existingBatches, data.date);

      const batch = {
        formulaId: formula.id,
        batchNumber,
        date: data.date,
        quantityProduced: qtyProduced,
        unit: formula.batchUnit || 'ml',
        costPerUnit,
        expiryDate: data.expiryDate || null,
        status: 'Released'
      };
      await DB.add('batches', batch, 'bth');

      // Auto-create/increment finished good stock for this SKU
      const fgList = await DB.getByIndex('finishedGoods', 'sku', formula.sku);
      let fg = fgList[0];
      if (!fg) {
        fg = { sku: formula.sku, name: formula.name, stockQty: 0, costPrice: 0, sellingPrice: 0, batchId: batch.id };
      }
      const newTotalQty = (fg.stockQty || 0) + qtyProduced;
      fg.costPrice = newTotalQty ? (((fg.stockQty || 0) * (fg.costPrice || 0)) + (qtyProduced * costPerUnit)) / newTotalQty : costPerUnit;
      fg.stockQty = newTotalQty;
      fg.batchId = batch.id;
      await DB.add('finishedGoods', fg, 'fg');

      toast(`Batch ${batchNumber} recorded — cost ${fmtMoney(costPerUnit)}/${batch.unit}`, 'success');
      renderBatches(document.getElementById('inv-body'));
    });
  }

  // ---------- Finished Goods ----------
  async function renderFinished(body) {
    const fgs = await DB.getAll('finishedGoods');
    fgs.sort((a, b) => a.name.localeCompare(b.name));

    body.appendChild(el('div', { class: 'toolbar' }, [
      el('span', { class: 'muted' }, 'Finished goods stock is created automatically when you produce a batch. Set selling price here.')
    ]));

    const rows = fgs.map(fg => el('tr', {}, [
      el('td', {}, fg.name),
      el('td', {}, el('code', {}, fg.sku)),
      el('td', { class: 'num' }, fmtNum(fg.stockQty, 2)),
      el('td', { class: 'num' }, fmtMoney(fg.costPrice)),
      el('td', {}, el('input', {
        type: 'number', class: 'inline-input', value: fg.sellingPrice || 0, step: '0.01',
        onchange: async (e) => { fg.sellingPrice = parseFloat(e.target.value) || 0; await DB.put('finishedGoods', fg); toast('Price updated', 'success'); }
      })),
      el('td', { class: 'num' }, fmtMoney((fg.stockQty || 0) * (fg.costPrice || 0))),
    ]));

    body.appendChild(el('table', { class: 'data-table' }, [
      el('thead', {}, el('tr', {}, ['Product', 'SKU', 'Stock Qty', 'Cost Price', 'Selling Price', 'Stock Value'].map(h => el('th', {}, h)))),
      el('tbody', {}, rows.length ? rows : el('tr', {}, el('td', { colspan: '6', class: 'empty' }, 'No finished goods yet — produce a batch first.')))
    ]));
  }

  return { render };
})();

window.Inventory = Inventory;
