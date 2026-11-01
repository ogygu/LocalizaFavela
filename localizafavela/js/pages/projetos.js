/* =====================================================================
   LocalizaFavela | projetos.js (página) — Feed de projetos + modal de
   inscrição com formulário dinâmico renderizado pelo service forms.js
   ===================================================================== */

import { listarProjetos, obterProjetoComFormulario } from '../services/projects.js';
import { inscrever, projetosInscritos } from '../services/applications.js';
import { montarFormulario } from '../services/forms.js';
import { toast } from '../ui/toast.js';

const sb = window.LF_SUPABASE;

const grade = document.getElementById('gradeProjetos');
const contador = document.getElementById('feedContagem');
const btnMais = document.getElementById('btnCarregarMais');
const fEstado = document.getElementById('fEstado');
const fCidade = document.getElementById('fCidade');
const fBairro = document.getElementById('fBairro');
const fBusca = document.getElementById('fBusca');

let pagina = 0;
let inscritos = new Set();
let usuarioId = null;
let ultimoResultado = { projetos: [], total: 0 };

/* ---------- SESSÃO (inscrição exige login) ---------- */
(async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;
  usuarioId = session.user.id;
  try { inscritos = await projetosInscritos(usuarioId); } catch { /* segue sem marcar */ }
})();

/* ---------- FILTROS ---------- */
function filtrosAtuais() {
  return {
    estado: fEstado.value || undefined,
    cidade: fCidade.value?.trim() || undefined,
    bairro: fBairro.value?.trim() || undefined,
    busca: fBusca.value?.trim() || undefined,
  };
}

function skeletons(n = 6) {
  return Array.from({ length: n }, () => '<div class="skeleton skeleton-card"></div>').join('');
}

function cardProjeto(p) {
  const jaInscrito = inscritos.has(p.id);
  const prazo = p.prazo_inscricao
    ? new Date(p.prazo_inscricao + 'T12:00:00').toLocaleDateString('pt-BR')
    : 'sem prazo definido';
  return `
  <article class="card" data-id="${p.id}">
    <div class="card-body">
      <div class="card-meta">
        <span class="badge badge-aberto">Seleção aberta</span>
        <span class="tag">${escapeHtml(p.area)}</span>
      </div>
      <h3 class="card-title">${escapeHtml(p.titulo)}</h3>
      <p class="card-meta">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>
        ${escapeHtml(p.bairro)}, ${escapeHtml(p.cidade)}/${escapeHtml(p.estado)}
        <span class="dot"></span>${escapeHtml(p.nome_ong)}${p.verificado ? ' <span class="verified-badge">✓ verificada</span>' : ''}
      </p>
      <p class="card-desc">${escapeHtml(p.descricao)}</p>
      <div class="card-foot">
        <span class="card-meta">${p.vagas} vaga${p.vagas > 1 ? 's' : ''} · até ${prazo}</span>
        ${jaInscrito
          ? '<span class="btn btn-sm btn-inscrito">✓ Inscrito(a)</span>'
          : `<button type="button" class="btn btn-sm btn-primary" data-inscrever="${p.id}">Inscrever-se</button>`}
      </div>
    </div>
  </article>`;
}

async function carregar(reset = true) {
  if (reset) { pagina = 0; grade.innerHTML = skeletons(); }
  try {
    const { projetos, total } = await listarProjetos({ ...filtrosAtuais(), page: pagina });
    ultimoResultado = { projetos, total };
    if (reset) grade.innerHTML = '';
    if (!projetos.length && reset) {
      grade.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
        <span class="emoji" aria-hidden="true">🔍</span>
        <h3>Nenhum projeto aberto por aqui ainda</h3>
        <p>Ajuste os filtros ou amplie a busca — novas ONGs entram toda semana.</p>
      </div>`;
    } else {
      grade.insertAdjacentHTML('beforeend', projetos.map(cardProjeto).join(''));
    }
    contador.textContent = `Mostrando ${Math.min((pagina + 1) * 12, total)} de ${total} projeto${total === 1 ? '' : 's'}`;
    btnMais.style.display = (pagina + 1) * 12 < total ? 'inline-flex' : 'none';
  } catch (err) {
    grade.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><span class="emoji">😕</span><p>${err.message}</p></div>`;
  }
}

/* ---------- MODAL DE INSCRIÇÃO ---------- */
const backdrop = document.getElementById('modalInscricao');
const modalTitulo = document.getElementById('modalTitulo');
const modalCorpo = document.getElementById('modalCorpo');
let projetoAberto = null;

function abrirModal() { backdrop.classList.add('is-open'); document.body.style.overflow = 'hidden'; }
function fecharModal() { backdrop.classList.remove('is-open'); document.body.style.overflow = ''; projetoAberto = null; }

document.getElementById('modalFechar').addEventListener('click', fecharModal);
backdrop.addEventListener('click', (e) => { if (e.target === backdrop) fecharModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && backdrop.classList.contains('is-open')) fecharModal(); });

grade.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-inscrever]');
  if (!btn) return;

  if (!usuarioId) {
    toast('Entre como usuário para se inscrever 🙂', 'ok', 2500);
    sessionStorage.setItem('lf_redirect_after_login', location.href);
    setTimeout(() => { location.href = '../login.html'; }, 900);
    return;
  }

  btn.classList.add('is-loading');
  try {
    const { projeto, estrutura } = await obterProjetoComFormulario(btn.dataset.inscrever);
    projetoAberto = projeto;
    modalTitulo.textContent = projeto.titulo;
    modalCorpo.innerHTML = `<p class="lead" style="font-size:var(--fs-sm);margin-bottom:var(--sp-4)">${escapeHtml(projeto.descricao)}</p><div id="alvoForm"></div>`;
    montarFormulario(document.getElementById('alvoForm'), estrutura, enviarInscricao);
    abrirModal();
  } catch (err) { toast(err.message, 'error'); }
  finally { btn.classList.remove('is-loading'); }
});

async function enviarInscricao(respostas) {
  if (!projetoAberto) return;
  try {
    await inscrever(usuarioId, projetoAberto.id, respostas);
    inscritos.add(projetoAberto.id);
    fecharModal();
    toast('🎉 Inscrição enviada! A ONG vai analisar com carinho.', 'ok', 4500);
    carregar(true);
  } catch (err) {
    toast(err.message, 'error');
  }
}

/* ---------- EVENTOS DE FILTRO ---------- */
let debounce;
[fCidade, fBairro, fBusca].forEach((inp) =>
  inp.addEventListener('input', () => { clearTimeout(debounce); debounce = setTimeout(() => carregar(true), 450); }));
fEstado.addEventListener('change', () => carregar(true));
document.getElementById('btnLimpar').addEventListener('click', () => {
  fEstado.value = ''; fCidade.value = ''; fBairro.value = ''; fBusca.value = '';
  carregar(true);
});
btnMais.addEventListener('click', () => { pagina++; carregar(false); });

function escapeHtml(s = '') {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

carregar(true);
