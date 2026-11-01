/* =====================================================================
   LocalizaFavela | perfil_usuario.js — Edição de perfil + upload avatar
   Campos editáveis: foto (Storage 'avatares'), whatsapp, rede_social, bio.
   CPF/nome/endereço NÃO editáveis aqui (dados de identidade → suporte).
   ===================================================================== */

import { atualizarPerfilUsuario, uploadAvatar } from '../services/profile.js';
import { mascaraWhatsapp, ligarMascara, whatsappValido, soDigitos } from '../core/validators.js';
import { sair } from '../core/auth.js';
import { toast } from '../ui/toast.js';

document.getElementById('btnSair').addEventListener('click', sair);

const sessao = await window.LF_requireAuth('usuario');
if (!sessao) throw new Error('redirecionando…');
const { user, profile } = sessao;

/* ---------- PREENCHE FORM ---------- */
document.getElementById('nomeHeader').textContent = profile.nome_completo;
document.getElementById('docInfo').textContent =
  `CPF ${profile.cpf.replace(/(\d{3})(\d{3})(\d{3})/, '$1.$2.$3')}-•• · ${profile.email}`;
document.getElementById('p_whatsapp').value = profile.whatsapp ?? '';
document.getElementById('p_rede').value = profile.rede_social ?? '';
document.getElementById('p_bio').value = profile.bio ?? '';
const bioContador = document.getElementById('bioContador');
bioContador.textContent = (profile.bio ?? '').length;
document.getElementById('p_bio').addEventListener('input', (e) => {
  bioContador.textContent = e.target.value.length;
});

ligarMascara(document.getElementById('p_whatsapp'), mascaraWhatsapp);

function pintarAvatar(url) {
  const img = document.getElementById('fotoAtual');
  const ini = document.getElementById('iniciais');
  if (url) {
    img.src = url; img.alt = `Foto de ${profile.nome_completo.split(' ')[0]}`;
    img.hidden = false; ini.hidden = true;
  } else {
    img.hidden = true; ini.hidden = false;
    ini.textContent = profile.nome_completo.split(/\s+/).filter(Boolean).map(p => p[0]).slice(0, 2).join('').toUpperCase();
  }
}
pintarAvatar(profile.foto_url);

/* ---------- UPLOAD COM PREVIEW LOCAL ---------- */
let novoArquivo = null;
document.getElementById('p_foto').addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (!file) { novoArquivo = null; return; }
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    toast('Use apenas imagens JPG, PNG ou WebP.', 'error'); e.target.value = ''; return;
  }
  if (file.size > 2 * 1024 * 1024) {
    toast('Imagem muito grande (máx. 2 MB).', 'error'); e.target.value = ''; return;
  }
  novoArquivo = file;
  pintarAvatar(URL.createObjectURL(file)); // preview instantâneo
});

/* ---------- SALVAR ---------- */
document.getElementById('formPerfil').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const waField = document.getElementById('p_whatsapp').closest('.field');
  const wa = document.getElementById('p_whatsapp').value;
  if (!whatsappValido(wa)) { waField.classList.add('has-error'); return; }
  waField.classList.remove('has-error');

  const btn = document.getElementById('btnSalvarPerfil');
  btn.classList.add('is-loading');
  try {
    let fotoUrl = profile.foto_url;
    if (novoArquivo) fotoUrl = await uploadAvatar(novoArquivo, user.id);

    await atualizarPerfilUsuario(user.id, {
      whatsapp: soDigitos(wa),
      rede_social: document.getElementById('p_rede').value.trim() || null,
      bio: document.getElementById('p_bio').value.trim() || null,
      foto_url: fotoUrl,
    });
    profile.foto_url = fotoUrl;
    novoArquivo = null;
    toast('Perfil atualizado com sucesso! ✨', 'ok');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    btn.classList.remove('is-loading');
  }
});
