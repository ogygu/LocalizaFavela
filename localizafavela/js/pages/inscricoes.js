/* =====================================================================
   LocalizaFavela | inscricoes.js — Histórico completo (usuário logado)
   Filtro por status + resposta detalhada do formulário dinâmico
   ===================================================================== */

import { minhasInscricoes } from '../services/applications.js';
import { sair } from '../core/auth.js';
import { toast } from '../ui/toast.js';

document.getElementById('btnSair').addEventListener('click', sair);

const sessao = await window.LF_requireAuth('usuario');
if (!sessao) throw new Error('redirecionando…');
const { user } = sessao;

const listaEl = document.getElementById('listaInscricoes');
const botoes = document.querySelectorAll('[data-filtro]');
let filtro = '';
let todas = [];

const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const fmtData = (iso) => iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const badge = (s) => ({
  pendente:  '<span class="badge badge-pendente">Em análise</span>',
  aprovado:  '<span class="badge badge-aprovado">Aprovado(a)</span>',
  rejeitado: '<span class="badge badge-rejeitado">Não selecionado(a)</span>',
}[s] || '');

function render() {
  const dados = filtro ? todas.filter((t) => t.status === filtro) : todas;
  if (!dados.length) {
    listaEl.innerHTML = `<div class="empty-state"><span class="emoji" aria-hidden="true">🍃</span>
      <p>${todas.length ? 'Nenhuma inscrição neste status.' : 'Você ainda não tem inscrições. Que tal encontrar um projeto perto de casa?'}</p>
      ${!todas.length ? '<a href="projetos.html" class="btn btn-primary" style="margin-top:var(--sp-4)">Explorar</a>' : ''}</div>`;
    return;
  }
  listaEl.innerHTML = dados.map((i) => {
    const ong = i.projects?.profiles_ongs;
    const respostas = i.respostas && Object.keys(i.respostas).length
      ? `<details style="margin-top:var(--sp-2);font-size:var(--fs-sm)">
           <summary style="cursor:pointer;color:var(--link-color);font-weight:600">Ver minhas respostas</summary>
           <ul style="margin-top:var(--sp-2);display:flex;flex-direction:column;gap:2px;color:var(--text-secondary)">
             ${Object.entries(i.respostas).map(([k, v]) => `<li><strong>${esc(k)}:</strong> ${esc(Array.isArray(v) ? v.join(', ') : v ?? '—')}</li>`).join('')}
           </ul>
         </details>` : '';
    const parecer = i.parecer_ong
      ? `<p style="margin-top:var(--sp-2);font-size:var(--fs-sm);background:var(--c-terra-100);padding:var(--sp-3);border-radius:var(--radius-md)">
           📝 <strong>Parecer da ONG:</strong> ${esc(i.parecer_ong)}
           ${i.decidido_em ? `<span class="hint"> · decidido em ${fmtData(i.decidido_em)}</span>` : ''}
         </p>` : '';
    return `<article class="app-row" style="display:block">
      <div style="display:flex;justify-content:space-between;gap:var(--sp-3);flex-wrap:wrap;align-items:start">
        <div>
          <strong style="font-family:var(--font-display);font-size:var(--fs-md)">${esc(i.projects?.titulo ?? 'Projeto')}</strong>
          <p class="card-meta">${ong ? esc(`${ong.nome_ong} — ${ong.bairro}, ${ong.cidade}/${ong.estado}`) : ''}</p>
        </div>${badge(i.status)}
      </div>
      <p class="hint" style="margin-top:var(--sp-2)">Inscrição enviada em ${fmtData(i.inscrito_em)}</p>
      ${parecer}${respostas}
    </article>`;
  }).join('');
}

botoes.forEach((b) => b.addEventListener('click', () => {
  filtro = b.dataset.filtro;
  botoes.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  render();
}));

try {
  todas = await minhasInscricoes(user.id);
  render();
} catch (err) { toast(err.message, 'error'); listaEl.innerHTML = ''; }
