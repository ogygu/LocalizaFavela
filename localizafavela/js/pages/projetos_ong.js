/* =====================================================================
   LocalizaFavela | projetos_ong.js — Gestão de projetos pela ONG
   Ações: abrir/encerrar seleção (status), editar campos rápidos, excluir.
   ===================================================================== */

import { listarProjetosOng, mudarStatusProjeto, excluirProjeto } from '../services/projects_ong.js';
import { sair } from '../core/auth.js';
import { toast } from '../ui/toast.js';

document.getElementById('btnSair').addEventListener('click', sair);

const sessao = await window.LF_requireAuth('ong');
if (!sessao) throw new Error('redirecionando…');
const ongId = sessao.user.id;

const alvo = document.getElementById('listaProjetosOng');
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const fmtData = (iso) => iso ? new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR') : 'sem prazo';

const badgeStatus = (s) => ({
  aberto:   '<span class="badge badge-aberto">Seleção aberta</span>',
  em_andamento: '<span class="badge badge-em-andamento">Em andamento</span>',
  encerrado:'<span class="badge badge-encerrado">Encerrado</span>',
}[s] || `<span class="badge">${esc(s)}</span>`);

async function carregar() {
  alvo.innerHTML = '<div class="skeleton" style="height:92px"></div>'.repeat(3);
  try {
    const projetos = await listarProjetosOng(ongId);
    if (!projetos.length) {
      alvo.innerHTML = `<div class="empty-state"><span class="emoji" aria-hidden="true">🚀</span>
        <h3>Nenhum projeto publicado</h3>
        <p>Crie seu primeiro projeto e defina as perguntas do processo seletivo.</p>
        <a href="novo_projeto.html" class="btn btn-primary" style="margin-top:var(--sp-4)">Criar projeto</a></div>`;
      return;
    }
    alvo.innerHTML = projetos.map((p) => `
      <article class="app-row" data-id="${p.id}" style="flex-wrap:wrap;gap:var(--sp-3)">
        <div class="candidato" style="min-width:min(100%,320px)">
          <div>
            <strong style="font-family:var(--font-display);font-size:var(--fs-md)">${esc(p.titulo)}</strong>
            <p class="card-meta">${esc(p.area)} · ${p.vagas} vaga(s) · prazo: ${fmtData(p.prazo_inscricao)}</p>
          </div>
        </div>
        ${badgeStatus(p.status)}
        <div style="display:flex;gap:var(--sp-2);flex-wrap:wrap;margin-inline-start:auto">
          ${p.status === 'aberto'
            ? `<button type="button" class="btn btn-sm btn-secondary" data-acao="fechar" data-id="${p.id}">Encerrar seleção</button>`
            : `<button type="button" class="btn btn-sm btn-primary" data-acao="abrir" data-id="${p.id}">Reabrir seleção</button>`}
          <a class="btn btn-sm btn-ghost" href="formulario.html?projeto=${p.id}&titulo=${encodeURIComponent(p.titulo)}">Formulário</a>
          <button type="button" class="btn btn-sm btn-danger" data-acao="excluir" data-id="${p.id}" data-titulo="${esc(p.titulo)}">Excluir</button>
        </div>
      </article>`).join('');
  } catch (err) {
    alvo.innerHTML = `<div class="empty-state"><p>${esc(err.message)}</p></div>`;
  }
}

alvo.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-acao]');
  if (!btn) return;
  const id = btn.dataset.id;

  if (btn.dataset.acao === 'excluir') {
    if (!confirm(`Excluir “${btn.dataset.titulo}”?\nTodas as inscrições e o formulário serão removidos. Essa ação é irreversível.`)) return;
    btn.classList.add('is-loading');
    try { await excluirProjeto(id); toast('Projeto excluído.', 'ok'); carregar(); }
    catch (err) { toast(err.message, 'error'); btn.classList.remove('is-loading'); }
    return;
  }

  btn.classList.add('is-loading');
  try {
    await mudarStatusProjeto(id, btn.dataset.acao === 'abrir' ? 'aberto' : 'encerrado');
    toast(btn.dataset.acao === 'abrir' ? 'Seleção reaberta! 🎉' : 'Seleção encerrada.', 'ok');
    await carregar();
  } catch (err) { toast(err.message, 'error'); btn.classList.remove('is-loading'); }
});

carregar();
