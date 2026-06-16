-- ============================================================================
-- MIGRACIÓN: Funciones sociales (apodos, avatares, comentarios)
-- ============================================================================
-- Ejecuta este archivo en: Supabase Dashboard → SQL Editor → New Query
-- Es SEGURO correrlo en una base con usuarios existentes: solo AGREGA
-- columnas y tablas nuevas, no borra ni modifica nada de lo que ya existe.
-- ============================================================================

-- 1. APODO Y AVATAR en profiles
--    nickname: apodo opcional (si está vacío, se usa display_name)
--    avatar: un emoji que representa al jugador
alter table profiles add column if not exists nickname text;
alter table profiles add column if not exists avatar text default '⚽';

-- 2. COMENTARIOS / REACCIONES EN PARTIDOS
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

-- Todos los autenticados pueden leer los comentarios
drop policy if exists "mc_select_all" on match_comments;
create policy "mc_select_all" on match_comments
  for select using (auth.role() = 'authenticated');

-- Cada quien puede crear sus propios comentarios
drop policy if exists "mc_insert_self" on match_comments;
create policy "mc_insert_self" on match_comments
  for insert with check (user_id = auth.uid());

-- Cada quien puede borrar sus propios comentarios; los admin pueden borrar cualquiera
drop policy if exists "mc_delete_own_or_admin" on match_comments;
create policy "mc_delete_own_or_admin" on match_comments
  for delete using (
    user_id = auth.uid()
    or exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin)
  );

-- 3. REACCIONES (emoji) EN PARTIDOS
--    Cada usuario puede dejar UNA reacción por partido (puede cambiarla).
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

-- ============================================================================
-- LISTO. Estas son las novedades:
--   • profiles.nickname  -> apodo opcional
--   • profiles.avatar    -> emoji del jugador
--   • match_comments     -> comentarios por partido (con moderación admin)
--   • match_reactions    -> una reacción emoji por usuario por partido
-- ============================================================================
