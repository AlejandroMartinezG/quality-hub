-- ── New standalone chat system for historial de mediciones ───────────────────
-- Completely independent from quality_ncr / quality_ncr_comments tables.

-- ── 1. Messages table ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.measurement_chat_messages (
    id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
    measurement_id text     NOT NULL,  -- bitacora_produccion_calidad.id::text
    author_user_id uuid     NOT NULL REFERENCES public.profiles(id),
    message     text        NOT NULL,
    created_at  timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mch_measurement
    ON public.measurement_chat_messages(measurement_id, created_at);

ALTER TABLE public.measurement_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mch_select" ON public.measurement_chat_messages
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "mch_insert" ON public.measurement_chat_messages
    FOR INSERT WITH CHECK (auth.uid() = author_user_id);


-- ── 2. Read-tracking table (last time each user read each chat) ───────────────
CREATE TABLE IF NOT EXISTS public.measurement_chat_reads (
    user_id        uuid        NOT NULL REFERENCES public.profiles(id),
    measurement_id text        NOT NULL,
    last_read_at   timestamptz DEFAULT now() NOT NULL,
    PRIMARY KEY (user_id, measurement_id)
);

ALTER TABLE public.measurement_chat_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mcr_own" ON public.measurement_chat_reads
    USING  (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);


-- ── 3. RPC: unread message counts per measurement for the current user ────────
CREATE OR REPLACE FUNCTION public.rpc_measurement_chat_unread(p_user_id uuid)
RETURNS TABLE(measurement_id text, unread_count bigint) AS $$
    SELECT
        m.measurement_id,
        COUNT(*)::bigint AS unread_count
    FROM public.measurement_chat_messages m
    LEFT JOIN public.measurement_chat_reads r
        ON r.user_id = p_user_id AND r.measurement_id = m.measurement_id
    WHERE m.author_user_id IS DISTINCT FROM p_user_id
      AND (r.last_read_at IS NULL OR m.created_at > r.last_read_at)
    GROUP BY m.measurement_id;
$$ LANGUAGE sql SECURITY DEFINER;


-- ── 4. Trigger: send CHAT_CALIDAD notification on new message ─────────────────
CREATE OR REPLACE FUNCTION public.handle_measurement_chat_notification()
RETURNS trigger AS $$
DECLARE
    v_author_name    text;
    v_author_is_admin boolean := false;
    v_batch_code     text;
    v_preparer_id    uuid;
    v_user           record;
BEGIN
    SELECT COALESCE(full_name, 'Usuario'), COALESCE(is_admin, false)
    INTO v_author_name, v_author_is_admin
    FROM public.profiles WHERE id = NEW.author_user_id;

    SELECT lote_producto, user_id
    INTO v_batch_code, v_preparer_id
    FROM public.bitacora_produccion_calidad
    WHERE id::text = NEW.measurement_id;

    FOR v_user IN
        SELECT * FROM public.profiles
        WHERE approved = true AND id IS DISTINCT FROM NEW.author_user_id
    LOOP
        IF v_author_is_admin THEN
            IF v_user.id IS DISTINCT FROM v_preparer_id THEN CONTINUE; END IF;
        ELSE
            IF NOT COALESCE(v_user.is_admin, false) THEN CONTINUE; END IF;
        END IF;

        BEGIN
            INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
            VALUES (
                v_user.id,
                'CHAT_CALIDAD',
                '💬 Chat lote: ' || COALESCE(v_batch_code, 'registro'),
                v_author_name || ': ' || LEFT(NEW.message, 60),
                '/calidad?chat=' || NEW.measurement_id,
                jsonb_build_object('measurement_id', NEW.measurement_id)
            );
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_measurement_chat_notify ON public.measurement_chat_messages;

CREATE TRIGGER tr_measurement_chat_notify
    AFTER INSERT ON public.measurement_chat_messages
    FOR EACH ROW EXECUTE FUNCTION public.handle_measurement_chat_notification();
