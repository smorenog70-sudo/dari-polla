-- ============================================================
-- MIGRACIÓN: Seguimiento de pago de multas
-- ============================================================
-- Agrega a la tabla 'fines' las columnas 'paid' y 'paid_at' para
-- que el admin pueda marcar qué multas ya fueron pagadas.
--
-- Es segura de correr varias veces (IF NOT EXISTS).
-- ============================================================

alter table fines
  add column if not exists paid boolean not null default false;

alter table fines
  add column if not exists paid_at timestamptz;
