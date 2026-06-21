-- ============================================================
-- MIGRACIÓN: "Quién pasa" en playoffs (+5 puntos extra)
-- ============================================================
-- Agrega una columna 'advances' a predictions y results.
-- Guarda qué equipo el usuario cree que pasa (o pasó), como
-- 'team1' o 'team2'. Solo aplica a partidos de eliminación.
-- El marcador (score1/score2) sigue siendo el de los 90 minutos.
--
-- Es segura de correr varias veces (IF NOT EXISTS).
-- ============================================================

-- Predicción del usuario: a quién cree que pasa
alter table predictions
  add column if not exists advances text
  check (advances is null or advances in ('team1', 'team2'));

-- Resultado real: quién pasó de verdad (lo marca el admin).
-- Cubre penales: si quedó empate a 90 pero pasó uno por penales.
alter table results
  add column if not exists advances text
  check (advances is null or advances in ('team1', 'team2'));
