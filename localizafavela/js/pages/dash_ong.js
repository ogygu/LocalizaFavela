/* =====================================================================
   LocalizaFavela | dash_ong.js — Visão geral do painel da ONG
   ===================================================================== */

import { listarProjetosOng } from '../services/projects_ong.js';
import { listarCandidatos } from '../services/candidatos.js';
import { sair } from '../core/auth.js';
import { toast } from '../ui/toast.js';

document.getElementById('btnSair').addEventListener('click', sair);

const sessao = await window.LF_requireAuth('ong');
if (!sessao) throw new Error('redirecionando…');
const { user, profile } = sessao;

/* identidade */
document.getElementById('nomeOngHeader').textContent = profile.nome_ong;
document.getElementById('regiaoOng').textContent =
  `${profile.bairro}, ${profile.cidade}/${profile.estado}${profile.verificado ? ' · ✓ conta verificada' : ''}`;
if (profile.foto_url) {
  const img = document.getElementById('fotoOng');
  img.src = profile.foto_url; img.alt = `Logo de ${profile.nome_ong}`; img.hidden = false;
  document.getElementById('iniciaisOng').hidden = true;
} else {
  document.getElementById('iniciaisOng').textContent =
    profile.nome_ong.split(/\s+/).filter(Boolean).map(p => p[0]).slice(0, 2).join('').toUpperCase();
}

const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const fmtData = (iso) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
const badge = (s) => ({
  pendente: '<span class="badge badge-pendente">Em análise</span>',
  aprovado: '<span class="badge badge-aprovado">Aprovado(a)</span>',
  rejeitado: '<span class="badge badge-rejeitado">Não selecionado(a)</span>',
}[s] || '');

try {
  const [projetos, candidatos] = await Promise.all([
    listarProjetosOng(user.id),
    listarCandidatos(user.id),
  ]);

  document.getElementById('stProjetos').textContent = projetos.length;
  document.getElementById('stAbertos').textContent = projetos.filter(p => p.status === 'aberto').length;
  document.getElementById('stPendentes').textContent = candidatos.filter(c => c.status === 'pendente').length;
  document.getElementById('stAprovados').textContent = candidatos.filter(c => c.status === 'aprovado').length;

  const alvo = document.getElementById('ultimasInscricoes');
  const ultimas = [...candidatos].sort((a, b) => b.inscrito_em.localeCompare(a.inscrito_em)).slice(0, 5);
  if (!ultimas.length) {
    alvo.innerHTML = `<div class="empty-state"><span class="emoji" aria-hidden="true">📭</span>
      <h3>Nenhuma inscrição ainda</h3>
      <p>Publique um projeto com seleção aberta e divulgue o link para a comunidade.</p>
      <a href="novo_projeto.html" class="btn btn-primary" style="margin-top:var(--sp-4)">Criar primeiro projeto</a></div>`;
  } else {
    alvo.innerHTML = ultimas.map((c) => {
      const u = c.profiles_usuarios;
      return `<article class="app-row">
        <div class="candidato">
          <span class="avatar">${esc((u.nome_completo ?? '?')[0])}</span>
          <div>
            <strong>${esc(u.nome_completo)}</strong>
            <p class="card-meta">${esc(u.bairro)}, ${esc(u.cidade)} · ${esc(c.projects?.titulo ?? '')} · ${fmtData(c.inscrito_em)}</p>
          </div>
        </div>${badge(c.status)}</article>`;
    }).join('');
  }
} catch (err) { toast(err.message, 'error'); }
