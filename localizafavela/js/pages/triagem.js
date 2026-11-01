/* =====================================================================
   LocalizaFavela | triagem.js — ONG analisa candidatos
   Card por inscrição (dados minimizados + respostas) → modal de decisão
   com parecer obrigatório (direito do cidadão a feedback).
   ===================================================================== */

import { listarProjetosOng } from '../services/projects_ong.js';
import { listarCandidatos, decidirInscricao } from '../services/candidatos.js';
import { sair } from '../core/auth.js';
import { toast } from '../ui/toast.js';
import { linkWhatsApp, mensagemAprovacao } from '../../utils/wa-link.js';

document.getElementById('btnSair').addEventListener('click', sair);

const sessao = await window.LF_requireAuth('ong');
if (!sessao) throw new Error('redirecionando…');
const ongId = sessao.user.id;

const alvo = document.getElementById('listaTriagem');
const selProjeto = document.getElementById('tProjeto');
const selStatus = document.getElementById('tStatus');

const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const fmtData = (iso) => iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const badge = (s) => ({
  pendente: '<span class="badge badge-pendente">Em análise</span>',
  aprovado: '<span class="badge badge-aprovado">Aprovado(a)</span>',
  rejeitado: '<span class="badge badge-rejeitado">Não selecionado(a)</span>',
}[s] || '');

/* carrega seletor de projetos uma vez */
try {
  const projetos = await listarProjetosOng(ongId);
  selProjeto.insertAdjacentHTML('beforeend',
    projetos.map((p) => `<option value="${p.id}">${esc(p.titulo)}</option>`).join(''));
} catch { /* segue com "Todos" */ }

/* ---------- MODAL ---------- */
const backdrop = document.getElementById('modalDecisao');
const decTitulo = document.getElementById('decTitulo');
const decCorpo = document.getElementById('decCorpo');
document.getElementById('decFechar').addEventListener('click', fechar);
backdrop.addEventListener('click', (e) => { if (e.target === backdrop) fechar(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fechar(); });
function fechar() { backdrop.classList.remove('is-open'); document.body.style.overflow = ''; }
function abrir() { backdrop.classList.add('is-open'); document.body.style.overflow = 'hidden'; }

function modalDecidir(app) {
  const u = app.profiles_usuarios;
  decTitulo.textContent = `Decisão — ${u.nome_completo}`;
  decCorpo.innerHTML = `
    <form id="formDecisao" novalidate>
      <div class="field">
        <label>Status *</label>
        <div class="segmented" role="group" aria-label="Resultado">
          <button type="button" data-res="aprovado" aria-pressed="false">Aprovar ✓</button>
          <button type="button" data-res="rejeitado" aria-pressed="false">Não selecionar</button>
        </div>
        <span class="error-msg">Escolha o resultado da seleção.</span>
      </div>
      <div class="field">
        <label for="decParecer">Parecer para o candidato *</label>
        <textarea class="textarea" id="decParecer" rows="4" maxlength="600" placeholder="Ex.: Obrigado por se inscrever! Seu perfil não atende aos critérios desta turma, mas teremos prazer em te receber na próxima…" required></textarea>
        <span class="hint">Enviado ao cidadão no dashboard dele. Seja claro e respeitoso.</span>
        <span class="error-msg">Escreva o parecer (mín. 10 caracteres).</span>
      </div>
      <button type="submit" class="btn btn-primary btn-block" id="btnConfirmarDecisao">Confirmar decisão</button>
    </form>`;

  let resultado = null;
  decCorpo.querySelectorAll('[data-res]').forEach((b) =>
    b.addEventListener('click', () => {
      resultado = b.dataset.res;
      decCorpo.querySelectorAll('[data-res]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      b.closest('.field').classList.remove('has-error');
    }));

  document.getElementById('formDecisao').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const parecer = document.getElementById('decParecer').value.trim();
    let ok = true;
    if (!resultado) { decCorpo.querySelector('[data-res]').closest('.field').classList.add('has-error'); ok = false; }
    if (parecer.length < 10) { document.getElementById('decParecer').closest('.field').classList.add('has-error'); ok = false; }
    if (!ok) return;

    const btn = document.getElementById('btnConfirmarDecisao');
    btn.classList.add('is-loading');
    try {
      await decidirInscricao(app.id, resultado, parecer);
      fechar();
      toast(resultado === 'aprovado'
        ? '✅ Candidato aprovado! Ele já vê a novidade no painel.'
        : 'Decisão registrada. O candidato recebeu seu parecer.', 'ok');
      carregar();
    } catch (err) { toast(err.message, 'error'); btn.classList.remove('is-loading'); }
  });
  abrir();
}

/* ---------- LISTAGEM ---------- */
async function carregar() {
  alvo.innerHTML = '<div class="skeleton" style="height:110px"></div>'.repeat(3);
  try {
    const apps = await listarCandidatos(ongId, {
      status: selStatus.value || undefined,
      projectId: selProjeto.value || undefined,
    });
    if (!apps.length) {
      alvo.innerHTML = `<div class="empty-state"><span class="emoji" aria-hidden="true">🧺</span>
        <h3>Nada para triar aqui</h3><p>Ajuste os filtros ou aguarde novas inscrições.</p></div>`;
      return;
    }
    alvo.innerHTML = apps.map((app, idx) => {
      const u = app.profiles_usuarios;
      const respostasHtml = Object.entries(app.respostas ?? {}).map(([k, v]) =>
        `<li><strong>${esc(k)}:</strong> ${esc(Array.isArray(v) ? v.join(', ') : v ?? '—')}</li>`).join('');
      const podeDecidir = app.status === 'pendente';
      return `
      <article class="card" style="padding:var(--sp-4)">
        <div style="display:flex;gap:var(--sp-3);align-items:start;flex-wrap:wrap">
          <span class="avatar" aria-hidden="true">${esc((u.nome_completo ?? '?')[0])}</span>
          <div style="flex:1;min-width:min(100%,240px)">
            <div style="display:flex;gap:var(--sp-2);align-items:center;flex-wrap:wrap">
              <strong style="font-family:var(--font-display);font-size:var(--fs-md)">${esc(u.nome_completo)}</strong>
              ${badge(app.status)}
            </div>
            <p class="card-meta">${esc(app.projects?.titulo ?? '')} · inscrito em ${fmtData(app.inscrito_em)}</p>
            <p class="card-meta">📍 ${esc(u.bairro)}, ${esc(u.cidade)} · 💬 ${esc(u.whatsapp)} · ✉️ ${esc(u.email)}</p>
            ${u.bio ? `<p class="card-desc" style="margin-top:var(--sp-2)">${esc(u.bio)}</p>` : ''}
            ${respostasHtml ? `<details style="margin-top:var(--sp-2)"><summary style="cursor:pointer;color:var(--link-color);font-weight:600;font-size:var(--fs-sm)">Respostas da inscrição</summary><ul style="margin:var(--sp-2) 0 0;display:flex;flex-direction:column;gap:2px;font-size:var(--fs-sm);color:var(--text-secondary)">${respostasHtml}</ul></details>` : ''}
            ${app.parecer_ong ? `<p class="hint" style="margin-top:var(--sp-2)">Parecer enviado: “${esc(app.parecer_ong)}” em ${fmtData(app.decidido_em)}</p>` : ''}
          </div>
          <div style="display:flex;flex-direction:column;gap:var(--sp-2)">
            ${podeDecidir ? `<button type="button" class="btn btn-sm btn-primary" data-decidir="${idx}">Analisar & decidir</button>` : ''}
            ${app.status === 'aprovado' ? `<a class="btn btn-sm btn-inscrito" href="${linkWhatsApp(u.whatsapp, mensagemAprovacao({ ongNome: sessao.profile.nome_ong, projetoTitulo: app.projects?.titulo ?? 'nosso projeto' }))}" target="_blank" rel="noopener">💬 Chamar no WhatsApp</a>` : ''}
          </div>
        </div>
      </article>`;
    }).join('');

    alvo.querySelectorAll('[data-decidir]').forEach((b) =>
      b.addEventListener('click', () => modalDecidir(apps[Number(b.dataset.decidir)])));
  } catch (err) {
    alvo.innerHTML = `<div class="empty-state"><p>${esc(err.message)}</p></div>`;
  }
}

selProjeto.addEventListener('change', carregar);
selStatus.addEventListener('change', carregar);
carregar();
