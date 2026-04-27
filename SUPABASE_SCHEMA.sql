-- ============================================================
-- SGA Acolhimento — Schema Supabase
-- Execute no SQL Editor do Supabase (em ordem)
-- ============================================================

-- ── 1. Tabela de usuários (complementa o Supabase Auth) ──
create table if not exists public.usuarios (
  id       bigserial primary key,
  auth_id  uuid references auth.users(id) on delete cascade,
  nome     text not null,
  login    text not null unique,
  perfil   text not null default 'atendente' check (perfil in ('coordenador','atendente'))
);

-- ── 2. Guichês ──
create table if not exists public.guiches (
  id          int primary key,
  nome        text not null default 'Guichê',
  atendente   text,
  senha_atual text,
  preferencial boolean default false,
  ativo       boolean default false
);

-- Insere os 6 guichês
insert into public.guiches (id, nome) values
  (1,'Guichê 1'),(2,'Guichê 2'),(3,'Guichê 3'),
  (4,'Guichê 4'),(5,'Guichê 5'),(6,'Guichê 6')
on conflict (id) do nothing;

-- ── 3. Fila de senhas ──
create table if not exists public.fila (
  id          bigserial primary key,
  num         text not null,
  tipo_label  text not null,
  preferencial boolean default false,
  criado_em   timestamptz default now()
);

-- ── 4. Tipos de senha ──
create table if not exists public.tipos_senha (
  id          bigserial primary key,
  label       text not null,
  prefixo     text default '',
  preferencial boolean default false,
  ativo       boolean default true
);

insert into public.tipos_senha (label, prefixo, preferencial, ativo) values
  ('Normal',       '',  false, true),
  ('Preferencial', 'P', true,  true)
on conflict do nothing;

-- ── 5. Configuração / Contadores ──
create table if not exists public.config (
  id                    int primary key default 1,
  contador_normal       int default 0,
  contador_pref         int default 0,
  contador_base_normal  int default 0,
  contador_base_pref    int default 0
);

insert into public.config (id) values (1) on conflict (id) do nothing;

-- ── 6. Relatório de atendimentos ──
create table if not exists public.relatorio (
  id          bigserial primary key,
  num         text not null,
  guiche_id   int,
  nome_guiche text,
  atendente   text,
  preferencial boolean default false,
  hora        text,
  data        text,
  criado_em   timestamptz default now()
);

-- ── 7. Tabela de eventos Realtime ──
-- Usada para broadcast em tempo real (substitui Socket.IO)
create table if not exists public.eventos (
  id        bigserial primary key,
  tipo      text not null,
  payload   text default '{}',
  criado_em timestamptz default now()
);

-- Limpeza automática de eventos antigos (> 1 hora)
create or replace function public.limpar_eventos_antigos()
returns void language sql as $$
  delete from public.eventos where criado_em < now() - interval '1 hour';
$$;

-- ── 8. RPC: incrementar contador atomicamente ──
-- Evita race condition quando múltiplos usuários emitem senha ao mesmo tempo
create or replace function public.incrementar_contador(campo_nome text)
returns int language plpgsql as $$
declare
  novo_valor int;
begin
  if campo_nome = 'contador_normal' then
    update public.config set contador_normal = contador_normal + 1 where id = 1
    returning contador_normal into novo_valor;
  elsif campo_nome = 'contador_pref' then
    update public.config set contador_pref = contador_pref + 1 where id = 1
    returning contador_pref into novo_valor;
  end if;
  return novo_valor;
end;
$$;

-- ── 9. Row Level Security (RLS) ──
-- Habilita RLS em todas as tabelas
alter table public.usuarios     enable row level security;
alter table public.guiches      enable row level security;
alter table public.fila         enable row level security;
alter table public.tipos_senha  enable row level security;
alter table public.config       enable row level security;
alter table public.relatorio    enable row level security;
alter table public.eventos      enable row level security;

-- Políticas: service_role bypassa tudo (usado pelo backend)
-- Anon pode ler guiches, fila, tipos, config e eventos (para monitor e emissão)
create policy "anon_read_guiches"     on public.guiches     for select using (true);
create policy "anon_read_fila"        on public.fila        for select using (true);
create policy "anon_read_tipos"       on public.tipos_senha for select using (true);
create policy "anon_read_config"      on public.config      for select using (true);
create policy "anon_read_eventos"     on public.eventos     for select using (true);
create policy "anon_insert_fila"      on public.fila        for insert with check (true);

-- ── 10. Realtime: habilita a tabela eventos ──
-- No painel do Supabase: Database → Replication → enable "eventos"
-- OU execute:
alter publication supabase_realtime add table public.eventos;

-- ── 11. Criar o coordenador padrão ──
-- Execute APÓS criar a conta no Supabase Auth pelo painel
-- Substitua 'UUID_DO_USUARIO_AQUI' pelo ID gerado no Auth
/*
insert into public.usuarios (auth_id, nome, login, perfil)
values ('UUID_DO_USUARIO_AQUI', 'Coordenador', 'coordenador', 'coordenador');
*/
