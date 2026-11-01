/* =====================================================================
   LocalizaFavela | profile.js — Perfis + upload de imagens (Supabase Storage)
   Buckets esperados (criar no painel ou via SQL da Fase 2):
   - 'avatares'  → pasta por auth.uid()
   - 'galeria-ongs' → pasta por auth.uid()
   ===================================================================== */

const sb = window.LF_SUPABASE;

/** Atualiza campos do perfil de USUÁRIO (whitelist defensiva). */
export async function atualizarPerfilUsuario(userId, dados) {
  const permitidos = ['bio', 'rede_social', 'foto_url', 'whatsapp'];
  const payload = Object.fromEntries(Object.entries(dados).filter(([k]) => permitidos.includes(k)));
  const { error } = await sb.from('profiles_usuarios').update(payload).eq('id', userId);
  if (error) throw new Error('Não foi possível salvar seu perfil.');
}

/** Atualiza campos do perfil de ONG. */
export async function atualizarPerfilOng(ongId, dados) {
  const permitidos = ['finalidade', 'publico_alvo', 'foto_url', 'rede_social', 'telefone'];
  const payload = Object.fromEntries(Object.entries(dados).filter(([k]) => permitidos.includes(k)));
  const { error } = await sb.from('profiles_ongs').update(payload).eq('id', ongId);
  if (error) throw new Error('Não foi possível salvar o perfil da ONG.');
}

/**
 * Upload de avatar (JPEG/PNG/WebP, máx 2 MB).
 * @returns {Promise<string>} URL pública da imagem
 */
export async function uploadAvatar(file, userId) {
  validarImagem(file);
  const ext = file.type.split('/')[1].replace('jpeg', 'jpg');
  const path = `${userId}/avatar.${ext}`;
  const { error } = await sb.storage.from('avatares').upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw new Error('Falha no upload da foto. Tente novamente.');
  return sb.storage.from('avatares').getPublicUrl(path).data.publicUrl;
}

/** Upload de uma foto da galeria da ONG; registra metadado em galleries. */
export async function uploadGaleria(file, ongId, legenda = '') {
  validarImagem(file);
  const nome = `${Date.now()}.${file.type.split('/')[1].replace('jpeg', 'jpg')}`;
  const path = `${ongId}/${nome}`;
  const { error } = await sb.storage.from('galeria-ongs').upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw new Error('Falha no upload da foto da galeria.');
  const url = sb.storage.from('galeria-ongs').getPublicUrl(path).data.publicUrl;

  const { error: dbErr } = await sb.from('galleries').insert({ ong_id: ongId, storage_path: path, legenda });
  if (dbErr) throw new Error('Foto enviada, mas falhou ao registrar na galeria.');
  return url;
}

/** Lista fotos da galeria de uma ONG (público pode ver — RLS read). */
export async function listarGaleria(ongId) {
  const { data } = await sb.from('galleries')
    .select('id, storage_path, legenda, ordem')
    .eq('ong_id', ongId)
    .order('ordem', { ascending: true });
  return (data ?? []).map(g => ({
    ...g,
    url: sb.storage.from('galeria-ongs').getPublicUrl(g.storage_path).data.publicUrl,
  }));
}

function validarImagem(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Use apenas imagens JPG, PNG ou WebP.');
  }
  if (file.size > 2 * 1024 * 1024) throw new Error('Imagem muito grande (máx. 2 MB).');
}
