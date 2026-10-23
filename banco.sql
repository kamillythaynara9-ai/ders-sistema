-- =====================================================================
-- DERS · Sistema interno (pedidos, reuniões, aprovação, produção)
-- Cole este arquivo inteiro no Supabase: SQL Editor > New query > Run.
-- Pode rodar de novo sem problema (ele recria as funções e mantém os dados).
-- =====================================================================

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------- Configuração ----------
create table if not exists public.config (
  chave text primary key,
  valor jsonb not null
);

-- Agenda: dias da semana (0 = domingo) com [abre, fecha] em horas cheias.
-- Reuniões de 1 hora; a última começa 1 hora antes de fechar.
insert into public.config (chave, valor) values
  ('agenda', '{"fuso":"America/Sao_Paulo","antecedencia_horas":2,"duracao_min":60,"dias_a_frente":21,
               "semana":{"0":[10,17],"1":[8,22],"2":[8,22],"3":[8,22],"4":[8,22],"5":[8,22],"6":[10,17]}}')
on conflict (chave) do nothing;

-- Quem pode entrar no sistema (e-mail interno do login).
create table if not exists public.admins (
  email text primary key
);
insert into public.admins (email) values ('ders2026@ders.com.br') on conflict do nothing;

-- ---------- Tabelas ----------
create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),
  codigo text unique not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  status text not null default 'novo' check (status in (
    'novo',            -- chegou pelo formulário
    'remarcar',        -- horário precisa de outra proposta
    'aguardando_cliente', -- proposta de horário enviada ao cliente
    'reuniao_ok',      -- horário confirmado, falta aprovar a produção
    'em_criacao',      -- aprovado com repositório: Claude cria site + vídeo
    'para_revisar',    -- site + vídeo prontos para a Thaynara revisar
    'ajuste',          -- ela pediu ajuste: volta para o Claude
    'enviado',         -- cliente recebeu protótipo + vídeo
    'fechado',         -- virou cliente
    'perdido',         -- não fechou
    'recusado'         -- pedido recusado
  )),
  nome text not null,
  whatsapp text not null,
  email text,
  empresa text not null,
  segmento text,
  cidade text,
  tipo_site text,
  objetivo text,
  respostas jsonb not null default '{}'::jsonb,
  logo_path text,
  repositorio text,
  link_prototipo text,
  link_video text,
  ajuste text,
  notas text
);

create table if not exists public.reunioes (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  inicio timestamptz not null,
  fim timestamptz not null,
  status text not null default 'pendente' check (status in ('pendente','proposta','aprovada','recusada','cancelada')),
  criado_por text not null default 'cliente' check (criado_por in ('cliente','ders')),
  token uuid not null default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  respondido_em timestamptz,
  tipo text not null default 'prototipo' check (tipo in ('prototipo','acompanhamento','entrega')),
  titulo text,
  -- Duas reuniões confirmadas nunca se sobrepõem (qualquer tipo).
  constraint reunioes_sem_sobrepor exclude using gist (tstzrange(inicio, fim) with &&) where (status = 'aprovada')
);
create index if not exists reunioes_pedido on public.reunioes (pedido_id);
create unique index if not exists reunioes_token on public.reunioes (token);

create table if not exists public.historico (
  id bigserial primary key,
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  quando timestamptz not null default now(),
  evento text not null,
  detalhe text
);
create index if not exists historico_pedido on public.historico (pedido_id, quando desc);

-- Agenda da Thaynara: períodos em que ela não pode atender (some do formulário).
-- "serie" junta os bloqueios criados juntos com "repetir toda semana".
create table if not exists public.bloqueios (
  id uuid primary key default gen_random_uuid(),
  inicio timestamptz not null,
  fim timestamptz not null check (fim > inicio),
  titulo text not null default 'Indisponível',
  tipo text not null default 'indisponivel' check (tipo in ('indisponivel','compromisso')),
  serie uuid,
  criado_em timestamptz not null default now()
);
create index if not exists bloqueios_periodo on public.bloqueios (inicio, fim);

create or replace function public.tocar_atualizado() returns trigger language plpgsql as $$
begin new.atualizado_em := now(); return new; end $$;
drop trigger if exists pedidos_atualizado on public.pedidos;
create trigger pedidos_atualizado before update on public.pedidos
  for each row execute function public.tocar_atualizado();

-- ---------- Segurança (RLS) ----------
create or replace function public.e_admin() returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.admins where email = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;

alter table public.config   enable row level security;
alter table public.admins   enable row level security;
alter table public.pedidos  enable row level security;
alter table public.reunioes enable row level security;
alter table public.historico enable row level security;
alter table public.bloqueios enable row level security;

drop policy if exists admin_tudo on public.config;
drop policy if exists admin_tudo on public.pedidos;
drop policy if exists admin_tudo on public.reunioes;
drop policy if exists admin_tudo on public.historico;
drop policy if exists admin_tudo on public.bloqueios;
drop policy if exists admin_ler on public.admins;
create policy admin_tudo on public.config    for all to authenticated using (public.e_admin()) with check (public.e_admin());
create policy admin_tudo on public.pedidos   for all to authenticated using (public.e_admin()) with check (public.e_admin());
create policy admin_tudo on public.reunioes  for all to authenticated using (public.e_admin()) with check (public.e_admin());
create policy admin_tudo on public.historico for all to authenticated using (public.e_admin()) with check (public.e_admin());
create policy admin_tudo on public.bloqueios for all to authenticated using (public.e_admin()) with check (public.e_admin());
create policy admin_ler  on public.admins    for select to authenticated using (public.e_admin());

-- Visitantes (anon) não leem nem gravam tabelas: só usam as funções abaixo.
revoke all on public.config, public.admins, public.pedidos, public.reunioes, public.historico, public.bloqueios from anon;
revoke all on sequence public.historico_id_seq from anon;

-- ---------- Agenda ----------
-- Todos os horários de início dentro do expediente, a partir de agora + antecedência,
-- tirando os que batem com um bloqueio da agenda.
create or replace function public.agenda_slots() returns setof timestamptz
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  cfg jsonb := (select valor from public.config where chave = 'agenda');
  fuso text := cfg ->> 'fuso';
  minimo timestamptz := now() + make_interval(hours => (cfg ->> 'antecedencia_horas')::int);
  dur int := (cfg ->> 'duracao_min')::int;
  hoje date := (now() at time zone fuso)::date;
  d date; faixa jsonb; h int; t timestamptz;
begin
  for i in 0 .. (cfg ->> 'dias_a_frente')::int loop
    d := hoje + i;
    faixa := cfg -> 'semana' -> extract(dow from d)::int::text;
    continue when faixa is null;
    h := (faixa ->> 0)::int;
    while h * 60 + dur <= (faixa ->> 1)::int * 60 loop
      t := (d + make_time(h, 0, 0)) at time zone fuso;
      if t >= minimo and not exists (
        select 1 from public.bloqueios b where b.inicio < t + make_interval(mins => dur) and b.fim > t
      ) then return next t; end if;
      h := h + 1;
    end loop;
  end loop;
end $$;

-- O período está livre? (sem reunião confirmada ou proposta e sem bloqueio). p_ignorar = reunião que está sendo aprovada.
create or replace function public.periodo_livre(p_inicio timestamptz, p_fim timestamptz, p_ignorar uuid default null)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select not exists (select 1 from public.reunioes r where r.status in ('aprovada','proposta') and r.id is distinct from p_ignorar
                     and r.inicio < p_fim and r.fim > p_inicio)
     and not exists (select 1 from public.bloqueios b where b.inicio < p_fim and b.fim > p_inicio);
$$;

-- Para o formulário: horários livres e "sujeito a confirmação" (já pedidos, ainda não aprovados).
-- Horários que encostam em qualquer reunião confirmada ou proposta (de qualquer tipo) não aparecem.
create or replace function public.horarios_disponiveis()
returns table (inicio timestamptz, estado text)
language sql stable security definer set search_path = public, extensions as $$
  with c as (select make_interval(mins => (valor ->> 'duracao_min')::int) as dur from public.config where chave = 'agenda')
  select s, case when exists (select 1 from public.reunioes r where r.status = 'pendente' and r.inicio < s + c.dur and r.fim > s)
                 then 'sujeito' else 'livre' end
  from public.agenda_slots() s, c
  where public.periodo_livre(s, s + c.dur)
  order by s;
$$;

-- ---------- Formulário: criar pedido ----------
create or replace function public.criar_pedido(dados jsonb, inicio timestamptz)
returns text
language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  cfg jsonb := (select valor from public.config where chave = 'agenda');
  v_codigo text; v_id uuid;
  v_nome text := left(trim(coalesce(dados ->> 'nome', '')), 120);
  v_whats text := left(regexp_replace(coalesce(dados ->> 'whatsapp', ''), '\D', '', 'g'), 15);
  v_empresa text := left(trim(coalesce(dados ->> 'empresa', '')), 160);
begin
  if coalesce(dados ->> 'armadilha', '') <> '' then raise exception 'spam'; end if;
  if v_nome = '' or v_empresa = '' or length(v_whats) < 10 then raise exception 'dados_incompletos'; end if;
  if length(dados::text) > 30000 then raise exception 'muito_grande'; end if;
  -- limites contra abuso
  if (select count(*) from public.pedidos where criado_em > now() - interval '1 minute') >= 10 then raise exception 'tente_mais_tarde'; end if;
  if (select count(*) from public.pedidos p where p.whatsapp = v_whats and p.criado_em > now() - interval '10 minutes') >= 2 then raise exception 'pedido_repetido'; end if;
  -- o horário precisa ser válido e não estar tomado
  if inicio is not null then
    if not exists (select 1 from public.agenda_slots() s where s = inicio) then raise exception 'horario_invalido'; end if;
    if not public.periodo_livre(criar_pedido.inicio, criar_pedido.inicio + make_interval(mins => (cfg ->> 'duracao_min')::int)) then raise exception 'horario_ocupado'; end if;
  end if;

  loop
    v_codigo := 'D' || to_char(now() at time zone (cfg ->> 'fuso'), 'YYMMDD') || '-' || upper(substr(encode(gen_random_bytes(3), 'hex'), 1, 4));
    exit when not exists (select 1 from public.pedidos where codigo = v_codigo);
  end loop;

  insert into public.pedidos (codigo, nome, whatsapp, email, empresa, segmento, cidade, tipo_site, objetivo, respostas, logo_path)
  values (v_codigo, v_nome, v_whats, left(dados ->> 'email', 160), v_empresa, left(dados ->> 'segmento', 120),
          left(concat_ws(' / ', dados ->> 'cidade', dados ->> 'uf'), 120), left(dados ->> 'tipoSite', 120),
          left(dados ->> 'objetivo', 200), dados - 'logo' - 'armadilha',
          case when (dados ->> 'logo_path') ~ '^[a-z0-9-]{36}\.(png|jpg|jpeg|webp|svg)$' then dados ->> 'logo_path' end)
  returning id into v_id;

  if inicio is not null then
    insert into public.reunioes (pedido_id, inicio, fim, status, criado_por)
    values (v_id, inicio, inicio + make_interval(mins => (cfg ->> 'duracao_min')::int), 'pendente', 'cliente');
  end if;
  insert into public.historico (pedido_id, evento, detalhe) values (v_id, 'Pedido recebido pelo formulário', null);
  return v_codigo;
end $$;

-- ---------- Proposta de novo horário (link que o cliente recebe) ----------
create or replace function public.ver_proposta(p_token uuid)
returns table (empresa text, nome text, inicio timestamptz, status text)
language sql stable security definer set search_path = public, extensions as $$
  select p.empresa, split_part(p.nome, ' ', 1), r.inicio, r.status
  from public.reunioes r join public.pedidos p on p.id = r.pedido_id
  where r.token = p_token and r.criado_por = 'ders';
$$;

create or replace function public.responder_proposta(p_token uuid, aceita boolean)
returns text
language plpgsql volatile security definer set search_path = public, extensions as $$
declare r public.reunioes;
begin
  select * into r from public.reunioes where token = p_token and criado_por = 'ders' for update;
  if not found then raise exception 'nao_encontrada'; end if;
  if r.status <> 'proposta' then return r.status; end if;
  if aceita then
    -- a reunião de protótipo antiga (se havia) dá lugar à nova
    if r.tipo = 'prototipo' then
      update public.reunioes set status = 'cancelada' where pedido_id = r.pedido_id and id <> r.id and tipo = 'prototipo' and status = 'aprovada';
    end if;
    begin
      update public.reunioes set status = 'aprovada', respondido_em = now() where id = r.id;
    exception when unique_violation or exclusion_violation then
      update public.reunioes set status = 'cancelada', respondido_em = now() where id = r.id;
      update public.pedidos set status = 'remarcar' where id = r.pedido_id;
      insert into public.historico (pedido_id, evento) values (r.pedido_id, 'Cliente aceitou, mas o horário já tinha sido ocupado');
      return 'ocupado';
    end;
    -- outras reuniões do mesmo pedido deixam de valer
    update public.reunioes set status = 'cancelada' where pedido_id = r.pedido_id and id <> r.id and tipo = r.tipo and status in ('pendente','proposta');
    update public.pedidos set status = 'reuniao_ok' where id = r.pedido_id and status in ('novo','remarcar','aguardando_cliente');
    insert into public.historico (pedido_id, evento, detalhe) values (r.pedido_id, 'Cliente aceitou o novo horário', null);
    return 'aprovada';
  else
    update public.reunioes set status = 'recusada', respondido_em = now() where id = r.id;
    update public.pedidos set status = 'remarcar' where id = r.pedido_id and status = 'aguardando_cliente';
    insert into public.historico (pedido_id, evento) values (r.pedido_id, 'Cliente pediu outro horário');
    return 'recusada';
  end if;
end $$;

-- ---------- Ações do sistema (só para quem fez login como admin) ----------
create or replace function public.aprovar_reuniao(p_reuniao uuid)
returns void language plpgsql volatile security invoker set search_path = public, extensions as $$
declare r public.reunioes;
begin
  if not public.e_admin() then raise exception 'sem_permissao'; end if;
  select * into r from public.reunioes where id = p_reuniao for update;
  if r.tipo = 'prototipo' then
    update public.reunioes set status = 'cancelada' where pedido_id = r.pedido_id and id <> r.id and tipo = 'prototipo' and status = 'aprovada';
  end if;
  if not public.periodo_livre(r.inicio, r.fim, r.id) then raise exception 'horario_ocupado'; end if;
  update public.reunioes set status = 'aprovada', respondido_em = now() where id = r.id;
  update public.reunioes set status = 'cancelada' where pedido_id = r.pedido_id and id <> r.id and tipo = r.tipo and status in ('pendente','proposta');
  if r.tipo = 'prototipo' then
    update public.pedidos set status = 'reuniao_ok' where id = r.pedido_id and status in ('novo','remarcar','aguardando_cliente');
  end if;
  insert into public.historico (pedido_id, evento, detalhe) values (r.pedido_id, 'Horário da reunião aprovado', null);
end $$;

create or replace function public.propor_horario(p_pedido uuid, p_inicio timestamptz)
returns uuid language plpgsql volatile security invoker set search_path = public, extensions as $$
declare cfg jsonb := (select valor from public.config where chave = 'agenda'); v_token uuid;
begin
  if not public.e_admin() then raise exception 'sem_permissao'; end if;
  if exists (select 1 from public.bloqueios b where b.inicio < p_inicio + make_interval(mins => (cfg ->> 'duracao_min')::int) and b.fim > p_inicio) then raise exception 'horario_bloqueado'; end if;
  update public.reunioes set status = 'cancelada' where pedido_id = p_pedido and tipo = 'prototipo' and status in ('pendente','proposta');
  if not public.periodo_livre(p_inicio, p_inicio + make_interval(mins => (cfg ->> 'duracao_min')::int)) then raise exception 'horario_ocupado'; end if;
  insert into public.reunioes (pedido_id, inicio, fim, status, criado_por)
  values (p_pedido, p_inicio, p_inicio + make_interval(mins => (cfg ->> 'duracao_min')::int), 'proposta', 'ders')
  returning token into v_token;
  update public.pedidos set status = 'aguardando_cliente' where id = p_pedido;
  insert into public.historico (pedido_id, evento) values (p_pedido, 'Novo horário proposto ao cliente');
  return v_token;
end $$;

-- Cliente aceitou por mensagem (fora do link): ela marca direto no sistema.
create or replace function public.confirmar_proposta(p_pedido uuid)
returns void language plpgsql volatile security invoker set search_path = public, extensions as $$
declare v_id uuid;
begin
  if not public.e_admin() then raise exception 'sem_permissao'; end if;
  select id into v_id from public.reunioes where pedido_id = p_pedido and status = 'proposta' order by criado_em desc limit 1;
  if v_id is null then raise exception 'sem_proposta'; end if;
  perform public.aprovar_reuniao(v_id);
end $$;

-- Reunião marcada direto pela Thaynara (acompanhamento do site, entrega no 7º dia...). Já entra confirmada.
create or replace function public.marcar_reuniao(p_pedido uuid, p_inicio timestamptz, p_minutos int, p_tipo text, p_titulo text default null)
returns uuid language plpgsql volatile security invoker set search_path = public, extensions as $$
declare v_id uuid; v_fim timestamptz := p_inicio + make_interval(mins => greatest(15, least(coalesce(p_minutos, 60), 480)));
begin
  if not public.e_admin() then raise exception 'sem_permissao'; end if;
  if p_tipo not in ('prototipo','acompanhamento','entrega') then raise exception 'tipo_invalido'; end if;
  if exists (select 1 from public.bloqueios b where b.inicio < v_fim and b.fim > p_inicio) then raise exception 'horario_bloqueado'; end if;
  if not public.periodo_livre(p_inicio, v_fim) then raise exception 'horario_ocupado'; end if;
  insert into public.reunioes (pedido_id, inicio, fim, status, criado_por, tipo, titulo, respondido_em)
  values (p_pedido, p_inicio, v_fim, 'aprovada', 'ders', p_tipo, nullif(left(trim(coalesce(p_titulo, '')), 120), ''), now())
  returning id into v_id;
  insert into public.historico (pedido_id, evento, detalhe)
  values (p_pedido, 'Reunião marcada', to_char(p_inicio at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI') || coalesce(' · ' || nullif(trim(p_titulo), ''), ''));
  return v_id;
end $$;

-- ---------- Robô de produção (Claude) ----------
-- A chave fica guardada só como hash. Para trocar: select public.definir_chave_robo('nova-chave');
create or replace function public.definir_chave_robo(p_chave text)
returns void language plpgsql volatile security invoker set search_path = public, extensions as $$
begin
  if not public.e_admin() then raise exception 'sem_permissao'; end if;
  insert into public.config (chave, valor) values ('robo', jsonb_build_object('hash', crypt(p_chave, gen_salt('bf'))))
  on conflict (chave) do update set valor = excluded.valor;
end $$;

create or replace function public.robo_ok(p_chave text) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select coalesce((select (valor ->> 'hash') = crypt(p_chave, valor ->> 'hash') from public.config where chave = 'robo'), false);
$$;

create or replace function public.robo_fila(p_chave text)
returns setof public.pedidos
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not public.robo_ok(p_chave) then raise exception 'sem_permissao'; end if;
  return query select * from public.pedidos where status in ('em_criacao','ajuste') order by atualizado_em;
end $$;

create or replace function public.robo_entregar(p_chave text, p_pedido uuid, p_prototipo text, p_video text, p_notas text)
returns void
language plpgsql volatile security definer set search_path = public, extensions as $$
begin
  if not public.robo_ok(p_chave) then raise exception 'sem_permissao'; end if;
  update public.pedidos set status = 'para_revisar', link_prototipo = p_prototipo, link_video = p_video,
         notas = coalesce(p_notas, notas), ajuste = null
  where id = p_pedido and status in ('em_criacao','ajuste');
  if found then
    insert into public.historico (pedido_id, evento, detalhe) values (p_pedido, 'Site e vídeo prontos para revisar', p_notas);
  end if;
end $$;

-- ---------- Permissões das funções ----------
revoke execute on all functions in schema public from public, anon;
grant execute on function public.horarios_disponiveis() to anon, authenticated;
grant execute on function public.criar_pedido(jsonb, timestamptz) to anon, authenticated;
grant execute on function public.ver_proposta(uuid) to anon, authenticated;
grant execute on function public.responder_proposta(uuid, boolean) to anon, authenticated;
grant execute on function public.robo_fila(text) to anon, authenticated;
grant execute on function public.robo_entregar(text, uuid, text, text, text) to anon, authenticated;
grant execute on function public.e_admin() to authenticated;
grant execute on function public.agenda_slots() to authenticated;
grant execute on function public.aprovar_reuniao(uuid) to authenticated;
grant execute on function public.propor_horario(uuid, timestamptz) to authenticated;
grant execute on function public.confirmar_proposta(uuid) to authenticated;
grant execute on function public.periodo_livre(timestamptz, timestamptz, uuid) to authenticated;
grant execute on function public.marcar_reuniao(uuid, timestamptz, int, text, text) to authenticated;
grant execute on function public.definir_chave_robo(text) to authenticated;
grant execute on function public.tocar_atualizado() to authenticated;

-- ---------- Atualização ao vivo no sistema ----------
do $$ begin
  alter publication supabase_realtime add table public.pedidos, public.reunioes;
exception when duplicate_object or undefined_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.bloqueios;
exception when duplicate_object or undefined_object then null;
end $$;

-- ---------- Aviso instantâneo para o Claude ----------
-- Quando um pedido vai para criação (ou recebe ajuste), o banco comenta no pull request
-- de avisos do GitHub (só o código do pedido). O Claude acompanha esse pull request e começa na hora.
-- O token do GitHub fica só aqui no banco: select public.definir_aviso_github('token', 'dono/repo', numero_do_pr);
create extension if not exists pg_net;

create or replace function public.avisar_claude() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare cfg jsonb := (select valor from public.config where chave = 'aviso_github');
begin
  if cfg is null or new.status is not distinct from old.status or new.status not in ('em_criacao', 'ajuste') then return new; end if;
  perform net.http_post(
    url := 'https://api.github.com/repos/' || (cfg ->> 'repo') || '/issues/' || (cfg ->> 'pr') || '/comments',
    body := jsonb_build_object('body', 'Pedido ' || new.codigo ||
      case when new.status = 'ajuste' then ' recebeu ajuste.' else ' aprovado para criação.' end || ' (aviso automático do Sistema DERS)'),
    headers := jsonb_build_object('Authorization', 'Bearer ' || (cfg ->> 'token'), 'Accept', 'application/vnd.github+json',
      'User-Agent', 'ders-sistema', 'Content-Type', 'application/json'));
  return new;
exception when others then
  return new; -- o aviso nunca trava a aprovação; a rotina de hora em hora pega o pedido do mesmo jeito
end $$;

drop trigger if exists pedidos_avisar on public.pedidos;
create trigger pedidos_avisar after update of status on public.pedidos
  for each row execute function public.avisar_claude();

create or replace function public.definir_aviso_github(p_token text, p_repo text, p_pr int)
returns void language plpgsql volatile security invoker set search_path = public, extensions as $$
begin
  if not public.e_admin() and current_user not in ('postgres', 'supabase_admin') then raise exception 'sem_permissao'; end if;
  if p_token !~ '^(github_pat_|ghp_)[A-Za-z0-9_]{20,}$' then raise exception 'token_invalido: cole o token do GitHub (começa com github_pat_)'; end if;
  insert into public.config (chave, valor) values ('aviso_github', jsonb_build_object('token', p_token, 'repo', p_repo, 'pr', p_pr))
  on conflict (chave) do update set valor = excluded.valor;
end $$;
revoke execute on function public.avisar_claude() from public, anon, authenticated;
revoke execute on function public.definir_aviso_github(text, text, int) from public, anon;
grant execute on function public.definir_aviso_github(text, text, int) to authenticated;

-- ---------- Logos enviadas pelo formulário ----------
-- Pasta pública de leitura (logo é material público da marca), com nome aleatório.
-- Visitantes só podem ENVIAR imagens de até 5 MB; não listam, não trocam, não apagam.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 5242880, array['image/png','image/jpeg','image/webp','image/svg+xml'])
on conflict (id) do update set public = true, file_size_limit = 5242880,
  allowed_mime_types = array['image/png','image/jpeg','image/webp','image/svg+xml'];

drop policy if exists logos_enviar on storage.objects;
create policy logos_enviar on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'logos' and name ~ '^[a-z0-9-]{36}\.(png|jpg|jpeg|webp|svg)$');
