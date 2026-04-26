-- Ejecuta este SQL en Supabase SQL Editor

create extension if not exists "uuid-ossp";

create table if not exists public.tasks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fecha date not null,
  nombre text not null,
  minutos integer not null check (minutos > 0),
  entregada boolean not null default false,
  entregada_at timestamptz,
  tipo text not null check (tipo in ('task', 'exam')) default 'task',
  created_at timestamptz not null default now()
);

create table if not exists public.exams (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nombre text not null,
  fecha_examen date not null,
  fecha_inicio date not null,
  minutos_diarios integer not null check (minutos_diarios > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  username text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tasks enable row level security;
alter table public.exams enable row level security;
alter table public.profiles enable row level security;

create policy "Users can view own tasks" on public.tasks
  for select using (auth.uid() = user_id);
create policy "Users can insert own tasks" on public.tasks
  for insert with check (auth.uid() = user_id);
create policy "Users can update own tasks" on public.tasks
  for update using (auth.uid() = user_id);
create policy "Users can delete own tasks" on public.tasks
  for delete using (auth.uid() = user_id);

create policy "Users can view own exams" on public.exams
  for select using (auth.uid() = user_id);
create policy "Users can insert own exams" on public.exams
  for insert with check (auth.uid() = user_id);
create policy "Users can update own exams" on public.exams
  for update using (auth.uid() = user_id);
create policy "Users can delete own exams" on public.exams
  for delete using (auth.uid() = user_id);

create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles
  for insert with check (auth.uid() = id);
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute procedure public.update_updated_at_column();

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.tasks where user_id = uid;
  delete from public.exams where user_id = uid;
  delete from public.profiles where id = uid;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
