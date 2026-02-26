-- FINAL NUCLEAR CLEANUP & NOTIFICATION FIX (V10)
-- 1. DROPS EVERY SINGLE TRIGGER on NCR tables (Kills all duplicates forever)
-- 2. Restores a single, optimized notification system
-- 3. Adds message previews and author identification
-- 4. Guaranteed NO DUPLICATES per user
-- 5. Safe for all column names

-- STEP 1: NUCLEAR TRIGGER WIPE
-- This block finds and deletes EVERY non-internal trigger on the relevant tables.
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT tgname, relname 
        FROM pg_trigger t 
        JOIN pg_class c ON t.tgrelid = c.oid 
        JOIN pg_namespace n ON c.relnamespace = n.oid 
        WHERE n.nspname = 'public' 
        AND c.relname IN ('quality_ncr', 'quality_ncr_comments', 'quality_disposition')
        AND t.tgisinternal = false
    ) LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.tgname) || ' ON public.' || quote_ident(r.relname);
    END LOOP;
END $$;

-- STEP 2: Schema Repair (Ensures all columns exist)
DO $$ 
BEGIN 
    BEGIN ALTER TABLE public.profiles ADD COLUMN sucursal TEXT; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER TABLE public.profiles ADD COLUMN rol TEXT; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER TABLE public.profiles ADD COLUMN role TEXT; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER TABLE public.profiles ADD COLUMN nombre_completo TEXT; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

-- STEP 3: Optimized Sucursal Mapper
CREATE OR REPLACE FUNCTION public.get_sucursal_acronym(p_name TEXT) 
RETURNS TEXT AS $$
DECLARE
    clean_name TEXT;
BEGIN
    clean_name := UPPER(TRIM(COALESCE(p_name, '')));
    IF clean_name = '' THEN RETURN NULL; END IF;
    RETURN CASE clean_name
        WHEN 'ACTOPAN' THEN 'ACT' WHEN 'AMOZOC' THEN 'AMO' WHEN 'APIZACO' THEN 'APZ'
        WHEN 'ATITALAQUIA' THEN 'ATI' WHEN 'ATLACOMULCO' THEN 'ATL' WHEN 'CANCUN 1' THEN 'CAN1'
        WHEN 'CANCUN 2' THEN 'CAN2' WHEN 'CEIBA' THEN 'CEI' WHEN 'CELAYA' THEN 'CEL'
        WHEN 'CHOLULA' THEN 'CHO' WHEN 'CUAUTLA' THEN 'CUA' WHEN 'GUADALAJARA' THEN 'GDL'
        WHEN 'HUEJUTLA' THEN 'HUE' WHEN 'IRAPUATO' THEN 'IRA' WHEN 'IXMIQUILPAN' THEN 'IXM'
        WHEN 'MERIDA' THEN 'MER' WHEN 'MIXQUIAHUALA' THEN 'MIX' WHEN 'MORELIA' THEN 'MOR'
        WHEN 'OAXACA 1' THEN 'OAX1' WHEN 'OAXACA 2' THEN 'OAX2' WHEN 'PACHUCA 1' THEN 'PAC1'
        WHEN 'PACHUCA 2' THEN 'PAC2' WHEN 'PLAYA DEL CARMEN' THEN 'PDC' WHEN 'PUEBLA 1' THEN 'PUE1'
        WHEN 'PUEBLA 2' THEN 'PUE2' WHEN 'PUEBLA 3' THEN 'PUE3' WHEN 'QUERETARO 1' THEN 'QR01'
        WHEN 'QUERETARO 2' THEN 'QR02' WHEN 'QUERETARO 3' THEN 'QR03' WHEN 'TEHUACAN' THEN 'TEH'
        WHEN 'TEZIUTLAN' THEN 'TEZ' WHEN 'TIZAYUCA' THEN 'TIZ' WHEN 'TULANCINGO 1' THEN 'TUL1'
        WHEN 'TULANCINGO 2' THEN 'TUL2' WHEN 'VERACRUZ' THEN 'VER' WHEN 'VILLAHERMOSA' THEN 'VHM'
        WHEN 'ZUMPANGO 1' THEN 'ZUM1' WHEN 'ZUMPANGO 2' THEN 'ZUM2' WHEN 'CEDIS' THEN 'CEDIS'
        WHEN 'CORPORATIVO' THEN 'CORP' 
        WHEN 'ACT' THEN 'ACT' WHEN 'AMO' THEN 'AMO' WHEN 'APZ' THEN 'APZ'
        WHEN 'ATI' THEN 'ATI' WHEN 'ATL' THEN 'ATL' WHEN 'CAN1' THEN 'CAN1'
        WHEN 'CAN2' THEN 'CAN2' WHEN 'CEI' THEN 'CEI' WHEN 'CEL' THEN 'CEL'
        WHEN 'CHO' THEN 'CHO' WHEN 'CUA' THEN 'CUA' WHEN 'GDL' THEN 'GDL'
        WHEN 'HUE' THEN 'HUE' WHEN 'IRA' THEN 'IRA' WHEN 'IXM' THEN 'IXM'
        WHEN 'MER' THEN 'MER' WHEN 'MIX' THEN 'MIX' WHEN 'MOR' THEN 'MOR'
        WHEN 'OAX1' THEN 'OAX1' WHEN 'OAX2' THEN 'OAX2' WHEN 'PAC1' THEN 'PAC1'
        WHEN 'PAC2' THEN 'PAC2' WHEN 'PDC' THEN 'PDC' WHEN 'PUE1' THEN 'PUE1'
        WHEN 'PUE2' THEN 'PUE2' WHEN 'PUE3' THEN 'PUE3' WHEN 'QR01' THEN 'QR01'
        WHEN 'QR02' THEN 'QR02' WHEN 'QR03' THEN 'QR03' WHEN 'TEH' THEN 'TEH'
        WHEN 'TEZ' THEN 'TEZ' WHEN 'TIZ' THEN 'TIZ' WHEN 'TUL1' THEN 'TUL1'
        WHEN 'TUL2' THEN 'TUL2' WHEN 'VER' THEN 'VER' WHEN 'VHM' THEN 'VHM'
        WHEN 'ZUM1' THEN 'ZUM1' WHEN 'ZUM2' THEN 'ZUM2'
        ELSE clean_name
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- STEP 4: Simplified Notification Function
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

            IF (v_user.id = (v_ncr_json->>'preparer_user_id')::uuid) OR
               (v_target_role ~ '(admin|coordin|calidad|operaci|desarrollo)') OR
               (v_target_role ~ '(gerent|sucursal|compras)' AND (v_target_suc = v_ncr_suc OR v_target_suc IS NULL))
            THEN
                BEGIN
                    INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
                    VALUES (v_user.id, v_notif_type, v_notif_title, v_notif_msg, '/calidad/ncr/' || (v_ncr_json->>'id'), jsonb_build_object('ncr_id', v_ncr_json->>'id'));
                EXCEPTION WHEN OTHERS THEN NULL; END;
            END IF;
        END LOOP;

    EXCEPTION WHEN OTHERS THEN 
        RAISE WARNING 'NCR Notification Error: %', SQLERRM;
    END;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- STEP 5: FINAL ATTACHMENT
-- Only these 3 triggers will exist on these tables
CREATE TRIGGER tr_ncr_v10_main AFTER INSERT OR UPDATE ON public.quality_ncr FOR EACH ROW EXECUTE FUNCTION public.handle_ncr_notifications();
CREATE TRIGGER tr_ncr_v10_comm AFTER INSERT ON public.quality_ncr_comments FOR EACH ROW EXECUTE FUNCTION public.handle_ncr_notifications();
CREATE TRIGGER tr_ncr_v10_disp AFTER INSERT OR UPDATE ON public.quality_disposition FOR EACH ROW EXECUTE FUNCTION public.handle_ncr_notifications();

-- STEP 6: List RPC optimization
DROP FUNCTION IF EXISTS public.rpc_ncr_list CASCADE;
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
        (p_status IS NULL OR p_status = 'ALL' OR n.status::text = p_status)
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
