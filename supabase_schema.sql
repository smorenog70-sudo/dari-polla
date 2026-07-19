-- ============================================================================
-- Dari-polla · Schema para Supabase
-- ============================================================================
-- Ejecuta este archivo completo en: Supabase Dashboard → SQL Editor → New Query
-- ============================================================================

-- 1. PROFILES (vinculado a auth.users)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  nickname text,
  avatar text default '⚽',
  is_admin boolean not null default false,
  paid boolean not null default false,        -- admin marca cuando confirma los 50k COP
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

drop policy if exists "profiles_select_all" on profiles;
create policy "profiles_select_all" on profiles
  for select using (auth.role() = 'authenticated');

drop policy if exists "profiles_insert_self" on profiles;
create policy "profiles_insert_self" on profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_self" on profiles;
create policy "profiles_update_self" on profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id and is_admin = (select is_admin from profiles where id = auth.uid()));

drop policy if exists "profiles_admin_update" on profiles;
create policy "profiles_admin_update" on profiles
  for update using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin)
  );

-- 2. PRONÓSTICOS DE PARTIDOS
create table if not exists predictions (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  match_id text not null,             -- 'GA-F1-1', 'R32-73', 'FINAL', etc.
  score1 int not null check (score1 >= 0 and score1 <= 30),
  score2 int not null check (score2 >= 0 and score2 <= 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, match_id)
);

alter table predictions enable row level security;

drop policy if exists "predictions_select_all" on predictions;
create policy "predictions_select_all" on predictions
  for select using (auth.role() = 'authenticated');

drop policy if exists "predictions_insert_self" on predictions;
create policy "predictions_insert_self" on predictions
  for insert with check (user_id = auth.uid());

drop policy if exists "predictions_update_self" on predictions;
create policy "predictions_update_self" on predictions
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "predictions_delete_self" on predictions;
create policy "predictions_delete_self" on predictions
  for delete using (user_id = auth.uid());

-- 3. RESULTADOS REALES (los mete el admin)
create table if not exists results (
  match_id text primary key,
  score1 int not null check (score1 >= 0),
  score2 int not null check (score2 >= 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table results enable row level security;

drop policy if exists "results_select_all" on results;
create policy "results_select_all" on results
  for select using (auth.role() = 'authenticated');

drop policy if exists "results_admin_write" on results;
create policy "results_admin_write" on results
  for all using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));

-- 4. PRONÓSTICOS DE POSICIÓN EN GRUPO (1,2,3,4)
create table if not exists group_predictions (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  group_letter text not null,           -- 'A'..'L'
  team text not null,
  position int not null check (position between 1 and 4),
  created_at timestamptz not null default now(),
  unique (user_id, group_letter, team),
  unique (user_id, group_letter, position)
);

alter table group_predictions enable row level security;

drop policy if exists "gp_select_all" on group_predictions;
create policy "gp_select_all" on group_predictions
  for select using (auth.role() = 'authenticated');

drop policy if exists "gp_write_self" on group_predictions;
create policy "gp_write_self" on group_predictions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 5. POSICIONES REALES DE GRUPO (admin)
create table if not exists group_results (
  group_letter text not null,
  team text not null,
  position int not null check (position between 1 and 4),
  updated_at timestamptz not null default now(),
  primary key (group_letter, team)
);

alter table group_results enable row level security;

drop policy if exists "gr_select_all" on group_results;
create policy "gr_select_all" on group_results
  for select using (auth.role() = 'authenticated');

drop policy if exists "gr_admin_write" on group_results;
create policy "gr_admin_write" on group_results
  for all using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));

-- 6. PRONÓSTICOS DE MEJORES TERCEROS (8 equipos sin orden)
create table if not exists third_predictions (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  team text not null,
  created_at timestamptz not null default now(),
  unique (user_id, team)
);

alter table third_predictions enable row level security;

drop policy if exists "tp_select_all" on third_predictions;
create policy "tp_select_all" on third_predictions
  for select using (auth.role() = 'authenticated');

drop policy if exists "tp_write_self" on third_predictions;
create policy "tp_write_self" on third_predictions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 7. MEJORES TERCEROS REALES (admin)
create table if not exists third_results (
  team text primary key,
  updated_at timestamptz not null default now()
);

alter table third_results enable row level security;

drop policy if exists "tr_select_all" on third_results;
create policy "tr_select_all" on third_results
  for select using (auth.role() = 'authenticated');

drop policy if exists "tr_admin_write" on third_results;
create policy "tr_admin_write" on third_results
  for all using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));

-- 8. MULTAS (admin cierra fecha y se cargan automáticamente)
create table if not exists fines (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  fecha_id text not null,               -- 'group-F1', 'group-F2', 'group-F3', 'r32', 'r16', 'qf', 'sf', 'third', 'final'
  amount int not null default 5000,
  created_at timestamptz not null default now(),
  unique (user_id, fecha_id)
);

alter table fines enable row level security;

drop policy if exists "fines_select_all" on fines;
create policy "fines_select_all" on fines
  for select using (auth.role() = 'authenticated');

drop policy if exists "fines_admin_write" on fines;
create policy "fines_admin_write" on fines
  for all using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));

-- 9. ESTADO DE FECHAS CERRADAS (qué fechas/rondas ya fueron cerradas por admin)
create table if not exists closed_fechas (
  fecha_id text primary key,
  closed_at timestamptz not null default now(),
  closed_by uuid references auth.users(id)
);

alter table closed_fechas enable row level security;

drop policy if exists "cf_select_all" on closed_fechas;
create policy "cf_select_all" on closed_fechas
  for select using (auth.role() = 'authenticated');

drop policy if exists "cf_admin_write" on closed_fechas;
create policy "cf_admin_write" on closed_fechas
  for all using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));

-- 10. CONFIGURACIÓN (entry fee, multa, fases habilitadas)
create table if not exists config (
  key text primary key,
  value jsonb not null
);

alter table config enable row level security;

drop policy if exists "config_select_all" on config;
create policy "config_select_all" on config
  for select using (auth.role() = 'authenticated');

drop policy if exists "config_admin_write" on config;
create policy "config_admin_write" on config
  for all using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));

-- Valores por defecto
insert into config (key, value) values
  ('entry_fee', '50000'::jsonb),
  ('fine_amount', '5000'::jsonb),
  ('knockouts_enabled', 'false'::jsonb)
on conflict (key) do nothing;

-- COMENTARIOS EN PARTIDOS
create table if not exists match_comments (
  id bigserial primary key,
  match_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) <= 280),
  created_at timestamptz not null default now()
);
create index if not exists match_comments_match_idx on match_comments(match_id);
create index if not exists match_comments_created_idx on match_comments(created_at desc);
alter table match_comments enable row level security;

drop policy if exists "mc_select_all" on match_comments;
create policy "mc_select_all" on match_comments
  for select using (auth.role() = 'authenticated');

drop policy if exists "mc_insert_self" on match_comments;
create policy "mc_insert_self" on match_comments
  for insert with check (user_id = auth.uid());

drop policy if exists "mc_delete_own_or_admin" on match_comments;
create policy "mc_delete_own_or_admin" on match_comments
  for delete using (
    user_id = auth.uid()
    or exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin)
  );

-- REACCIONES EN PARTIDOS (una por usuario por partido)
create table if not exists match_reactions (
  match_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (match_id, user_id)
);
alter table match_reactions enable row level security;

drop policy if exists "mr_select_all" on match_reactions;
create policy "mr_select_all" on match_reactions
  for select using (auth.role() = 'authenticated');

drop policy if exists "mr_write_self" on match_reactions;
create policy "mr_write_self" on match_reactions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- TRIGGER: auto-crear profile cuando un user se registra
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================================
-- INSTRUCCIONES:
-- 1. Pega este archivo entero en SQL Editor y dale "Run"
-- 2. Crea tu cuenta normal en la app (signup)
-- 3. Vuelve aquí al SQL Editor y ejecuta para hacerte admin:
--      update profiles set is_admin = true, paid = true where display_name ilike '%dari%';
--    (cambia el filtro al tuyo). Repite para los otros admins.
-- ============================================================================
