/* =====================================================================
   LocalizaFavela | formulario_ong.js — Editor do formulário dinâmico
   Carrega custom_forms.estrutura (?projeto=id), edita e faz upsert.
   ===================================================================== */

import { obterEstruturaFormulario, salvarEstruturaFormulario } from '../services/projects_ong.js';
import { normalizarEstrutura } from '../services/forms.js';
import { sair } from '../core/auth.js';
import { toast } from '../ui/toast.js';

document.getElementById('btnSair').addEventListener('click', sair);

const sessao = await window.LF_requireAuth('ong');
if (!sessao) throw new Error('redirecionando…');

const params = new URLSearchParams(location.search);
const projetoId = params.get('projeto');
if (!projetoId) { location.href = 'projetos.html'; throw new Error('sem projeto'); }
document.getElementById('nomeProjeto').textContent = decodeURIComponent(params.get('titulo') ?? '—');

const container = document.getElementById('builderCampos');
const TIPO_LABEL = { text: 'Resposta curta', textarea: 'Texto longo', number: 'Número', date: 'Data', select: 'Lista', radio: 'Escolha única', checkbox: 'Sim/Não' };

function linhaCampo({ label = '', type = 'text', required = false, options = '' } = {}) {
  const div = document.createElement('div');
  div.className = 'builder-row';
  div.dataset.tipo = type;
  div.innerHTML = `
    <span class="tag">${TIPO_LABEL[type]}</span>
    <input class="input b-label" type="text" maxlength="120" placeholder='Texto da pergunta' value="${label.replace(/"/g, '&quot;')}" />
    ${['select', 'radio'].includes(type)
      ? `<input class="input b-options" type="text" placeholder="Opções separadas por vírgula" value="${options.replace(/"/g, '&quot;')}" />` : ''}
    <label class="b-required" style="display:flex;align-items:center;gap:6px;font-size:var(--fs-sm);white-space:nowrap">
      <input type="checkbox" ${required ? 'checked' : ''} /> Obrigatória
    </label>
    <button type="button" class="btn btn-sm btn-ghost b-del" aria-label="Remover pergunta">✕</button>`;
  div.querySelector('.b-del').addEventListener('click', () => div.remove());
  return div;
}

document.getElementById('btnAddCampo').addEventListener('click', () => {
  container.appendChild(linhaCampo({ type: document.getElementById('np_tiponovo').value }));
});

/* carrega estrutura existente */
try {
  const estrutura = await obterEstruturaFormulario(projetoId);
  if (!estrutura.campos.length) {
    container.appendChild(linhaCampo({ label: 'Por que você quer participar deste projeto?', type: 'textarea', required: true }));
  } else {
    estrutura.campos.forEach((c) => container.appendChild(linhaCampo({
      label: c.label, type: c.type, required: c.required, options: (c.options ?? []).join(', '),
    })));
  }
} catch { toast('Não foi possível carregar o formulário.', 'error'); }

function coletarEstrutura() {
  const campos = [...container.querySelectorAll('.builder-row')].map((row) => ({
    label: row.querySelector('.b-label').value,
    type: row.dataset.tipo,
    required: row.querySelector('.b-required input').checked,
    options: row.querySelector('.b-options')?.value
      ? row.querySelector('.b-options').value.split(',').map((o) => o.trim()).filter(Boolean)
      : undefined,
  }));
  return normalizarEstrutura({ campos });
}

document.getElementById('btnSalvarForm').addEventListener('click', async () => {
  const vazias = [...container.querySelectorAll('.builder-row')].some((r) => !r.querySelector('.b-label').value.trim());
  if (vazias) { toast('Preencha o texto de todas as perguntas (ou remova-as).', 'error'); return; }

  const btn = document.getElementById('btnSalvarForm');
  btn.classList.add('is-loading');
  try {
    await salvarEstruturaFormulario(projetoId, coletarEstrutura());
    toast('Formulário salvo! ✅', 'ok');
  } catch (err) { toast(err.message, 'error'); }
  finally { btn.classList.remove('is-loading'); }
});
