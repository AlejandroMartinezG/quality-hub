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
    status ncr_status,
    created_at timestamptz,
    preparer_name text,
    liters_involved numeric,
    liters_recovered numeric,
    message_count bigint,
    disposition_type ncr_disposition_type
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        n.id,
        n.batch_code,
        n.sucursal,
        n.product_id,
        p.familia_producto as family, -- Assuming join with product table or similar
        n.defect_parameter,
        n.status,
        n.created_at,
        COALESCE(n.nombre_preparador, u.raw_user_meta_data->>'full_name', 'Sin asignar') as preparer_name,
        n.liters_involved,
        d.liters_involved as liters_recovered, -- Or similar logic
        COUNT(c.id) as message_count,
        d.disposition_type
    FROM public.quality_ncr n
    LEFT JOIN public.bitacora_produccion_calidad b ON n.measurement_id = b.id
    LEFT JOIN auth.users u ON n.preparer_user_id = u.id -- Join with users to get name if needed
    LEFT JOIN public.bitacora_produccion_calidad p ON n.measurement_id = p.id -- Self join? Or maybe just use n columns. 
    -- Actually, simpler:
    -- n has product_id. We might need family from somewhere.
    -- Let's stick to current structure but add disposition join.
    LEFT JOIN public.quality_disposition d ON n.id = d.ncr_id
    LEFT JOIN public.quality_ncr_comments c ON n.id = c.ncr_id
    WHERE 
        (p_status IS NULL OR n.status::text = p_status)
        AND (p_sucursal IS NULL OR n.sucursal = p_sucursal)
        AND (p_product IS NULL OR n.product_id ILIKE '%' || p_product || '%')
        AND (p_batch IS NULL OR n.batch_code ILIKE '%' || p_batch || '%')
        AND (p_preparer_id IS NULL OR n.preparer_user_id = p_preparer_id)
    GROUP BY n.id, n.batch_code, n.sucursal, n.product_id, p.familia_producto, n.defect_parameter, n.status, n.created_at, n.nombre_preparador, u.raw_user_meta_data, d.liters_involved, d.disposition_type
    ORDER BY n.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
