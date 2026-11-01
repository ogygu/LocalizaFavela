/* =====================================================================
   LocalizaFavela | projects.js — Consultas de projetos (camada de serviço)
   Usa a view v_projects_feed (security_invoker) definida no banco.
   ===================================================================== */

const sb = window.LF_SUPABASE;

/**
 * Lista projetos abertos com filtros por localização (UX do dashboard).
 * @param {{estado?:string, cidade?:string, bairro?:string, area?:string, busca?:string, page?:number}} filtros
 */
export async function listarProjetos({ estado, cidade, bairro, area, busca, page = 0, porPagina = 12 } = {}) {
  let query = sb
    .from('v_projects_feed')
    .select('*', { count: 'exact' })
    .eq('status', 'aberto')
    .order('criado_em', { ascending: false })
    .range(page * porPagina, (page + 1) * porPagina - 1);

  if (estado) query = query.eq('ong_estado', estado);
  if (cidade) query = query.ilike('ong_cidade', `%${cidade}%`);
  if (bairro) query = query.ilike('ong_bairro', `%${bairro}%`);
  if (area)   query = query.eq('area', area);
  if (busca)  query = query.or(`titulo.ilike.%${busca}%,descricao.ilike.%${busca}%`);

  const { data, error, count } = await query;
  if (error) throw new Error('Falha ao carregar projetos. Tente novamente.');
  return { projetos: data ?? [], total: count ?? 0 };
}

/** Detalhe de um projeto + estrutura do formulário dinâmico da ONG. */
export async function obterProjetoComFormulario(projectId) {
  const { data: projeto, error } = await sb
    .from('v_projects_feed').select('*').eq('id', projectId).maybeSingle();
  if (error || !projeto) throw new Error('Projeto não encontrado ou encerrado.');

  const { data: form } = await sb
    .from('custom_forms').select('estrutura').eq('project_id', projectId).maybeSingle();

  return { projeto, estrutura: form?.estrutura ?? { campos: [] } };
}

/** Insignias de região disponíveis para popular selects de filtro. */
export async function listarUfsComProjetos() {
  const { data } = await sb.from('v_projects_feed').select('ong_estado').eq('status', 'aberto');
  return [...new Set((data ?? []).map(r => r.ong_estado))].sort();
}
