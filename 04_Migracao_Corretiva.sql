-- =====================================================================
-- LOCALIZAFAVELA — 04_Migracao_Corretiva.sql
-- Correção aplicada após o erro "column f.ativo does not exist".
-- Esse erro veio de uma view ANTIGA que referenciava colunas inexistentes
-- (campos/ativo/total_vagas). As tabelas já estão criadas no seu projeto;
-- este script apenas RECRIA as duas views de apoio na forma correta.
-- Cole tudo no SQL Editor do Supabase e clique Run. (Idempotente.)
-- =====================================================================

drop view if exists public.v_app_counts_feminino;
drop view if exists public.v_projects_feed;
drop view if exists public.v_app_counts;

-- 1) Feed público de projetos abertos + dados da ONG sede
create view public.v_projects_feed as
select
    p.id,
    p.titulo,
    p.descricao,
    p.area,
    p.vagas,
    p.status,
    p.prazo_inscricao,
    p.criado_em,
    o.id            as ong_id,
    o.nome_ong,
    o.foto_url      as ong_foto,
    o.finalidade,
    o.estado        as ong_estado,
    o.cidade        as ong_cidade,
    o.bairro        as ong_bairro,
    o.verificado
from public.projects p
join public.profiles_ongs o on o.id = p.ong_id
where p.status = 'aberto';

-- 2) Contagem de inscritos por projeto (rótulos normalizados p/ a UI)
create view public.v_app_counts as
select
    a.project_id,
    count(*) filter (where a.status = 'pendente')  as pendentes,
    count(*) filter (where a.status = 'aprovada')  as aprovados,
    count(*) filter (where a.status = 'rejeitada') as rejeitados
from public.applications a
group by a.project_id;

-- 3) Buckets do Storage (crie manualmente se não existirem):
--    Dashboard → Storage → New bucket: "avatares" (public) e "galeria-ongs" (public)

-- 4) Verificação rápida (deve retornar 6 linhas com os nomes abaixo):
select table_name from information_schema.tables
where table_schema = 'public'
order by table_name;
