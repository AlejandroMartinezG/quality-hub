-- Migration: Only notify admins on NCR creation; skip NOTA placeholder NCRs
-- NOTA NCRs are created automatically by the chat feature for conforming records.

CREATE OR REPLACE FUNCTION public.handle_ncr_notifications()
RETURNS trigger AS $$
DECLARE
    v_ncr record;
    v_user record;
    v_acting_name text;
    v_acting_id uuid := auth.uid();
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

        -- Skip all notifications for NOTA placeholder NCRs (used by chat feature)
        IF v_ncr.status = 'NOTA' THEN RETURN NEW; END IF;

        v_ncr_json := to_jsonb(v_ncr);
        v_ncr_suc := public.get_sucursal_acronym(v_ncr_json->>'sucursal');

        -- Detect Acting Name
        SELECT COALESCE(nombre_completo, profiles::text, 'Usuario') INTO v_acting_name
        FROM public.profiles WHERE id = v_acting_id;
        v_acting_name := TRIM(BOTH '"()' FROM v_acting_name);
        IF position(',' in v_acting_name) > 0 THEN v_acting_name := split_part(v_acting_name, ',', 2); END IF;

        -- Content Factory
        IF TG_TABLE_NAME = 'quality_ncr' THEN
            IF TG_OP = 'INSERT' THEN
                v_notif_type := 'NCR_CREATED'; v_notif_title := '🚨 Nuevo NCR: ' || COALESCE(v_ncr_json->>'sucursal', 'Ginez');
                v_notif_msg := v_acting_name || ' creó reporte: ' || (v_ncr_json->>'batch_code');
            ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
                v_notif_type := 'NCR_STATUS_CHANGE'; v_notif_title := '🔄 Estado NCR: ' || (v_ncr_json->>'batch_code');
                v_notif_msg := v_acting_name || ' cambió a: ' || (v_ncr_json->>'status');
            ELSE RETURN NEW; END IF;
        ELSIF TG_TABLE_NAME = 'quality_ncr_comments' THEN
            v_notif_type := 'COMENTARIO_NUEVO'; v_notif_title := '💬 Mensaje NCR: ' || (v_ncr_json->>'batch_code');
            v_raw_msg := COALESCE(to_jsonb(NEW)->>'message', to_jsonb(NEW)->>'comment_text', 'Nuevo mensaje');
            v_notif_msg := v_acting_name || ': ' || LEFT(v_raw_msg, 50);
        ELSIF TG_TABLE_NAME = 'quality_disposition' THEN
            v_notif_type := 'DISPOSICION_REGISTRADA'; v_notif_title := '📋 Disposición: ' || (v_ncr_json->>'batch_code');
            v_notif_msg := v_acting_name || ' definió: ' || (to_jsonb(NEW)->>'disposition_type');
        ELSE RETURN NEW; END IF;

        -- Target delivery (ONE PER UNIQUE USER ID)
        FOR v_user IN
            SELECT DISTINCT ON (id) *
            FROM public.profiles
            WHERE approved = true
            AND id != COALESCE(v_acting_id, '00000000-0000-0000-0000-000000000000'::uuid)
        LOOP
            v_user_json := to_jsonb(v_user);
            v_target_role := LOWER(COALESCE(v_user_json->>'rol', v_user_json->>'role', ''));
            v_target_suc := public.get_sucursal_acronym(v_user_json->>'sucursal');

            -- NCR_CREATED: only notify admins
            IF v_notif_type = 'NCR_CREATED' THEN
                IF NOT (v_user.is_admin = true OR v_target_role = 'admin') THEN
                    CONTINUE;
                END IF;
            ELSE
                -- All other events: existing logic (preparer, quality roles, same-sucursal managers)
                IF NOT (
                    (v_user.id = (v_ncr_json->>'preparer_user_id')::uuid) OR
                    (v_target_role ~ '(admin|coordin|calidad|operaci|desarrollo)') OR
                    (v_target_role ~ '(gerent|sucursal|compras)' AND (v_target_suc = v_ncr_suc OR v_target_suc IS NULL))
                ) THEN
                    CONTINUE;
                END IF;
            END IF;

            BEGIN
                INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
                VALUES (v_user.id, v_notif_type, v_notif_title, v_notif_msg, '/calidad/ncr/' || (v_ncr_json->>'id'), jsonb_build_object('ncr_id', v_ncr_json->>'id'));
            EXCEPTION WHEN OTHERS THEN NULL; END;
        END LOOP;

    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'NCR Notification Error: %', SQLERRM;
    END;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also filter NOTA NCRs out of the list RPC so they never appear in the NCR manager
CREATE OR REPLACE FUNCTION public.rpc_ncr_list(
    p_status text DEFAULT NULL, p_sucursal text DEFAULT NULL, p_product text DEFAULT NULL,
    p_batch text DEFAULT NULL, p_preparer_id uuid DEFAULT NULL, p_limit int DEFAULT 50, p_offset int DEFAULT 0
)
RETURNS TABLE (
    id uuid, batch_code text, sucursal text, product_id text, family text, defect_parameter text,
    status text, created_at timestamptz, preparer_name text, liters_involved numeric,
    liters_recovered numeric, message_count bigint, disposition_type text
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        n.id, n.batch_code, n.sucursal, n.product_id,
        COALESCE(b.familia_producto, 'Terminado')::text as family,
        n.defect_parameter, n.status::text as status, n.created_at,
        COALESCE(n.nombre_preparador, 'Sin asignar')::text as preparer_name,
        COALESCE(n.liters_involved, 0)::numeric, 0::numeric,
        COUNT(DISTINCT c.id) as message_count, NULL::text
    FROM public.quality_ncr n
    LEFT JOIN public.bitacora_produccion_calidad b ON n.measurement_id = b.id
    LEFT JOIN public.quality_ncr_comments c ON n.id = c.ncr_id
    WHERE
        n.status != 'NOTA'
        AND (p_status IS NULL OR p_status = 'ALL' OR n.status::text = p_status)
        AND (p_sucursal IS NULL OR p_sucursal = 'ALL' OR p_sucursal = '' OR
             get_sucursal_acronym(n.sucursal) = get_sucursal_acronym(p_sucursal))
        AND (p_product IS NULL OR p_product = 'ALL' OR n.product_id ILIKE '%' || p_product || '%')
        AND (p_batch IS NULL OR n.batch_code ILIKE '%' || p_batch || '%')
        AND (p_preparer_id IS NULL OR n.preparer_user_id = p_preparer_id)
    GROUP BY
        n.id, n.batch_code, n.sucursal, n.product_id, b.familia_producto,
        n.defect_parameter, n.status, n.created_at, n.nombre_preparador, n.liters_involved
    ORDER BY n.created_at DESC LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
