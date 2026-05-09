-- Migration: Bidirectional chat notifications + unread chat RPC
-- Fix: profiles column is full_name, not nombre_completo
-- Fix: use author_user_id fallback when auth.uid() is NULL in trigger context
-- Add: rpc_unread_chat_measurements (SECURITY DEFINER to bypass RLS)

-- ── 1. Notification trigger function ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_ncr_notifications()
RETURNS trigger AS $$
DECLARE
    v_ncr record;
    v_user record;
    v_acting_id uuid;
    v_acting_is_admin boolean := false;
    v_acting_name text;
    v_notif_title text;
    v_notif_msg text;
    v_notif_type text;
    v_raw_msg text;
    v_ncr_suc text;
    v_ncr_json jsonb;
    v_user_json jsonb;
    v_target_role text;
    v_target_suc text;
BEGIN
    BEGIN
        -- Identify NCR
        IF TG_TABLE_NAME = 'quality_ncr' THEN v_ncr := NEW;
        ELSE SELECT * INTO v_ncr FROM public.quality_ncr WHERE id = NEW.ncr_id; END IF;

        IF v_ncr.id IS NULL THEN RETURN NEW; END IF;

        v_ncr_json := to_jsonb(v_ncr);

        -- Determine acting user: prefer auth.uid(), fall back to stored author_user_id on comments
        v_acting_id := auth.uid();
        IF v_acting_id IS NULL AND TG_TABLE_NAME = 'quality_ncr_comments' THEN
            v_acting_id := (to_jsonb(NEW)->>'author_user_id')::uuid;
        END IF;

        -- Detect acting user name and admin status (column is full_name)
        IF v_acting_id IS NOT NULL THEN
            SELECT
                COALESCE(full_name, 'Usuario'),
                COALESCE(is_admin, false)
            INTO v_acting_name, v_acting_is_admin
            FROM public.profiles WHERE id = v_acting_id;
        END IF;
        v_acting_name := COALESCE(v_acting_name, 'Usuario');

        -- ── NOTA NCR = chat record from historial de mediciones ──
        IF v_ncr.status::text = 'NOTA' AND TG_TABLE_NAME = 'quality_ncr_comments' THEN
            v_notif_type  := 'CHAT_CALIDAD';
            v_notif_title := '💬 Chat lote: ' || COALESCE(v_ncr_json->>'batch_code', 'registro');
            v_raw_msg     := COALESCE(to_jsonb(NEW)->>'message', 'Nuevo mensaje');
            v_notif_msg   := v_acting_name || ': ' || LEFT(v_raw_msg, 60);

            FOR v_user IN
                SELECT DISTINCT ON (id) *
                FROM public.profiles
                WHERE approved = true
                AND id IS DISTINCT FROM v_acting_id
            LOOP
                v_user_json   := to_jsonb(v_user);
                v_target_role := LOWER(COALESCE(v_user_json->>'role', ''));

                IF v_acting_is_admin THEN
                    -- Admin wrote → only notify the record's preparador
                    IF v_user.id IS DISTINCT FROM (v_ncr_json->>'preparer_user_id')::uuid THEN
                        CONTINUE;
                    END IF;
                ELSE
                    -- Non-admin wrote → only notify admins
                    IF NOT (v_user.is_admin = true OR v_target_role = 'admin') THEN
                        CONTINUE;
                    END IF;
                END IF;

                BEGIN
                    INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
                    VALUES (
                        v_user.id,
                        v_notif_type,
                        v_notif_title,
                        v_notif_msg,
                        '/calidad',
                        jsonb_build_object(
                            'ncr_id',         v_ncr_json->>'id',
                            'measurement_id', v_ncr_json->>'measurement_id',
                            'batch_code',     v_ncr_json->>'batch_code'
                        )
                    );
                EXCEPTION WHEN OTHERS THEN NULL; END;
            END LOOP;

            RETURN NEW;
        END IF;

        -- ── All other NOTA NCR events → skip ──
        IF v_ncr.status::text = 'NOTA' THEN RETURN NEW; END IF;

        v_ncr_suc := public.get_sucursal_acronym(v_ncr_json->>'sucursal');

        -- Content factory for real NCRs
        IF TG_TABLE_NAME = 'quality_ncr' THEN
            IF TG_OP = 'INSERT' THEN
                v_notif_type  := 'NCR_CREATED';
                v_notif_title := '🚨 Nuevo NCR: ' || COALESCE(v_ncr_json->>'sucursal', 'Ginez');
                v_notif_msg   := v_acting_name || ' creó reporte: ' || (v_ncr_json->>'batch_code');
            ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
                v_notif_type  := 'NCR_STATUS_CHANGE';
                v_notif_title := '🔄 Estado NCR: ' || (v_ncr_json->>'batch_code');
                v_notif_msg   := v_acting_name || ' cambió a: ' || (v_ncr_json->>'status');
            ELSE RETURN NEW; END IF;
        ELSIF TG_TABLE_NAME = 'quality_ncr_comments' THEN
            v_notif_type  := 'COMENTARIO_NUEVO';
            v_notif_title := '💬 Mensaje NCR: ' || (v_ncr_json->>'batch_code');
            v_raw_msg     := COALESCE(to_jsonb(NEW)->>'message', to_jsonb(NEW)->>'comment_text', 'Nuevo mensaje');
            v_notif_msg   := v_acting_name || ': ' || LEFT(v_raw_msg, 50);
        ELSIF TG_TABLE_NAME = 'quality_disposition' THEN
            v_notif_type  := 'DISPOSICION_REGISTRADA';
            v_notif_title := '📋 Disposición: ' || (v_ncr_json->>'batch_code');
            v_notif_msg   := v_acting_name || ' definió: ' || (to_jsonb(NEW)->>'disposition_type');
        ELSE RETURN NEW; END IF;

        -- Target delivery for real NCRs
        FOR v_user IN
            SELECT DISTINCT ON (id) *
            FROM public.profiles
            WHERE approved = true
            AND id IS DISTINCT FROM v_acting_id
        LOOP
            v_user_json   := to_jsonb(v_user);
            v_target_role := LOWER(COALESCE(v_user_json->>'role', ''));
            v_target_suc  := public.get_sucursal_acronym(v_user_json->>'sucursal');

            IF v_notif_type = 'NCR_CREATED' THEN
                IF NOT (v_user.is_admin = true OR v_target_role = 'admin') THEN CONTINUE; END IF;
            ELSE
                IF NOT (
                    (v_user.id = (v_ncr_json->>'preparer_user_id')::uuid) OR
                    (v_target_role ~ '(admin|coordin|calidad|operaci|desarrollo)') OR
                    (v_target_role ~ '(gerent|sucursal|compras)' AND (v_target_suc = v_ncr_suc OR v_target_suc IS NULL))
                ) THEN CONTINUE; END IF;
            END IF;

            BEGIN
                INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
                VALUES (
                    v_user.id, v_notif_type, v_notif_title, v_notif_msg,
                    '/calidad/ncr/' || (v_ncr_json->>'id'),
                    jsonb_build_object('ncr_id', v_ncr_json->>'id')
                );
            EXCEPTION WHEN OTHERS THEN NULL; END;
        END LOOP;

    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'NCR Notification Error: %', SQLERRM;
    END;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ── 2. RPC: unread chat measurements (SECURITY DEFINER bypasses RLS) ──────────
CREATE OR REPLACE FUNCTION public.rpc_unread_chat_measurements(
    p_user_id uuid,
    p_measurement_ids text[]
)
RETURNS TABLE(measurement_id text) AS $$
    WITH last_msg AS (
        SELECT DISTINCT ON (n.measurement_id)
            n.measurement_id::text,
            c.author_user_id
        FROM public.quality_ncr n
        JOIN public.quality_ncr_comments c ON c.ncr_id = n.id
        WHERE n.status::text = 'NOTA'
          AND n.measurement_id::text = ANY(p_measurement_ids)
        ORDER BY n.measurement_id, c.created_at DESC
    )
    SELECT last_msg.measurement_id FROM last_msg
    WHERE last_msg.author_user_id IS DISTINCT FROM p_user_id;
$$ LANGUAGE sql SECURITY DEFINER;
