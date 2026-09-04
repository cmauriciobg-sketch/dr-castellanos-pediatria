-- Residencia Pediátrica · Supabase Postgres
-- Ejecuta este archivo completo en Supabase: SQL Editor > New query.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name varchar(60) not null check (char_length(display_name) between 2 and 60),
  avatar text not null default '🩺',
  progress jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

grant select, insert, update on public.profiles to authenticated;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Users can create their own profile" on public.profiles;
create policy "Users can create their own profile"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Administración: una cuenta puede bloquear el acceso de otra sin borrar su historial.
alter table public.profiles
  add column if not exists role text not null default 'student'
    check (role in ('student', 'admin')),
  add column if not exists is_active boolean not null default true;

-- Los estudiantes solo pueden editar su contenido de estudio, nunca su rol o estado.
revoke update on public.profiles from authenticated;
grant update (display_name, avatar, progress) on public.profiles to authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_active = true
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create or replace function public.admin_list_users()
returns table (
  id uuid,
  email text,
  display_name text,
  role text,
  is_active boolean,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'No tienes permisos de administración.';
  end if;

  return query
    select p.id, u.email::text, p.display_name::text, p.role::text,
      p.is_active, p.created_at
    from public.profiles p
    left join auth.users u on u.id = p.id
    order by p.created_at desc;
end;
$$;

create or replace function public.admin_set_user_status(
  target_user_id uuid,
  next_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'No tienes permisos de administración.';
  end if;

  if target_user_id = auth.uid() and next_is_active = false then
    raise exception 'No puedes darte de baja a ti mismo.';
  end if;

  update public.profiles
    set is_active = next_is_active
    where id = target_user_id;

  if not found then
    raise exception 'Usuario no encontrado.';
  end if;
end;
$$;

revoke all on function public.admin_list_users() from public;
revoke all on function public.admin_set_user_status(uuid, boolean) from public;
grant execute on function public.admin_list_users() to authenticated;
grant execute on function public.admin_set_user_status(uuid, boolean) to authenticated;

-- Después de crear e iniciar sesión con tu cuenta, sustituye el correo y ejecuta:
-- update public.profiles set role = 'admin'
-- where id = (select id from auth.users where lower(email) = lower('tu-correo@ejemplo.com'));

-- Comunidad: ranking, chat y retos amistosos. Todas las acciones requieren cuenta activa.
create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_active = true
  );
$$;

revoke all on function public.is_active_user() from public;
grant execute on function public.is_active_user() to authenticated;

create or replace function public.get_leaderboard()
returns table (
  rank bigint,
  id uuid,
  display_name text,
  avatar text,
  xp integer,
  streak_current integer,
  streak_best integer,
  medals integer
)
language sql
stable
security definer
set search_path = public
as $$
  with scores as (
    select
      p.id,
      p.display_name::text,
      p.avatar::text,
      coalesce((p.progress->>'xp')::integer, 0) as xp,
      coalesce((p.progress->'streak'->>'current')::integer, 0) as streak_current,
      coalesce((p.progress->'streak'->>'best')::integer, 0) as streak_best,
      (
        case when coalesce((p.progress->'stats'->>'quizzes')::integer, 0) >= 1 then 1 else 0 end +
        case when coalesce((p.progress->'stats'->>'perfect')::integer, 0) >= 1 then 1 else 0 end +
        case when coalesce((p.progress->'stats'->>'perfectHigh')::integer, 0) >= 1 then 1 else 0 end +
        case when coalesce((p.progress->'streak'->>'current')::integer, 0) >= 7 then 1 else 0 end +
        case when coalesce((p.progress->'stats'->>'memory')::integer, 0) >= 1 then 1 else 0 end +
        case when coalesce((p.progress->'stats'->>'sprint')::integer, 0) >= 1 then 1 else 0 end
      )::integer as medals
    from public.profiles p
    where p.is_active = true
  )
  select row_number() over (order by s.xp desc, s.medals desc, s.streak_current desc, s.display_name),
    s.id, s.display_name, s.avatar, s.xp, s.streak_current, s.streak_best, s.medals
  from scores s
  order by s.xp desc, s.medals desc, s.streak_current desc, s.display_name;
$$;

revoke all on function public.get_leaderboard() from public;
grant execute on function public.get_leaderboard() to authenticated;

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  sender_name text not null,
  sender_avatar text not null default '🩺',
  body text not null check (char_length(trim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);

alter table public.chat_messages enable row level security;
grant select on public.chat_messages to authenticated;

drop policy if exists "Active users can read chat" on public.chat_messages;
create policy "Active users can read chat"
  on public.chat_messages for select to authenticated
  using (public.is_active_user());

create or replace function public.send_chat_message(p_body text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  message_id uuid;
  profile_row public.profiles;
begin
  if not public.is_active_user() then
    raise exception 'Tu cuenta no tiene acceso a la comunidad.';
  end if;
  if char_length(trim(coalesce(p_body, ''))) not between 1 and 500 then
    raise exception 'El mensaje debe tener entre 1 y 500 caracteres.';
  end if;
  select * into profile_row from public.profiles where id = auth.uid();
  insert into public.chat_messages(sender_id, sender_name, sender_avatar, body)
  values (auth.uid(), profile_row.display_name, profile_row.avatar, trim(p_body))
  returning id into message_id;
  return message_id;
end;
$$;

revoke all on function public.send_chat_message(text) from public;
grant execute on function public.send_chat_message(text) to authenticated;

create table if not exists public.duels (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references auth.users(id) on delete cascade,
  opponent_id uuid not null references auth.users(id) on delete cascade,
  topic text not null,
  level text not null check (level in ('bajo', 'medio', 'alto')),
  status text not null default 'pending' check (status in ('pending', 'active', 'completed', 'cancelled')),
  host_score integer check (host_score between 0 and 10),
  opponent_score integer check (opponent_score between 0 and 10),
  host_duration_ms integer check (host_duration_ms > 0),
  opponent_duration_ms integer check (opponent_duration_ms > 0),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  completed_at timestamptz,
  check (host_id <> opponent_id)
);

alter table public.duels enable row level security;
grant select on public.duels to authenticated;

drop policy if exists "Participants can read duels" on public.duels;
create policy "Participants can read duels"
  on public.duels for select to authenticated
  using (auth.uid() in (host_id, opponent_id));

create or replace function public.create_duel(p_opponent_id uuid, p_topic text, p_level text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare duel_id uuid;
begin
  if not public.is_active_user() then raise exception 'Tu cuenta no tiene acceso a los retos.'; end if;
  if p_opponent_id = auth.uid() then raise exception 'No puedes retarte a ti mismo.'; end if;
  if p_topic not in ('atresia_esofagica', 'atresia_intestinal', 'fisiologia_pulmonar', 'cardiopatias', 'adenopatias') then raise exception 'Tema no válido.'; end if;
  if p_level not in ('bajo', 'medio', 'alto') then raise exception 'Nivel no válido.'; end if;
  if not exists (select 1 from public.profiles where id = p_opponent_id and is_active) then raise exception 'La persona retada no está disponible.'; end if;
  insert into public.duels(host_id, opponent_id, topic, level)
  values (auth.uid(), p_opponent_id, p_topic, p_level)
  returning id into duel_id;
  return duel_id;
end;
$$;

create or replace function public.accept_duel(p_duel_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_active_user() then raise exception 'Tu cuenta no tiene acceso a los retos.'; end if;
  update public.duels set status = 'active', accepted_at = now()
  where id = p_duel_id and opponent_id = auth.uid() and status = 'pending';
  if not found then raise exception 'Ese reto ya no está disponible.'; end if;
end;
$$;

create or replace function public.submit_duel_result(p_duel_id uuid, p_score integer, p_duration_ms integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare duel_row public.duels;
begin
  if p_score not between 0 and 10 or p_duration_ms < 1000 then raise exception 'Resultado no válido.'; end if;
  select * into duel_row from public.duels where id = p_duel_id for update;
  if not found or duel_row.status <> 'active' or auth.uid() not in (duel_row.host_id, duel_row.opponent_id) then
    raise exception 'Ese reto no está disponible.';
  end if;
  if duel_row.host_id = auth.uid() then
    if duel_row.host_score is not null then raise exception 'Ya enviaste tu resultado.'; end if;
    update public.duels set host_score = p_score, host_duration_ms = p_duration_ms where id = p_duel_id;
  else
    if duel_row.opponent_score is not null then raise exception 'Ya enviaste tu resultado.'; end if;
    update public.duels set opponent_score = p_score, opponent_duration_ms = p_duration_ms where id = p_duel_id;
  end if;
  update public.duels set status = 'completed', completed_at = now()
  where id = p_duel_id and host_score is not null and opponent_score is not null;
end;
$$;

create or replace function public.my_duels()
returns table (
  id uuid, host_id uuid, opponent_id uuid, topic text, level text, status text,
  host_name text, opponent_name text, host_score integer, opponent_score integer,
  host_duration_ms integer, opponent_duration_ms integer, created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select d.id, d.host_id, d.opponent_id, d.topic, d.level, d.status,
    host.display_name::text, opponent.display_name::text, d.host_score, d.opponent_score,
    d.host_duration_ms, d.opponent_duration_ms, d.created_at
  from public.duels d
  join public.profiles host on host.id = d.host_id
  join public.profiles opponent on opponent.id = d.opponent_id
  where auth.uid() in (d.host_id, d.opponent_id)
  order by d.created_at desc
  limit 30;
$$;

revoke all on function public.create_duel(uuid, text, text) from public;
revoke all on function public.accept_duel(uuid) from public;
revoke all on function public.submit_duel_result(uuid, integer, integer) from public;
revoke all on function public.my_duels() from public;
grant execute on function public.create_duel(uuid, text, text) to authenticated;
grant execute on function public.accept_duel(uuid) to authenticated;
grant execute on function public.submit_duel_result(uuid, integer, integer) to authenticated;
grant execute on function public.my_duels() to authenticated;

-- Ferchy Cards: 20 cartas por tema, con 12 comunes, 6 normales y 2 raras doradas.
create table if not exists public.ferchy_cards (
  id text primary key,
  topic text not null,
  card_number integer not null check (card_number between 1 and 20),
  rarity text not null check (rarity in ('common', 'normal', 'rare')),
  title text not null,
  message text not null,
  emoji text not null,
  unique(topic, card_number)
);

insert into public.ferchy_cards(id, topic, card_number, rarity, title, message, emoji)
select topic || '-' || lpad(card_number::text, 2, '0'), topic, card_number,
  case when card_number <= 12 then 'common' when card_number <= 18 then 'normal' else 'rare' end,
  case when card_number <= 12 then 'Rabanitos anima' when card_number <= 18 then 'Kit pediátrico' else 'Edición oro' end,
  case when card_number <= 12 then 'Una pausa breve y volvemos a estudiar.' when card_number <= 18 then 'Una herramienta clínica para pensar mejor.' else 'Una pieza especial para tu colección.' end,
  case when card_number <= 12 then '🥕' when card_number <= 18 then '🩺' else '✨' end
from (values ('atresia_esofagica'), ('atresia_intestinal'), ('fisiologia_pulmonar'), ('cardiopatias'), ('adenopatias')) as topics(topic)
cross join generate_series(1, 20) as numbers(card_number)
on conflict (id) do nothing;

create table if not exists public.user_ferchy_cards (
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id text not null references public.ferchy_cards(id) on delete cascade,
  quantity integer not null default 0 check (quantity >= 0),
  updated_at timestamptz not null default now(),
  primary key(user_id, card_id)
);

alter table public.user_ferchy_cards enable row level security;
grant select on public.ferchy_cards to authenticated;

drop policy if exists "Users can read own Ferchy Cards" on public.user_ferchy_cards;
create policy "Users can read own Ferchy Cards"
  on public.user_ferchy_cards for select to authenticated
  using (auth.uid() = user_id);

create table if not exists public.ferchy_gifts (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  card_id text not null references public.ferchy_cards(id),
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id)
);

create table if not exists public.ferchy_trades (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  offered_card_id text not null references public.ferchy_cards(id),
  requested_card_id text not null references public.ferchy_cards(id),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'cancelled')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  check (sender_id <> recipient_id and offered_card_id <> requested_card_id)
);

alter table public.ferchy_gifts enable row level security;
alter table public.ferchy_trades enable row level security;

create or replace function public.my_ferchy_inventory()
returns table (id text, topic text, card_number integer, rarity text, quantity integer)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.topic, c.card_number, c.rarity, coalesce(u.quantity, 0)
  from public.ferchy_cards c
  left join public.user_ferchy_cards u on u.card_id = c.id and u.user_id = auth.uid()
  order by c.topic, c.card_number;
$$;

create or replace function public.award_ferchy_card(p_topic text, p_level text)
returns table (id text, topic text, card_number integer, rarity text, quantity integer)
language plpgsql
security definer
set search_path = public
as $$
declare selected_card public.ferchy_cards;
declare card_quantity integer;
declare selected_rarity text;
declare roll double precision;
begin
  if not public.is_active_user() then raise exception 'Inicia sesión para desbloquear Ferchy Cards.'; end if;
  if p_topic not in ('atresia_esofagica', 'atresia_intestinal', 'fisiologia_pulmonar', 'cardiopatias', 'adenopatias') then raise exception 'Tema no válido.'; end if;
  if p_level not in ('bajo', 'medio', 'alto') then raise exception 'Nivel no válido.'; end if;
  roll := random();
  selected_rarity := case
    when p_level = 'alto' and roll < 0.12 then 'rare'
    when (p_level = 'alto' and roll < 0.42) or (p_level <> 'alto' and roll < 0.28) then 'normal'
    else 'common'
  end;
  select * into selected_card from public.ferchy_cards
  where topic = p_topic and rarity = selected_rarity order by random() limit 1;
  insert into public.user_ferchy_cards(user_id, card_id, quantity, updated_at)
  values (auth.uid(), selected_card.id, 1, now())
  on conflict (user_id, card_id) do update set quantity = public.user_ferchy_cards.quantity + 1, updated_at = now()
  returning quantity into card_quantity;
  return query select selected_card.id, selected_card.topic, selected_card.card_number, selected_card.rarity, card_quantity;
end;
$$;

create or replace function public.send_ferchy_gift(p_card_id text, p_recipient_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_active_user() then raise exception 'Tu cuenta no tiene acceso a los regalos.'; end if;
  if p_recipient_id = auth.uid() then raise exception 'El regalo debe ser para otra persona.'; end if;
  if not exists (select 1 from public.profiles where id = p_recipient_id and is_active) then raise exception 'La persona destinataria no está disponible.'; end if;
  update public.user_ferchy_cards set quantity = quantity - 1, updated_at = now()
  where user_id = auth.uid() and card_id = p_card_id and quantity > 1;
  if not found then raise exception 'Solo puedes regalar una carta repetida.'; end if;
  insert into public.user_ferchy_cards(user_id, card_id, quantity, updated_at)
  values (p_recipient_id, p_card_id, 1, now())
  on conflict (user_id, card_id) do update set quantity = public.user_ferchy_cards.quantity + 1, updated_at = now();
  insert into public.ferchy_gifts(sender_id, recipient_id, card_id) values (auth.uid(), p_recipient_id, p_card_id);
end;
$$;

create or replace function public.offer_card_trade(p_recipient_id uuid, p_offered_card_id text, p_requested_card_id text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare trade_id uuid;
begin
  if not public.is_active_user() then raise exception 'Tu cuenta no tiene acceso a los intercambios.'; end if;
  if p_recipient_id = auth.uid() or p_offered_card_id = p_requested_card_id then raise exception 'Intercambio no válido.'; end if;
  if not exists (select 1 from public.user_ferchy_cards where user_id = auth.uid() and card_id = p_offered_card_id and quantity > 1) then
    raise exception 'Solo puedes ofrecer una carta repetida.';
  end if;
  insert into public.ferchy_trades(sender_id, recipient_id, offered_card_id, requested_card_id)
  values (auth.uid(), p_recipient_id, p_offered_card_id, p_requested_card_id)
  returning id into trade_id;
  return trade_id;
end;
$$;

create or replace function public.accept_card_trade(p_trade_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare trade_row public.ferchy_trades;
begin
  if not public.is_active_user() then raise exception 'Tu cuenta no tiene acceso a los intercambios.'; end if;
  select * into trade_row from public.ferchy_trades where id = p_trade_id for update;
  if not found or trade_row.recipient_id <> auth.uid() or trade_row.status <> 'pending' then raise exception 'Ese intercambio no está disponible.'; end if;
  update public.user_ferchy_cards set quantity = quantity - 1, updated_at = now()
  where user_id = trade_row.sender_id and card_id = trade_row.offered_card_id and quantity > 1;
  if not found then raise exception 'La carta ofrecida ya no está disponible.'; end if;
  update public.user_ferchy_cards set quantity = quantity - 1, updated_at = now()
  where user_id = auth.uid() and card_id = trade_row.requested_card_id and quantity > 1;
  if not found then raise exception 'Necesitas una copia repetida de la carta solicitada para aceptar.'; end if;
  insert into public.user_ferchy_cards(user_id, card_id, quantity, updated_at)
  values (auth.uid(), trade_row.offered_card_id, 1, now())
  on conflict (user_id, card_id) do update set quantity = public.user_ferchy_cards.quantity + 1, updated_at = now();
  insert into public.user_ferchy_cards(user_id, card_id, quantity, updated_at)
  values (trade_row.sender_id, trade_row.requested_card_id, 1, now())
  on conflict (user_id, card_id) do update set quantity = public.user_ferchy_cards.quantity + 1, updated_at = now();
  update public.ferchy_trades set status = 'accepted', accepted_at = now() where id = p_trade_id;
end;
$$;

create or replace function public.my_ferchy_gifts()
returns table (id uuid, sender_name text, card_title text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select g.id, p.display_name::text, c.title::text, g.created_at
  from public.ferchy_gifts g
  join public.profiles p on p.id = g.sender_id
  join public.ferchy_cards c on c.id = g.card_id
  where g.recipient_id = auth.uid()
  order by g.created_at desc
  limit 8;
$$;

create or replace function public.my_card_trades()
returns table (
  id uuid, sender_id uuid, recipient_id uuid, sender_name text, offered_title text,
  requested_title text, status text, created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.sender_id, t.recipient_id, p.display_name::text,
    offered.title::text, requested.title::text, t.status, t.created_at
  from public.ferchy_trades t
  join public.profiles p on p.id = t.sender_id
  join public.ferchy_cards offered on offered.id = t.offered_card_id
  join public.ferchy_cards requested on requested.id = t.requested_card_id
  where auth.uid() in (t.sender_id, t.recipient_id)
  order by t.created_at desc
  limit 20;
$$;

revoke all on function public.my_ferchy_inventory() from public;
revoke all on function public.award_ferchy_card(text, text) from public;
revoke all on function public.send_ferchy_gift(text, uuid) from public;
revoke all on function public.offer_card_trade(uuid, text, text) from public;
revoke all on function public.accept_card_trade(uuid) from public;
revoke all on function public.my_ferchy_gifts() from public;
revoke all on function public.my_card_trades() from public;
grant execute on function public.my_ferchy_inventory() to authenticated;
grant execute on function public.award_ferchy_card(text, text) to authenticated;
grant execute on function public.send_ferchy_gift(text, uuid) to authenticated;
grant execute on function public.offer_card_trade(uuid, text, text) to authenticated;
grant execute on function public.accept_card_trade(uuid) to authenticated;
grant execute on function public.my_ferchy_gifts() to authenticated;
grant execute on function public.my_card_trades() to authenticated;

-- Habilita actualizaciones en vivo para chat y retos. Seguro para ejecutar más de una vez.
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'duels'
  ) then
    alter publication supabase_realtime add table public.duels;
  end if;
end $$;
