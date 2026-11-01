/* =====================================================================
   LocalizaFavela | forms.js — Render/parse do JSONB de formulários dinâmicos
   Estrutura esperada (custom_forms.estrutura):
   { "campos": [ { id, label, type: 'text'|'textarea'|'select'|'radio'|'number'|'date'|'checkbox',
                   required, options?: [], placeholder?, help? } ] }
   ===================================================================== */

const TIPOS_VALIDOS = new Set(['text','textarea','select','radio','number','date','checkbox']);

/** Sanitiza a estrutura vinda do builder antes de salvar no banco. */
export function normalizarEstrutura(estrutura) {
  const campos = Array.isArray(estrutura?.campos) ? estrutura.campos : [];
  return {
    campos: campos.map((c, i) => ({
      id: c.id || `c${i + 1}`,
      label: String(c.label || '').slice(0, 120),
      type: TIPOS_VALIDOS.has(c.type) ? c.type : 'text',
      required: Boolean(c.required),
      options: Array.isArray(c.options) ? c.options.map(o => String(o).slice(0, 80)) : undefined,
      placeholder: c.placeholder ? String(c.placeholder).slice(0, 120) : undefined,
      help: c.help ? String(c.help).slice(0, 200) : undefined,
    })).filter(c => c.label),
  };
}

/**
 * Renderiza o formulário dinâmico num container (dashboard do usuário).
 * @param {HTMLElement} container
 * @param {object} estrutura
 * @param {(respostas: object) => Promise<void>} onSubmit
 */
export function montarFormulario(container, estrutura, onSubmit) {
  container.innerHTML = '';
  const form = document.createElement('form');
  form.className = 'form-dinamico';
  form.noValidate = true;

  const campos = estrutura?.campos ?? [];
  if (!campos.length) {
    form.innerHTML = `<p class="lead">Esta ONG não definiu perguntas extras. Basta confirmar sua inscrição.</p>`;
  }

  for (const campo of campos) {
    const wrap = document.createElement('div');
    wrap.className = 'field';

    const label = document.createElement('label');
    label.htmlFor = campo.id;
    label.textContent = campo.label + (campo.required ? ' *' : '');
    wrap.appendChild(label);

    let control;
    if (campo.type === 'textarea') {
      control = el('textarea', { className: 'textarea', id: campo.id, name: campo.id, rows: 4, placeholder: campo.placeholder || '' });
    } else if (campo.type === 'select' || campo.type === 'radio') {
      if (campo.type === 'select') {
        control = el('select', { className: 'select', id: campo.id, name: campo.id });
        control.appendChild(el('option', { value: '', textContent: 'Selecione…' }));
        (campo.options || []).forEach(op => control.appendChild(el('option', { value: op, textContent: op })));
      } else {
        control = document.createElement('fieldset');
        control.style.border = 'none';
        (campo.options || []).forEach((op, idx) => {
          const r = el('input', { type: 'radio', name: campo.id, id: `${campo.id}_${idx}`, value: op });
          if (campo.required && idx === 0) r.required = true;
          control.appendChild(r);
          control.appendChild(el('label', { textContent: ' ' + op, htmlFor: r.id, style: 'margin-right:12px;font-weight:400;color:var(--text-primary)' }));
        });
      }
    } else if (campo.type === 'checkbox') {
      control = el('input', { type: 'checkbox', id: campo.id, name: campo.id, value: 'sim', style: 'width:20px;height:20px' });
    } else {
      control = el('input', { type: campo.type, className: 'input', id: campo.id, name: campo.id, placeholder: campo.placeholder || '' });
      if (campo.required) control.required = true;
    }

    if (campo.help) wrap.appendChild(el('span', { className: 'hint', textContent: campo.help }));
    wrap.appendChild(control);
    wrap.appendChild(el('span', { className: 'error-msg', textContent: 'Campo obrigatório.' }));
    form.appendChild(wrap);
  }

  const btn = el('button', { type: 'submit', className: 'btn btn-primary btn-block' });
  btn.textContent = 'Enviar inscrição';
  form.appendChild(btn);

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    // validação nativa + obrigatoriedade
    let valido = true;
    form.querySelectorAll('.field').forEach(f => f.classList.remove('has-error'));
    for (const campo of campos) {
      if (!campo.required) continue;
      let valor;
      if (campo.type === 'checkbox') {
        valor = form.querySelector(`#${CSS.escape(campo.id)}`)?.checked;
      } else if (campo.type === 'radio') {
        valor = form.querySelector(`input[name="${CSS.escape(campo.id)}"]:checked`)?.value;
      } else {
        valor = form.querySelector(`#${CSS.escape(campo.id)}`)?.value?.trim();
      }
      if (!valor) {
        valido = false;
        form.querySelector(`#${CSS.escape(campo.id)}`)?.closest('.field')?.classList.add('has-error');
        form.querySelectorAll(`input[name="${CSS.escape(campo.id)}"]`)[0]?.closest('fieldset')?.parentElement?.classList.add('has-error');
      }
    }
    if (!valido) return;

    const respostas = {};
    for (const campo of campos) {
      if (campo.type === 'checkbox') respostas[campo.id] = Boolean(form.querySelector(`#${CSS.escape(campo.id)}`)?.checked);
      else if (campo.type === 'radio') respostas[campo.id] = form.querySelector(`input[name="${CSS.escape(campo.id)}"]:checked`)?.value ?? null;
      else respostas[campo.id] = form.querySelector(`#${CSS.escape(campo.id)}`)?.value?.trim() ?? '';
    }

    btn.classList.add('is-loading');
    try { await onSubmit(respostas); } finally { btn.classList.remove('is-loading'); }
  });

  container.appendChild(form);
}

/** Cria elemento com atributos em lote (helper interno). */
function el(tag, attrs = {}) {
  const n = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => { if (k === 'textContent') n.textContent = v; else n.setAttribute(k, v); });
  return n;
}
