/* =====================================================================
   LocalizaFavela | applications.js — Inscrições (usuário) e triagem (ONG)
   A RLS do banco garante que cada consulta só devolve o permitido.
   ===================================================================== */

const sb = window.LF_SUPABASE;

/** Converte rótulos do enum do banco (aprovada/rejeitada) para a UI (aprovado/rejeitado). */
const normalizarApp = (a) => (a?.status === 'aprovada' ? { ...a, status: 'aprovado' }
  : a?.status === 'rejeitada' ? { ...a, status: 'rejeitado' } : a);

/* ---------- LADO USUÁRIO ---------- */

/** Envia inscrição com respostas do formulário dinâmico. */
export async function inscrever(usuarioId, projectId, respostas) {
  const { error } = await sb.from('applications').insert({
    usuario_id: usuarioId,
    project_id: projectId,
    respostas,               // JSONB: { campoId: valor }
    status: 'pendente',
  });
  if (error) {
    if (error.code === '23505') throw new Error('Você já está inscrito neste projeto.');
    throw new Error('Não foi possível enviar sua inscrição. Tente novamente.');
  }
  return true;
}

/** Histórico de inscrições do usuário logado (com dados do projeto). */
export async function minhasInscricoes(usuarioId) {
  const { data, error } = await sb
    .from('applications')
    .select('id, status, parecer_ong, inscrito_em, decidido_em, project_id, projects(*, profiles_ongs(nome_ong, cidade, bairro, estado, verificado)))')
    .eq('usuario_id', usuarioId)
    .order('inscrito_em', { ascending: false });
  if (error) throw new Error('Falha ao carregar seu histórico.');
  // enum do banco ('aprovada'/'rejeitada') -> rótulos da UI ('aprovado'/'rejeitado')
  return (data ?? []).map(normalizarApp);
}

/** IDs de projetos nos quais o usuário já se inscreveu (para marcar cards). */
export async function projetosInscritos(usuarioId) {
  const { data } = await sb.from('applications').select('project_id').eq('usuario_id', usuarioId);
  return new Set((data ?? []).map(r => r.project_id));
}

/* ---------- LADO ONG ---------- */

/** Inscritos nos projetos da ONG (RLS restringe automaticamente). */
export async function inscritosDaOng(ongId, { status, projectId } = {}) {
  let query = sb
    .from('applications')
    .select('*, profiles_usuarios(id, nome_completo, whatsapp, email, rede_social, cidade, bairro, bio, foto_url), projects(titulo, id)')
    .eq('projects.ong_id', ongId)
    .order('inscrito_em', { ascending: false });

  if (status)    query = query.eq('status', status);
  if (projectId) query = query.eq('project_id', projectId);

  const { data, error } = await query;
  if (error) throw new Error('Falha ao carregar inscritos.');
  return (data ?? []).map(normalizarApp);
}

/** Aprova/rejeita inscrição. O trigger fn_marcar_decisao preenche decidido_em. */
export async function decidirInscricao(applicationId, status, parecer = null) {
  if (status === 'rejeitado' && !parecer?.trim()) {
    throw new Error('Ao rejeitar, escreva um parecer — respeito ao candidato (ODS 10).');
  }
  const statusBanco = status === 'aprovado' ? 'aprovada'
                    : status === 'rejeitado' ? 'rejeitada' : status;
  const { error } = await sb
    .from('applications')
    .update({ status: statusBanco, parecer_ong: parecer }) // decidido_em: trigger fn_marcar_decisao
    .eq('id', applicationId)
    .eq('status', 'pendente'); // nunca re-decidir
  if (error) throw new Error('Esta inscrição já foi decidida (decisão é definitiva).');
  return true;
}

/** Contagem para os widgets do dashboard da ONG.
 *  Nota: NÃO usamos a view v_app_counts aqui — views sem security_invoker
 *  ignoram RLS e exporiam totais entre ONGs. A contagem via applications
 *  respeita a policy "ONG vê só inscrições dos SEUS projetos". */
export async function resumoTriagem(ongId) {
  const apps = await inscritosDaOng(ongId);
  return {
    total: apps.length,
    pendentes: apps.filter(a => a.status === 'pendente').length,
    aprovados: apps.filter(a => a.status === 'aprovado').length,
    rejeitados: apps.filter(a => a.status === 'rejeitado').length,
  };
}
