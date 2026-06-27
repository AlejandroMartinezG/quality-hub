-- Guarda el nombre del autor directamente en cada mensaje de chat, igual que
-- nombre_preparador en bitacora_produccion_calidad. Evita que los mensajes
-- pierdan el nombre de su autor si la cuenta es eliminada después.

ALTER TABLE public.measurement_chat_messages
    ADD COLUMN IF NOT EXISTS author_name text;

-- Backfill best-effort para mensajes existentes cuyo autor todavía tiene perfil
UPDATE public.measurement_chat_messages m
SET author_name = p.full_name
FROM public.profiles p
WHERE m.author_user_id = p.id
  AND m.author_name IS NULL;
