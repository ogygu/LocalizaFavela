/* =====================================================================
   LocalizaFavela | candidatos.js — Triagem de inscrições pela ONG
   A RLS já esconde inscrições de projetos de OUTRAS ONGs; aqui só lemos
   os dados necessários para a decisão (minimização LGPD).
   ===================================================================== */

const sb = window.LF_SUPABASE;

/** Converte rótulos do enum do banco (aprovada/rejeitada) para a UI (aprovado/rejeitado). */
const normalizarApp = (a) => (a?.status === 'aprovada' ? { ...a, status: 'aprovado' }
  : a?.status === 'rejeitada' ? { ...a, status: 'rejeitado' } : a);

/** Inscrições dos projetos da ONG (com perfil público do candidato). */
export async function listarCandidatos(ongId, { status, projectId } = {}) {
  let query = sb.from('applications')
    .select(`
      id, status, inscrito_em, decidido_em, parecer_ong, respostas,
      project_id,
      projects!inner ( id, titulo, ong_id ),
      profiles_usuarios!inner ( id, nome_completo, whatsapp, email, cidade, bairro, foto_url, bio )
    `)
    .eq('projects.ong_id', ongId);

  if (status) query = query.eq('status', status);
  if (projectId) query = query.eq('project_id', projectId);

  const { data, error } = await query.order('inscrito_em', { ascending: true });
  if (error) throw new Error('Não foi possível carregar as inscrições recebidas.');
  // O enum do banco usa 'aprovada'/'rejeitada'; a UI padroniza 'aprovado'/'rejeitado'.
  return (data ?? []).map(normalizarApp);
}

/** Decisão única: aprovado|rejeitado + parecer obrigatório (UX de respeito). */
export async function decidirInscricao(applicationId, status, parecer) {
  const statusBanco = status === 'aprovado' ? 'aprovada'
                    : status === 'rejeitado' ? 'rejeitada' : status;
  const { error } = await sb.from('applications')
    .update({ status: statusBanco, parecer_ong: parecer }) // decidido_em é preenchido pelo trigger fn_marcar_decisao
    .eq('id', applicationId)
    .eq('status', 'pendente'); // nunca re-decidir
  if (error) throw new Error('Esta inscrição já foi decidida ou não existe mais.');
}

/** Contadores para os widgets do dashboard da ONG. */
export async function contagensTriagem(ongId) {
  const apps = await listarCandidatos(ongId);
  return {
    total: apps.length,
    pendentes: apps.filter(a => a.status === 'pendente').length,
    aprovados: apps.filter(a => a.status === 'aprovado').length,
    rejeitados: apps.filter(a => a.status === 'rejeitado').length,
  };
}
