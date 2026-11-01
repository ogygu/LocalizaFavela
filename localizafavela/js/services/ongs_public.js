/* =====================================================================
   LocalizaFavela | ongs_public.js — Vitrine pública de ONGs (leitura RLS)
   A policy "ONGs: leitura pública" do banco já restringe a apenas
   campos não sensíveis? Não — por isso selecionamos SÓ o necessário.
   ===================================================================== */

const sb = window.LF_SUPABASE;

/** Lista ONGs com filtros de localização (para o usuário conhecer vizinhança). */
export async function listarOngs({ estado, cidade, bairro, busca } = {}) {
  let query = sb
    .from('profiles_ongs')
    .select('id, nome_ong, foto_url, finalidade, cidade, bairro, estado, verificado, rede_social');

  if (estado) query = query.eq('estado', estado);
  if (cidade) query = query.ilike('cidade', `%${cidade}%`);
  if (bairro) query = query.ilike('bairro', `%${bairro}%`);
  if (busca)  query = query.or(`nome_ong.ilike.%${busca}%,finalidade.ilike.%${busca}%`);

  const { data, error } = await query.order('nome_ong');
  if (error) throw new Error('Não foi possível carregar as ONGs agora.');
  return data ?? [];
}

/** Uma ONG + seus projetos abertos (página ong/perfil_publico.html?id=...). */
export async function obterOngCompleta(ongId) {
  const { data: ong, error } = await sb
    .from('profiles_ongs')
    .select('id, nome_ong, foto_url, finalidade, publico_alvo, cidade, bairro, estado, verificado, rede_social, criado_em')
    .eq('id', ongId).maybeSingle();
  if (error || !ong) throw new Error('ONG não encontrada.');

  const [{ data: projetos }, galeria] = await Promise.all([
    sb.from('projects').select('id, titulo, descricao, area, vagas, status, prazo_inscricao, criado_em')
      .eq('ong_id', ongId).eq('status', 'aberto').order('criado_em', { ascending: false }),
    import('./profile.js').then(m => m.listarGaleria(ongId)),
  ]);
  return { ong, projetos: projetos ?? [], galeria };
}
