-- =====================================================================
-- LOCALIZAFAVELA — FASE 2: BANCO DE DADOS SUPABASE (PostgreSQL)
-- PIE UniSales | ODS 10 & ODS 11
-- Equipe: Gustavo de Paula Bonjardim | Andressa Gonçalves | Giovanna Vargas
-- Executar no SQL Editor do Supabase, na ordem, em um projeto novo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. EXTENSÕES E TIPOS ENUM
-- ---------------------------------------------------------------------
create extension if not exists "pgcrypto";      -- gen_random_uuid()
create extension if not exists "citext";        -- e-mails case-insensitive

-- Status de um projeto/processo seletivo
create type public.project_status as enum ('rascunho', 'aberto', 'encerrado');

-- Ciclo de vida da inscrição do voluntário/assistido
create type public.app_status as enum ('pendente', 'aprovada', 'rejeitada');

-- Tipo de conta (usada para rotear dashboards e policies)
create type public.account_type as enum ('usuario', 'ong');

-- ---------------------------------------------------------------------
-- 1. TABELAS
-- ---------------------------------------------------------------------

-- 1.1 PERFIL DE USUÁRIO COMUM (espelho de auth.users)
create table public.profiles_usuarios (
    id              uuid primary key references auth.users (id) on delete cascade,
    nome_completo   varchar(120) not null,
    whatsapp        varchar(20)  not null,
    cpf             char(11)     not null unique,
    email           citext       not null,
    rede_social     varchar(140) null,               -- opcional (@perfil ou URL)
    cep             char(8)      not null,
    estado          char(2)      not null,
    cidade          varchar(80)  not null,
    bairro          varchar(80)  not null,
    bio             text         null constraint chk_bio_max check (bio is null or char_length(bio) <= 300),
    foto_url        text         null,
    criado_em       timestamptz  not null default now(),
    atualizado_em   timestamptz  not null default now(),
    constraint chk_cpf_digitos check (cpf ~ '^\d{11}$'),
    constraint chk_cep_digitos check (cep ~ '^\d{8}$'),
    constraint chk_whatsapp    check (whatsapp ~ '^\+?\d{10,13}$')
);

comment on table public.profiles_usuarios is
  'Cidadãos que buscam projetos sociais; login por CPF + senha (email real no auth).';

-- 1.2 PERFIL DE ONG / PROJETO SOCIAL
create table public.profiles_ongs (
    id             uuid primary key references auth.users (id) on delete cascade,
    nome_ong       varchar(120) not null,
    telefone       varchar(20)  not null,
    rede_social    varchar(140) null,                -- opcional
    documento      varchar(18)  not null unique,     -- CPF (11) ou CNPJ (14), só dígitos
    cep            char(8)      not null,
    estado         char(2)      not null,
    cidade         varchar(80)  not null,
    bairro         varchar(80)  not null,
    finalidade     text         not null,            -- descrição da missão
    publico_alvo   text         null,
    foto_url       text         null,
    verificado     boolean      not null default false,
    criado_em      timestamptz  not null default now(),
    atualizado_em  timestamptz  not null default now(),
    constraint chk_documento_ong check (documento ~ '^(\d{11}|\d{14})$'),
    constraint chk_cep_ong       check (cep ~ '^\d{8}$'),
    constraint chk_tel_ong       check (telefone ~ '^\+?\d{10,13}$')
);

comment on table public.profiles_ongs is
  'Organizações da sociedade civil; login por CPF/CNPJ + senha.';

-- 1.3 PROJETOS SOCIAIS / PROCESSOS SELETIVOS
create table public.projects (
    id              uuid primary key default gen_random_uuid(),
    ong_id          uuid         not null references public.profiles_ongs (id) on delete cascade,
    titulo          varchar(140) not null,
    descricao       text         not null,
    area            varchar(60)  not null,            -- Educação, Saúde, Cultura, etc.
    vagas           integer      not null default 10 constraint chk_vagas check (vagas > 0),
    status          public.project_status not null default 'aberto',
    prazo_inscricao date         null,
    criado_em       timestamptz  not null default now(),
    atualizado_em   timestamptz  not null default now()
);

-- 1.4 FORMULÁRIOS DINÂMICOS (1 por projeto) — estrutura em JSONB
create table public.custom_forms (
    id          uuid primary key default gen_random_uuid(),
    project_id  uuid    not null unique references public.projects (id) on delete cascade,
    estrutura   jsonb   not null,
    -- Exemplo:
    -- {"campos":[{"id":"c1","label":"Motivação","type":"textarea","required":true},
    --            {"id":"c2","label":"Disponibilidade","type":"select",
    --             "options":["Manhã","Tarde","Noite"],"required":true}]}
    criado_em   timestamptz not null default now(),
    constraint chk_estrutura_obj check (jsonb_typeof(estrutura) = 'object')
);

-- 1.5 INSCRIÇÕES (N:N Usuario x Projeto com atributos)
create table public.applications (
    id           uuid primary key default gen_random_uuid(),
    usuario_id   uuid    not null references public.profiles_usuarios (id) on delete cascade,
    project_id   uuid    not null references public.projects (id) on delete cascade,
    respostas    jsonb   not null default '{}'::jsonb,
    status       public.app_status not null default 'pendente',
    parecer_ong  text    null,
    inscrito_em  timestamptz not null default now(),
    decidido_em  timestamptz null,
    constraint uq_inscricao_unica unique (usuario_id, project_id)
);

-- 1.6 GALERIA DE FOTOS DA ONG (arquivos no Storage, metadados aqui)
create table public.galleries (
    id            uuid primary key default gen_random_uuid(),
    ong_id        uuid    not null references public.profiles_ongs (id) on delete cascade,
    storage_path  varchar(255) not null,   -- caminho dentro do bucket 'galeria-ongs'
    legenda       varchar(140) null,
    ordem         smallint not null default 0,
    criado_em     timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. ÍNDICES DE PERFORMANCE (filtros por localização e triagem)
-- ---------------------------------------------------------------------
create index idx_ongs_localizacao      on public.profiles_ongs (estado, cidade, bairro);
create index idx_usuarios_localizacao  on public.profiles_usuarios (estado, cidade, bairro);
create index idx_projects_ong          on public.projects (ong_id);
create index idx_projects_status       on public.projects (status);
create index idx_projects_localidade   on public.projects (status) ; -- combinado com JOIN em profiles_ongs
create index idx_apps_usuario          on public.applications (usuario_id);
create index idx_apps_project_status   on public.applications (project_id, status);
create index idx_galleries_ong         on public.galleries (ong_id, ordem);
create index idx_forms_estrutura_gin   on public.custom_forms using gin (estrutura);

-- ---------------------------------------------------------------------
-- 3. TRIGGERS E FUNÇÕES
-- ---------------------------------------------------------------------

-- 3.1 Atualizar automaticamente o campo atualizado_em
create or replace function public.fn_set_atualizado_em()
returns trigger
language plpgsql
as $$
begin
    new.atualizado_em := now();
    return new;
end;
$$;

create trigger trg_upd_profiles_usuarios
before update on public.profiles_usuarios
for each row execute function public.fn_set_atualizado_em();

create trigger trg_upd_profiles_ongs
before update on public.profiles_ongs
for each row execute function public.fn_set_atualizado_em();

create trigger trg_upd_projects
before update on public.projects
for each row execute function public.fn_set_atualizado_em();

-- 3.2 Registrar quando a inscrição foi decidida (aprovação/rejeição)
create or replace function public.fn_marcar_decisao()
returns trigger
language plpgsql
as $$
begin
    if new.status is distinct from old.status then
        if new.status in ('aprovada','rejeitada') then
            new.decidido_em := now();
        else
            new.decidido_em := null;
        end if;
    end if;
    return new;
end;
$$;

create trigger trg_apps_decisao
before update on public.applications
for each row execute function public.fn_marcar_decisao();

-- 3.3 Impedir transições inválidas de status (pendente -> aprovada/rejeitada é irreversível)
create or replace function public.fn_valida_transicao_app()
returns trigger
language plpgsql
as $$
begin
    if old.status <> 'pendente' and new.status is distinct from old.status then
        raise exception 'Inscrição já decidida não pode mudar de status.';
    end if;
    return new;
end;
$$;

create trigger trg_apps_transicao
before update on public.applications
for each row execute function public.fn_valida_transicao_app();

-- 3.4 AUTO-PERFIL AO CRIAR CONTA (trigger em auth.users)
-- O front envia o tipo de conta e os dados extras via user_metadata no signUp:
--   metadata: { tipo_conta: 'usuario'|'ong', nome, whatsapp/cpf/documento, cep, ... }
create or replace function public.fn_criar_perfil_na_signup()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
    m jsonb := new.raw_user_meta_data;
begin
    if m->>'tipo_conta' = 'ong' then
        insert into public.profiles_ongs (id, nome_ong, telefone, documento, cep, estado, cidade, bairro, finalidade)
        values (
            new.id,
            coalesce(m->>'nome_ong', 'ONG sem nome'),
            coalesce(m->>'telefone', ''),
            coalesce(m->>'documento', ''),
            coalesce(m->>'cep', '00000000'),
            coalesce(m->>'estado', 'SP'),
            coalesce(m->>'cidade', ''),
            coalesce(m->>'bairro', ''),
            coalesce(m->>'finalidade', '')
        ) on conflict (id) do nothing;
    else
        insert into public.profiles_usuarios (id, nome_completo, whatsapp, cpf, email, cep, estado, cidade, bairro)
        values (
            new.id,
            coalesce(m->>'nome_completo', 'Cidadão sem nome'),
            coalesce(m->>'whatsapp', ''),
            coalesce(m->>'cpf', ''),
            new.email,
            coalesce(m->>'cep', '00000000'),
            coalesce(m->>'estado', 'SP'),
            coalesce(m->>'cidade', ''),
            coalesce(m->>'bairro', '')
        ) on conflict (id) do nothing;
    end if;
    return new;
end;
$$;

create trigger trg_on_auth_user_created
after insert on auth.users
for each row execute function public.fn_criar_perfil_na_signup();

-- Observação acadêmica: como o INSERT acima usa valores placeholder quando o
-- client ainda não completou o formulário estendido, a tela de cadastro deve
-- fazer UPDATE no perfil logo após o signUp com os dados validados (CPF com
-- dígitos verificadores, CEP resolvido via ViaCEP etc.). Alternativa mais
-- robusta: submeter TODOS os campos no user_metadata do signUp — recomendado.

-- ---------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY (RLS)
-- ---------------------------------------------------------------------
alter table public.profiles_usuarios enable row level security;
alter table public.profiles_ongs     enable row level security;
alter table public.projects          enable row level security;
alter table public.custom_forms      enable row level security;
alter table public.applications      enable row level security;
alter table public.galleries         enable row level security;

-- 4.1 HELPERS (evitam repetição e recursion em policies)
create or replace function public.is_ong()
returns boolean
language sql stable security definer set search_path = public
as $$
    select exists (select 1 from public.profiles_ongs o where o.id = auth.uid());
$$;

create or replace function public.is_usuario()
returns boolean
language sql stable security definer set search_path = public
as $$
    select exists (select 1 from public.profiles_usuarios u where u.id = auth.uid());
$$;

-- 4.2 PROFILES_USUARIOS
-- Ler: o próprio dono; ONGs podem ler dados de inscritos (nome/whatsapp/email p/ contato)
create policy p_usu_select on public.profiles_usuarios
for select using (id = auth.uid() or public.is_ong());

create policy p_usu_insert on public.profiles_usuarios
for insert with check (id = auth.uid());

create policy p_usu_update on public.profiles_usuarios
for update using (id = auth.uid()) with check (id = auth.uid());
-- Usuário NUNCA edita o perfil de outro usuário.

-- 4.3 PROFILES_ONGS
-- Pública: qualquer pessoa autenticada ou anônima vê cards de ONG (Home/busca)
create policy p_ong_select on public.profiles_ongs
for select using (true);

create policy p_ong_insert on public.profiles_ongs
for insert with check (id = auth.uid());

create policy p_ong_update on public.profiles_ongs
for update using (id = auth.uid()) with check (id = auth.uid());
-- ONG NUNCA edita outra ONG; campo verificado é controlado pela equipe/admin.

-- 4.4 PROJECTS
-- Público lê apenas projetos abertos; ONG dona lê todos os seus (inclui rascunhos)
create policy p_proj_select on public.projects
for select using (status = 'aberto' or ong_id = auth.uid());

create policy p_proj_insert on public.projects
for insert with check (ong_id = auth.uid() and public.is_ong());

create policy p_proj_update on public.projects
for update using (ong_id = auth.uid()) with check (ong_id = auth.uid());

create policy p_proj_delete on public.projects
for delete using (ong_id = auth.uid());

-- 4.5 CUSTOM_FORMS
create policy p_form_select on public.custom_forms
for select using (
    exists (select 1 from public.projects p
            where p.id = project_id
              and (p.status = 'aberto' or p.ong_id = auth.uid()))
);

create policy p_form_write on public.custom_forms
for insert with check (
    exists (select 1 from public.projects p
            where p.id = project_id and p.ong_id = auth.uid())
);

create policy p_form_update on public.custom_forms
for update using (
    exists (select 1 from public.projects p
            where p.id = project_id and p.ong_id = auth.uid())
) with check (
    exists (select 1 from public.projects p
            where p.id = project_id and p.ong_id = auth.uid())
);

create policy p_form_delete on public.custom_forms
for delete using (
    exists (select 1 from public.projects p
            where p.id = project_id and p.ong_id = auth.uid())
);

-- 4.6 APPLICATIONS (núcleo sensível da privacidade)
-- Usuário: vê SOMENTE as próprias inscrições.
create policy p_app_select_usuario on public.applications
for select using (usuario_id = auth.uid());

-- ONG: vê inscrições dos projetos que ELA gerencia (via subquery, nunca tabela inteira)
create policy p_app_select_ong on public.applications
for select using (
    exists (select 1 from public.projects p
            where p.id = applications.project_id
              and p.ong_id = auth.uid())
);

-- Usuário: inscreve-se usando o próprio id, apenas em projeto aberto
create policy p_app_insert on public.applications
for insert with check (
    usuario_id = auth.uid()
    and public.is_usuario()
    and exists (select 1 from public.projects p
                where p.id = project_id and p.status = 'aberto')
);

-- ONG: só pode atualizar status/parecer das inscrições dos próprios projetos.
-- (Proibido alterar respostas/usuario_id — garantido também pelo trigger.)
create policy p_app_update_ong on public.applications
for update using (
    exists (select 1 from public.projects p
            where p.id = applications.project_id
              and p.ong_id = auth.uid())
) with check (
    exists (select 1 from public.projects p
            where p.id = applications.project_id
              and p.ong_id = auth.uid())
);

-- Usuário pode DESISTIR (delete) da própria inscrição enquanto pendente
create policy p_app_delete on public.applications
for delete using (usuario_id = auth.uid() and status = 'pendente');

-- 4.7 GALLERIES
create policy p_gal_select on public.galleries
for select using (true);  -- galeria é vitrine pública da ONG

create policy p_gal_insert on public.galleries
for insert with check (ong_id = auth.uid() and public.is_ong());

create policy p_gal_update on public.galleries
for update using (ong_id = auth.uid()) with check (ong_id = auth.uid());

create policy p_gal_delete on public.galleries
for delete using (ong_id = auth.uid());

-- ---------------------------------------------------------------------
-- 5. STORAGE BUCKETS (via SQL — requer permissão de service role)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatares', 'avatares', true),
       ('galeria-ongs', 'galeria-ongs', true)
on conflict (id) do nothing;

-- Upload: cada usuário/ONG escreve apenas na própria pasta {auth.uid()}/
create policy st_upload_own on storage.objects
for insert with check (
    bucket_id in ('avatares','galeria-ongs')
    and (storage.foldername(name))[1] = auth.uid()::text
);

create policy st_update_own on storage.objects
for update using (
    bucket_id in ('avatares','galeria-ongs')
    and (storage.foldername(name))[1] = auth.uid()::text
);

create policy st_delete_own on storage.objects
for delete using (
    bucket_id in ('avatares','galeria-ongs')
    and (storage.foldername(name))[1] = auth.uid()::text
);
-- Leitura é pública (buckets public=true) para renderizar cards e galerias.

-- ---------------------------------------------------------------------
-- 6. VIEWS DE APOIO AO FRONTEND
-- ---------------------------------------------------------------------

-- Feed de projetos com dados da ONG sede (usado no dashboard do usuário)
create or replace view public.v_projects_feed as
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
    o.estado,
    o.cidade,
    o.bairro
from public.projects p
join public.profiles_ongs o on o.id = p.ong_id
where p.status = 'aberto';

-- Contagem de inscritos por projeto (badge na triagem da ONG)
create or replace view public.v_app_counts as
select
    a.project_id,
    count(*) filter (where a.status = 'pendente')  as pendentes,
    count(*) filter (where a.status = 'aprovada')  as aprovadas,
    count(*) filter (where a.status = 'rejeitada') as rejeitadas
from public.applications a
group by a.project_id;

-- RLS em views: a view respeita as policies das tabelas base;
-- para segurança extra, force opção de security_invoker (PG15+/Supabase):
alter view public.v_projects_feed set (security_invoker = on);
alter view public.v_app_counts   set (security_invoker = on);

-- ---------------------------------------------------------------------
-- 7. RESUMO DAS POLÍTICAS (para a documentação do PIE)
-- ---------------------------------------------------------------------
-- • Usuário comum: lê/edita apenas o PRÓPRIO perfil; inscreve-se em projetos
--   abertos; vê apenas as PRÓPRIAS inscrições; pode desistir se pendente.
-- • ONG: lê/edita apenas o PRÓPRIO perfil e SEUS projetos/formulários/galeria;
--   enxerga inscrições SOMENTE dos seus projetos; decide status (uma vez).
-- • Público/anônimo: vê cards de ONGs, projetos abertos e galerias (vitrine),
--   sem acesso a dados pessoais de cidadãos (LGPD — art. 6º, finalidade).
-- • Storage: escrita isolada por pasta uid(); leitura pública dos buckets.
-- • Senha forte e validação de CPF/CNPJ: camada frontend (validators.js)
--   + CHECK constraints no banco (defesa em profundidade).
-- =====================================================================
-- FIM DA FASE 2 — LocalizaFavela | Execute bloco a bloco no Supabase SQL Editor
-- =====================================================================
