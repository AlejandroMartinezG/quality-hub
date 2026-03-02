-- Migration: fix_rpc_ncr_list_lateral_join
-- Fecha: 2026-03-01
--
-- PROBLEMA:
--   rpc_ncr_list usaba un LEFT JOIN simple a quality_disposition.
--   Si un NCR tenía múltiples disposiciones registradas (ej: REPROCESO → SCRAP),
--   el query devolvía UNA FILA POR DISPOSICIÓN, duplicando ese NCR en los resultados.
--
-- SOLUCIÓN:
--   Reemplazar por LATERAL JOIN con ORDER BY closed_at DESC LIMIT 1
--   para obtener siempre solo la disposición MÁS RECIENTE por NCR.
--
-- IMPACTO:
--   - rpc_ncr_list ya no duplica NCRs con múltiples disposiciones
--   - Los KPIs de SPY/Final Yield calculan correctamente el scrap real

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
    last_message_author_id uuid,
    disposition_type text
) AS $$
BEGIN
    RETURN QUERY
    WITH latest_comments AS (
        SELECT DISTINCT ON (ncr_id) 
            ncr_id, 
            author_user_id
        FROM public.quality_ncr_comments
        ORDER BY ncr_id, created_at DESC
    )
    SELECT 
        n.id,
        n.batch_code,
        n.sucursal,
        n.product_id,
        p.familia_producto as family,
        n.defect_parameter,
        n.status::text,
        n.created_at,
        COALESCE(n.nombre_preparador, u.raw_user_meta_data->>'full_name', 'Sin asignar') as preparer_name,
        n.liters_involved,
        d.liters_involved as liters_recovered,
        (SELECT COUNT(*) FROM public.quality_ncr_comments c WHERE c.ncr_id = n.id) as message_count,
        lc.author_user_id as last_message_author_id,
        d.disposition_type::text
    FROM public.quality_ncr n
    LEFT JOIN public.bitacora_produccion_calidad b ON n.measurement_id = b.id
    LEFT JOIN auth.users u ON n.preparer_user_id = u.id
    LEFT JOIN public.bitacora_produccion_calidad p ON n.measurement_id = p.id
    -- LATERAL JOIN: obtiene solo la disposición más reciente por NCR, evita duplicados
    LEFT JOIN LATERAL (
        SELECT disposition_type, liters_involved
        FROM public.quality_disposition
        WHERE ncr_id = n.id
        ORDER BY closed_at DESC NULLS LAST, created_at DESC NULLS LAST
        LIMIT 1
    ) d ON true
    LEFT JOIN latest_comments lc ON n.id = lc.ncr_id
    WHERE 
        (p_status IS NULL OR n.status::text = p_status)
        AND (p_sucursal IS NULL OR n.sucursal = p_sucursal)
        AND (p_product IS NULL OR n.product_id ILIKE '%' || p_product || '%')
        AND (p_batch IS NULL OR n.batch_code ILIKE '%' || p_batch || '%')
        AND (p_preparer_id IS NULL OR n.preparer_user_id = p_preparer_id)
    ORDER BY n.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
