-- Ejecutar en el SQL Editor de Supabase (proyecto ya existente):
-- agrega la columna due_date usada por la detección de fechas relativas
-- ("el sábado", "el próximo sábado", "mañana", etc).

alter table public.tasks add column if not exists due_date date;
