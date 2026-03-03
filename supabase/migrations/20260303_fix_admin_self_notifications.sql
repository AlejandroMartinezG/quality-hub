-- Fix: admin y gerente_calidad siempre reciben notificaciones de NCR,
-- incluso cuando ellos mismos los crean (son supervisores, deben verlo todo)
-- Antes: el trigger excluía al creador, lo cual afectaba a admins que crean NCRs de prueba.

CREATE OR REPLACE FUNCTION public.handle_ncr_notifications()
RETURNS trigger AS $$
DECLARE
    v_ncr record;
    v_user record;
    v_acting_name text;
    v_acting_id uuid := auth.uid();
    v_acting_role text;
    v_notif_title text;
    v_notif_msg text;
    v_notif_type text;
    v_raw_msg text;
    v_ncr_suc text;
    v_ncr_json jsonb;
    v_user_json jsonb;
    v_target_role text;
    v_target_suc text;
    v_is_supervisor boolean;
BEGIN
    BEGIN
        -- Identify NCR
        IF TG_TABLE_NAME = 'quality_ncr' THEN v_ncr := NEW;
        ELSE SELECT * INTO v_ncr FROM public.quality_ncr WHERE id = NEW.ncr_id; END IF;
        
        IF v_ncr.id IS NULL THEN RETURN NEW; END IF;
        v_ncr_json := to_jsonb(v_ncr);
        v_ncr_suc := public.get_sucursal_acronym(v_ncr_json->>'sucursal');

        -- Detect Acting Name & Role
        SELECT 
            COALESCE(nombre_completo, full_name, 'Usuario'),
            LOWER(COALESCE(role, rol, ''))
        INTO v_acting_name, v_acting_role
        FROM public.profiles WHERE id = v_acting_id;

        v_acting_name := TRIM(BOTH '"()' FROM COALESCE(v_acting_name, 'Usuario'));
        IF position(',' in v_acting_name) > 0 THEN v_acting_name := split_part(v_acting_name, ',', 2); END IF;

        -- Content Factory
        IF TG_TABLE_NAME = 'quality_ncr' THEN
            IF TG_OP = 'INSERT' THEN
                v_notif_type := 'NCR_CREATED'; 
                v_notif_title := '🚨 Nuevo NCR: ' || COALESCE(v_ncr_json->>'sucursal', 'Ginez');
                v_notif_msg := v_acting_name || ' creó reporte: ' || (v_ncr_json->>'batch_code');
            ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
                v_notif_type := 'NCR_STATUS_CHANGE'; 
                v_notif_title := '🔄 Estado NCR: ' || (v_ncr_json->>'batch_code');
                v_notif_msg := v_acting_name || ' cambió a: ' || (v_ncr_json->>'status');
            ELSE RETURN NEW; END IF;
        ELSIF TG_TABLE_NAME = 'quality_ncr_comments' THEN
            v_notif_type := 'COMENTARIO_NUEVO'; 
            v_notif_title := '💬 Mensaje NCR: ' || (v_ncr_json->>'batch_code');
            v_raw_msg := COALESCE(to_jsonb(NEW)->>'message', to_jsonb(NEW)->>'comment_text', 'Nuevo mensaje');
            v_notif_msg := v_acting_name || ': ' || LEFT(v_raw_msg, 50);
        ELSIF TG_TABLE_NAME = 'quality_disposition' THEN
            v_notif_type := 'DISPOSICION_REGISTRADA'; 
            v_notif_title := '📋 Disposición: ' || (v_ncr_json->>'batch_code');
            v_notif_msg := v_acting_name || ' definió: ' || (to_jsonb(NEW)->>'disposition_type');
        ELSE RETURN NEW; END IF;

        -- Target delivery
        FOR v_user IN 
            SELECT DISTINCT ON (id) * 
            FROM public.profiles 
            WHERE approved = true
        LOOP
            v_user_json := to_jsonb(v_user);
            v_target_role := LOWER(COALESCE(v_user_json->>'role', v_user_json->>'rol', ''));
            v_target_suc := public.get_sucursal_acronym(v_user_json->>'sucursal');

            -- Supervisors (admin/calidad/coordinacion) always get notified regardless of who acted
            v_is_supervisor := (v_target_role ~ '(admin|coordin|calidad|operaci|desarrollo)');

            -- Skip self-notification ONLY for non-supervisors
            IF v_user.id = v_acting_id AND NOT v_is_supervisor THEN
                CONTINUE;
            END IF;

            -- Delivery conditions
            IF v_is_supervisor OR
               (v_user.id = (v_ncr_json->>'preparer_user_id')::uuid) OR
               (v_target_role ~ '(gerent|sucursal|compras)' AND (v_target_suc = v_ncr_suc OR v_target_suc IS NULL))
            THEN
                BEGIN
                    INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
                    VALUES (
                        v_user.id, 
                        v_notif_type, 
                        v_notif_title, 
                        v_notif_msg, 
                        '/calidad/ncr/' || (v_ncr_json->>'id'), 
                        jsonb_build_object('ncr_id', v_ncr_json->>'id')
                    );
                EXCEPTION WHEN OTHERS THEN NULL; END;
            END IF;
        END LOOP;

    EXCEPTION WHEN OTHERS THEN 
        RAISE WARNING 'NCR Notification Error: %', SQLERRM;
    END;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
