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
