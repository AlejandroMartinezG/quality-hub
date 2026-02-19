CREATE OR REPLACE FUNCTION public.rpc_spy_summary(p_start_date timestamp with time zone, p_end_date timestamp with time zone, p_metric text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_total_input numeric := 0;
    v_total_ncr numeric := 0;
    v_total_recovered numeric := 0;
    v_total_scrapped numeric := 0;
    v_ftq numeric := 0;
    v_final_yield numeric := 0;
    v_rework_rate numeric := 0;
    v_scrap_rate numeric := 0;
    v_pareto_data json;
BEGIN
    /* 
       SPY CALCULATION LOGIC:
       1. Total Input: Total Batches or Total Liters produced in range (from bitacora_produccion_calidad)
       2. Total NCR: Total amount involved in NCRs (from quality_ncr)
       3. FTQ = (Total Input - Total NCR) / Total Input
       4. Recovered: Amount from dispositions where type != 'SCRAP'
       5. Scrapped: Amount from dispositions where type = 'SCRAP'
       6. Final Yield = (Total Input - Scrapped) / Total Input
    */

    -- 1. Get Total Input from Bitacora
    IF p_metric = 'LITROS' THEN
        -- Assuming 1 Batch = 1000 Liters for 'LITRO' calculation as placeholder
        SELECT COUNT(*) * 1000 INTO v_total_input
        FROM bitacora_produccion_calidad
        WHERE created_at BETWEEN p_start_date AND p_end_date;
        
    ELSE -- LOTES
        SELECT COUNT(*) INTO v_total_input
        FROM bitacora_produccion_calidad
        WHERE created_at BETWEEN p_start_date AND p_end_date;
    END IF;

    -- 2. Get NCR Metrics
    IF p_metric = 'LITROS' THEN
        SELECT COALESCE(SUM(liters_involved), 0) INTO v_total_ncr
        FROM quality_ncr
        WHERE created_at BETWEEN p_start_date AND p_end_date;
        
        -- Calculate Scrapped and Recovered volumes from dispositions
        SELECT 
            COALESCE(SUM(CASE WHEN d.disposition_type = 'SCRAP' THEN d.liters_involved ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN d.disposition_type != 'SCRAP' THEN d.liters_involved ELSE 0 END), 0)
        INTO v_total_scrapped, v_total_recovered
        FROM quality_disposition d
        JOIN quality_ncr n ON d.ncr_id = n.id
        WHERE n.created_at BETWEEN p_start_date AND p_end_date;
    ELSE -- LOTES
        SELECT COUNT(*) INTO v_total_ncr
        FROM quality_ncr
        WHERE created_at BETWEEN p_start_date AND p_end_date;

        -- For Dispositions in Lotes mode
        SELECT 
            COUNT(DISTINCT n.id) FILTER (WHERE d.disposition_type = 'SCRAP'),
            COUNT(DISTINCT n.id) FILTER (WHERE d.disposition_type != 'SCRAP')
        INTO v_total_scrapped, v_total_recovered
        FROM quality_disposition d
        JOIN quality_ncr n ON d.ncr_id = n.id
        WHERE n.created_at BETWEEN p_start_date AND p_end_date;
    END IF;

    -- 3. Calculate Rates
    IF v_total_input > 0 THEN
        v_ftq := ((v_total_input - v_total_ncr) / v_total_input) * 100;
        v_final_yield := ((v_total_input - v_total_scrapped) / v_total_input) * 100;
        v_rework_rate := (v_total_recovered / v_total_input) * 100;
        v_scrap_rate := (v_total_scrapped / v_total_input) * 100;
    ELSE
        v_ftq := 100; v_final_yield := 100; v_rework_rate := 0; v_scrap_rate := 0;
    END IF;

    -- 4. Pareto Data
    IF p_metric = 'LITROS' THEN
        SELECT json_agg(t) INTO v_pareto_data FROM (
            SELECT defect_parameter as name, SUM(liters_involved) as value
            FROM quality_ncr
            WHERE created_at BETWEEN p_start_date AND p_end_date
            GROUP BY defect_parameter
            ORDER BY value DESC
            LIMIT 10
        ) t;
    ELSE
        SELECT json_agg(t) INTO v_pareto_data FROM (
            SELECT defect_parameter as name, COUNT(*) as value
            FROM quality_ncr
            WHERE created_at BETWEEN p_start_date AND p_end_date
            GROUP BY defect_parameter
            ORDER BY value DESC
            LIMIT 10
        ) t;
    END IF;

    RETURN json_build_object(
        'summary', json_build_object(
            'total_input', v_total_input,
            'total_ncr', v_total_ncr,
            'first_pass_yield', v_ftq,
            'final_yield', v_final_yield,
            'rework_rate', v_rework_rate,
            'scrap_rate', v_scrap_rate
        ),
        'pareto_data', COALESCE(v_pareto_data, '[]'::json)
    );
END;
$function$;
