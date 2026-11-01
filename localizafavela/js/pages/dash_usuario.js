/* =====================================================================
   LocalizaFavela | dash_usuario.js — Dashboard do Usuário (pós-login)
   - Guard de sessão + role ('usuario') via window.LF_requireAuth
   - Saudação com iniciais/foto, região do perfil
   - Widgets de status das inscrições
   - Movimento recente (últimas 5) com badge de status e parecer
   ===================================================================== */

import { minhasInscricoes } from '../services/applications.js';
import { sair } from '../core/auth.js';
import { toast } from '../ui/toast.js';

document.getElementById('btnSair').addEventListener('click', sair);

const sessao = await window.LF_requireAuth('usuario');
if (!sessao) throw new Error('redirecionando…'); // guarda encerra execução
const { user, profile } = sessao;

/* ---------- IDENTIDADE ---------- */
const primeiroNome = profile.nome_completo.split(' ')[0];
document.getElementById('saudacao').textContent = `Olá, ${primeiroNome}! 👋`;
document.getElementById('minhaRegiao').textContent =
  `${profile.bairro}, ${profile.cidade}/${profile.estado}`;

const iniciais = profile.nome_completo
  .split(/\s+/).filter(Boolean)
  .map((p) => p[0]).slice(0, 2).join('').toUpperCase();

if (profile.foto_url) {
  const img = document.getElementById('fotoPerfil');
  img.src = profile.foto_url;
  img.alt = `Foto de ${primeiroNome}`;
  img.hidden = false;
  document.getElementById('iniciaisPerfil').hidden = true;
} else {
  document.getElementById('iniciaisPerfil').textContent = iniciais;
}

/* ---------- INSCRIÇÕES ---------- */
const fmtData = (iso) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
const badge = (s) => ({
  pendente:  '<span class="badge badge-pendente">Em análise</span>',
  aprovado:  '<span class="badge badge-aprovado">Aprovado(a)</span>',
  rejeitado: '<span class="badge badge-rejeitado">Não selecionado(a)</span>',
}[s] || s);
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

try {
  const inscricoes = await minhasInscricoes(user.id);

  document.getElementById('stTotal').textContent = inscricoes.length;
  document.getElementById('stPendente').textContent = inscricoes.filter(i => i.status === 'pendente').length;
  document.getElementById('stAprovado').textContent = inscricoes.filter(i => i.status === 'aprovado').length;
  document.getElementById('stRejeitado').textContent = inscricoes.filter(i => i.status === 'rejeitado').length;

  const alvo = document.getElementById('historicoResumido');
  if (!inscricoes.length) {
    alvo.innerHTML = `<div class="empty-state">
      <span class="emoji" aria-hidden="true">🌱</span>
      <h3>Tudo pronto para começar</h3>
      <p>Você ainda não se inscreveu em nenhum projeto. Explore as oportunidades perto de você!</p>
      <a href="projetos.html" class="btn btn-primary" style="margin-top:var(--sp-4)">Ver projetos</a>
    </div>`;
  } else {
    alvo.innerHTML = inscricoes.slice(0, 5).map((i) => {
      const ong = i.projects?.profiles_ongs;
      return `<article class="app-row">
        <div class="candidato">
          <div>
            <strong style="font-family:var(--font-display)">${esc(i.projects?.titulo ?? 'Projeto')}</strong>
            <p class="card-meta">${ong ? esc(`${ong.nome_ong} — ${ong.bairro}, ${ong.cidade}/${ong.estado}`) : ''} · inscrito em ${fmtData(i.inscrito_em)}</p>
            ${i.status === 'rejeitado' && i.parecer_ong ? `<p class="hint" style="margin-top:4px">Parecer da ONG: “${esc(i.parecer_ong)}”</p>` : ''}
            ${i.status === 'aprovado' ? `<p class="hint" style="margin-top:4px;color:var(--c-verde-700)">🎉 Aguarde o contato da ONG pelo WhatsApp ou e-mail.</p>` : ''}
          </div>
        </div>
        ${badge(i.status)}
      </article>`;
    }).join('');
  }
} catch (err) {
  toast(err.message, 'error');
  document.getElementById('historicoResumido').innerHTML = '';
}
