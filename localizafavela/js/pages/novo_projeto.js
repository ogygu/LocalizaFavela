/* =====================================================================
   LocalizaFavela | novo_projeto.js — Wizard de publicação (ONG)
   Builder de formulário dinâmico → JSONB custom_forms.estrutura
   ===================================================================== */

import { criarProjeto } from '../services/projects_ong.js';
import { normalizarEstrutura } from '../services/forms.js';
import { sair } from '../core/auth.js';
import { toast } from '../ui/toast.js';

document.getElementById('btnSair').addEventListener('click', sair);

const sessao = await window.LF_requireAuth('ong');
if (!sessao) throw new Error('redirecionando…');
const ongId = sessao.user.id;

/* ---------- BUILDER ---------- */
const container = document.getElementById('builderCampos');
const TIPO_LABEL = { text: 'Resposta curta', textarea: 'Texto longo', number: 'Número', date: 'Data', select: 'Lista', radio: 'Escolha única', checkbox: 'Sim/Não' };
let seq = 0;

function linhaCampo({ label = '', type = 'text', required = false, options = '' } = {}) {
  const id = ++seq;
  const div = document.createElement('div');
  div.className = 'builder-row';
  div.dataset.tipo = type;
  div.innerHTML = `
    <span class="tag">${TIPO_LABEL[type]}</span>
    <input class="input b-label" type="text" maxlength="120" placeholder='Ex.: "Você tem disponibilidade aos sábados?"' value="${label.replace(/"/g, '&quot;')}" />
    ${['select', 'radio'].includes(type)
      ? `<input class="input b-options" type="text" placeholder="Opções separadas por vírgula (ex.: Manhã, Tarde, Noite)" value="${options}" />` : ''}
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

// duas perguntas iniciais sugeridas (boas práticas de triagem)
container.appendChild(linhaCampo({ label: 'Por que você quer participar deste projeto?', type: 'textarea', required: true }));
container.appendChild(linhaCampo({ label: 'Qual sua disponibilidade semanal?', type: 'select', required: true, options: 'Manhã, Tarde, Noite, Fins de semana' }));

/* ---------- COLETAR ESTRUTURA ---------- */
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

/* ---------- SUBMIT ---------- */
document.getElementById('formProjeto').addEventListener('submit', async (ev) => {
  ev.preventDefault();

  const titulo = document.getElementById('np_titulo').value;
  const descricao = document.getElementById('np_descricao').value;
  const area = document.getElementById('np_area').value;
  const vagas = Number(document.getElementById('np_vagas').value);
  const prazo = document.getElementById('np_prazo').value;

  let ok = true;
  const marcar = (id, erro) => { document.getElementById(id).closest('.field').classList.toggle('has-error', erro); return !erro; };
  ok &= marcar('np_titulo', titulo.trim().length < 5);
  ok &= marcar('np_descricao', descricao.trim().length < 40);
  ok &= marcar('np_area', !area);
  ok &= marcar('np_vagas', !(vagas >= 1 && vagas <= 9999));
  if (!ok) { toast('Revise os campos destacados.', 'error'); return; }

  // validação leve do builder: labels preenchidos
  const vazias = [...container.querySelectorAll('.builder-row')].some((r) => !r.querySelector('.b-label').value.trim());
  if (vazias) { toast('Preencha o texto de todas as perguntas (ou remova-as).', 'error'); return; }

  const estrutura = coletarEstrutura();
  if (estrutura.campos.length > 15) { toast('Máximo de 15 perguntas.', 'error'); return; }

  const btn = document.getElementById('btnPublicar');
  btn.classList.add('is-loading');
  try {
    await criarProjeto(ongId, { titulo, descricao, area, vagas, prazo }, estrutura);
    toast('🎉 Projeto publicado! A comunidade já pode se inscrever.', 'ok', 4000);
    setTimeout(() => { location.href = 'projetos.html'; }, 1200);
  } catch (err) {
    toast(err.message, 'error');
    btn.classList.remove('is-loading');
  }
});
