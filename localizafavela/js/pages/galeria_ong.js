/* =====================================================================
   LocalizaFavela | galeria_ong.js — Upload/remoção de fotos da ONG
   Armazenamento: bucket 'galeria' (público leitura), path = {ongId}/
   Metadados (legenda + url) na tabela gallery_images.
   ===================================================================== */

import { listarGaleria, enviarFoto, removerFoto } from '../services/profile.js';
import { sair } from '../core/auth.js';
import { toast } from '../ui/toast.js';

document.getElementById('btnSair').addEventListener('click', sair);

const sessao = await window.LF_requireAuth('ong');
if (!sessao) throw new Error('redirecionando…');
const ongId = sessao.user.id;

const grade = document.getElementById('gradeGaleria');
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

async function carregar() {
  grade.innerHTML = '<div class="skeleton" style="aspect-ratio:4/3;border-radius:var(--radius-md)"></div>'.repeat(3);
  try {
    const fotos = await listarGaleria(ongId);
    if (!fotos.length) {
      grade.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><span class="emoji" aria-hidden="true">📷</span>
        <h3>Sua galeria está vazia</h3><p>Envie a primeira foto das suas atividades.</p></div>`;
      return;
    }
    grade.innerHTML = fotos.map((f) => `
      <figure class="gallery-item" data-id="${f.id}">
        <img src="${f.url}" alt="${esc(f.legenda)}" loading="lazy" />
        <figcaption>${esc(f.legenda)}</figcaption>
        <button type="button" class="btn btn-sm btn-danger g-del" aria-label="Excluir foto">✕</button>
      </figure>`).join('');
  } catch (err) {
    grade.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><p>${esc(err.message)}</p></div>`;
  }
}

grade.addEventListener('click', async (e) => {
  const btn = e.target.closest('.g-del');
  if (!btn) return;
  if (!confirm('Remover esta foto da galeria pública?')) return;
  btn.classList.add('is-loading');
  try { await removerFoto(btn.closest('.gallery-item').dataset.id, ongId); toast('Foto removida.', 'ok'); carregar(); }
  catch (err) { toast(err.message, 'error'); btn.classList.remove('is-loading'); }
});

document.getElementById('formUploadGaleria').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const fileInput = document.getElementById('g_arquivo');
  const legenda = document.getElementById('g_legenda').value.trim();
  const file = fileInput.files?.[0];

  let ok = true;
  if (!file || !['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
    fileInput.closest('.field').classList.add('has-error'); ok = false;
  } else fileInput.closest('.field').classList.remove('has-error');
  if (legenda.length < 5) {
    document.getElementById('g_legenda').closest('.field').classList.add('has-error'); ok = false;
  } else document.getElementById('g_legenda').closest('.field').classList.remove('has-error');
  if (!ok) return;

  const btn = document.getElementById('btnEnviarFoto');
  btn.classList.add('is-loading');
  try {
    await enviarFoto(file, legenda, ongId);
    toast('Foto publicada na galeria! 🖼️', 'ok');
    ev.target.reset();
    carregar();
  } catch (err) { toast(err.message, 'error'); }
  finally { btn.classList.remove('is-loading'); }
});

carregar();
