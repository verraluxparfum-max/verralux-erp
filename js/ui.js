/* Shared modal + form helpers used across all modules */

function field(label, name, value, required, type = 'text') {
  return el('label', {}, [
    label,
    el('input', { type, name, value: value ?? '', ...(required ? { required: 'required' } : {}) })
  ]);
}

function selectField(label, name, options, selected) {
  return el('label', {}, [
    label,
    el('select', { name }, [el('option', { value: '' }, '— select —')].concat(
      options.map(o => el('option', { value: o, selected: o === selected }, o))
    ))
  ]);
}

function textareaField(label, name, value) {
  return el('label', {}, [label, el('textarea', { name }, value || '')]);
}

function formData(form) {
  const fd = new FormData(form);
  const out = {};
  for (const [k, v] of fd.entries()) out[k] = v;
  return out;
}

function openModal(title, formNode, onSubmit, opts = {}) {
  const backdrop = el('div', { class: 'modal-backdrop' });
  const closeBtn = el('button', { type: 'button', class: 'modal-close', onclick: () => backdrop.remove() }, '✕');

  formNode.appendChild(el('div', { class: 'modal-actions' }, [
    el('button', { type: 'button', class: 'btn-secondary', onclick: () => backdrop.remove() }, 'Cancel'),
    el('button', { type: 'submit', class: 'btn btn-primary' }, 'Save')
  ]));

  formNode.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (formNode.checkValidity && !formNode.checkValidity()) { formNode.reportValidity(); return; }
    await onSubmit();
    backdrop.remove();
  });

  const modal = el('div', { class: `modal ${opts.wide ? 'modal-wide' : ''}` }, [
    el('div', { class: 'modal-head' }, [el('h3', {}, title), closeBtn]),
    formNode
  ]);
  backdrop.appendChild(modal);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.remove(); });
  document.body.appendChild(backdrop);
  const firstInput = formNode.querySelector('input, select, textarea');
  if (firstInput) firstInput.focus();
}

window.field = field;
window.selectField = selectField;
window.textareaField = textareaField;
window.formData = formData;
window.openModal = openModal;
