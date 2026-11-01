/* =====================================================================
   LocalizaFavela | projects_ong.js — CRUD de projetos + formulários (ONG)
   RLS garante: só a própria ONG escreve nos próprios registros.
   ===================================================================== */

const sb = window.LF_SUPABASE;

export async function listarProjetosOng(ongId) {
  const { data, error } = await sb.from('projects')
    .select('id, titulo, area, vagas, status, prazo_inscricao, criado_em')
    .eq('ong_id', ongId)
    .order('criado_em', { ascending: false });
  if (error) throw new Error('Não foi possível carregar seus projetos.');
  return data ?? [];
}

/** Cria projeto + formulário dinâmico associado (transação simples no client). */
export async function criarProjeto(ongId, projeto, estruturaForm) {
  const { data, error } = await sb.from('projects').insert({
    ong_id: ongId,
    titulo: projeto.titulo.trim(),
    descricao: projeto.descricao.trim(),
    area: projeto.area,
    vagas: Number(projeto.vagas),
    status: 'aberto',
    prazo_inscricao: projeto.prazo || null,
  }).select('id').single();
  if (error) throw new Error('Não foi possível publicar o projeto. Tente novamente.');

  if (estruturaForm?.campos?.length) {
    const { error: fErr } = await sb.from('custom_forms').insert({ project_id: data.id, estrutura: estruturaForm });
    if (fErr) throw new Error('Projeto criado, mas o formulário falhou ao salvar. Edite e reenvie as perguntas.');
  }
  return data.id;
}

export async function atualizarProjeto(projectId, campos) {
  const { error } = await sb.from('projects').update(campos).eq('id', projectId);
  if (error) throw new Error('Não foi possível atualizar o projeto.');
}

export async function mudarStatusProjeto(projectId, status) {
  await atualizarProjeto(projectId, { status });
}

/** Remove projeto (e, por cascade, formulário/inscrições). Só permitir se vazio? UI confirma. */
export async function excluirProjeto(projectId) {
  const { error } = await sb.from('projects').delete().eq('id', projectId);
  if (error) throw new Error('Não foi possível excluir o projeto.');
}

/** Estrutura do formulário de um projeto (para edição no builder). */
export async function obterEstruturaFormulario(projectId) {
  const { data } = await sb.from('custom_forms').select('estrutura').eq('project_id', projectId).maybeSingle();
  return data?.estrutura ?? { campos: [] };
}

export async function salvarEstruturaFormulario(projectId, estrutura) {
  const { error } = await sb.from('custom_forms')
    .upsert({ project_id: projectId, estrutura }, { onConflict: 'project_id' });
  if (error) throw new Error('Não foi possível salvar o formulário.');
}
