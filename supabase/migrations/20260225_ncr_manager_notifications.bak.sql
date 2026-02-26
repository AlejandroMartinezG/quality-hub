-- EMERGENCY RECOVERY SCRIPT
-- This script simplifies everything to restore the NCR list.
-- It uses standard types (text, numeric) to avoid custom type errors.

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

-- Drop with CASCADE to be 100% sure we remove any conflicting signature
DROP FUNCTION IF EXISTS public.rpc_ncr_list CASCADE;

CREATE OR REPLACE FUNCTION public.rpc_ncr_list(
    p_status text DEFAULT NULL,
    p_sucursal text DEFAULT NULL,
    p_product text DEFAULT NULL,
    p_batch text DEFAULT NULL,
    p_preparer_id uuid DEFAULT NULL,
    p_limit int DEFAULT 50,
    p_offset int DEFAULT 0
)
RETURNS TABLE (
    id uuid,
    batch_code text,
    sucursal text,
    product_id text,
    family text,
    defect_parameter text,
    status text,
    created_at timestamptz,
    preparer_name text,
    liters_involved numeric,
    liters_recovered numeric,
    message_count bigint,
    disposition_type text
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        n.id, 
        n.batch_code, 
        n.sucursal, 
        n.product_id,
        COALESCE(b.familia_producto, 'Terminado')::text as family,
        n.defect_parameter, 
        n.status::text as status, 
        n.created_at,
        COALESCE(n.nombre_preparador, 'Sin asignar')::text as preparer_name,
        COALESCE(n.liters_involved, 0)::numeric, 
        COALESCE(d.liters_involved, 0)::numeric as liters_recovered,
        COUNT(c.id) as message_count, 
        d.disposition_type::text
    FROM public.quality_ncr n
    LEFT JOIN public.bitacora_produccion_calidad b ON n.measurement_id = b.id
    LEFT JOIN public.quality_disposition d ON n.id = d.ncr_id
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
        n.defect_parameter, n.status, n.created_at, n.nombre_preparador, 
        n.liters_involved, d.liters_involved, d.disposition_type
    ORDER BY n.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
