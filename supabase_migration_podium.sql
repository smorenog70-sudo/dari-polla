-- ============================================================
-- MIGRACIÓN: Bono de podio (campeón / subcampeón / 3ro / 4to)
-- ============================================================
-- Cada usuario elige los 4 puestos del podio final del torneo. Gana puntos por
-- cada posición EXACTA que acierte (30/20/15/10). Una fila por usuario.
--
-- El podio real NO se guarda: se deriva de los resultados de la final y del
-- partido por el 3er puesto (ver src/lib/podium.js -> actualPodium).
--
-- Ejecutar una vez en el SQL editor de Supabase.

create table if not exists podium_predictions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  champion text,
  runner_up text,
  third_place text,
  fourth_place text,
  updated_at timestamptz not null default now()
);

alter table podium_predictions enable row level security;

-- Todos los autenticados pueden ver los pronósticos (para tablas y comparativas).
drop policy if exists "podium_select_all" on podium_predictions;
create policy "podium_select_all" on podium_predictions
  for select using (auth.role() = 'authenticated');

-- Cada quien solo escribe SU propia fila.
drop policy if exists "podium_insert_self" on podium_predictions;
create policy "podium_insert_self" on podium_predictions
  for insert with check (user_id = auth.uid());

drop policy if exists "podium_update_self" on podium_predictions;
create policy "podium_update_self" on podium_predictions
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "podium_delete_self" on podium_predictions;
create policy "podium_delete_self" on podium_predictions
  for delete using (user_id = auth.uid());
