-- Update rpc_ncr_list to include last_message_author_id
-- and update handle_ncr_notifications to notify admins on comments

-- 1. Update handle_ncr_notifications
CREATE OR REPLACE FUNCTION public.handle_ncr_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  ncr_info record;
  target_user record;
  author_profile record;
BEGIN
  -- 1. NEW NCR CREATED (Insert on quality_ncr)
  IF TG_OP = 'INSERT' AND TG_TABLE_NAME = 'quality_ncr' THEN
      
      -- A. Notify the Preparer (Personalized)
      IF NEW.preparer_user_id IS NOT NULL THEN
          INSERT INTO notifications (user_id, type, title, message, link, metadata)
          VALUES (
            NEW.preparer_user_id, 
            'NCR_ASIGNADO',
            '⚠️ Nuevo NCR Asignado',
            'Se ha abierto un reporte para el lote ' || NEW.batch_code || ' (' || NEW.defect_parameter || ').',
            '/calidad/ncr/' || NEW.id,
            jsonb_build_object('ncr_id', NEW.id, 'lote', NEW.batch_code)
          );
      END IF;

      -- B. Notify Global Admins & Quality Managers
      FOR target_user IN 
         SELECT id FROM profiles 
         WHERE role IN ('admin', 'administrador', 'coordinador', 'gerente_calidad', 'director_operaciones')
      LOOP
          -- Don't notify the author if they are an admin
          IF target_user.id != NEW.author_user_id THEN
             INSERT INTO notifications (user_id, type, title, message, link, metadata)
             VALUES (
               target_user.id,
               'NCR_CREATED',
               '🚨 Alerta de Calidad: ' || NEW.sucursal,
               'Nuevo NCR generado para ' || NEW.product_id || ' Lote ' || NEW.batch_code || '. Defecto: ' || NEW.defect_parameter,
               '/calidad/ncr/' || NEW.id,
               jsonb_build_object('ncr_id', NEW.id, 'lote', NEW.batch_code, 'sucursal', NEW.sucursal)
             );
          END IF;
      END LOOP;

  END IF;

  -- 2. NEW COMMENT (Insert on quality_ncr_comments)
  IF TG_OP = 'INSERT' AND TG_TABLE_NAME = 'quality_ncr_comments' THEN
      SELECT * INTO ncr_info FROM quality_ncr WHERE id = NEW.ncr_id;
      SELECT * INTO author_profile FROM profiles WHERE id = NEW.author_user_id;
      
      -- A. Notify preparer if comment is public and author is not the preparer
      IF NEW.visibility = 'PUBLICO_NCR' AND ncr_info.preparer_user_id IS NOT NULL AND NEW.author_user_id != ncr_info.preparer_user_id THEN
          INSERT INTO notifications (user_id, type, title, message, link, metadata)
          VALUES (
            ncr_info.preparer_user_id, 
            'COMENTARIO_NUEVO',
            '💬 Nuevo comentario en NCR',
            COALESCE(author_profile.full_name, 'Alguien') || ' ha comentado en el lote ' || ncr_info.batch_code,
            '/calidad/ncr/' || ncr_info.id,
            jsonb_build_object('ncr_id', ncr_info.id)
          );
      END IF;

      -- B. Notify Admins/Managers if author is NOT an admin/manager (usually if preparer comments)
      -- Or simply: if the author is NOT the person being notified.
      FOR target_user IN 
         SELECT id FROM profiles 
         WHERE role IN ('admin', 'administrador', 'coordinador', 'gerente_calidad', 'director_operaciones')
      LOOP
          IF target_user.id != NEW.author_user_id THEN
              INSERT INTO notifications (user_id, type, title, message, link, metadata)
              VALUES (
                target_user.id,
                'COMENTARIO_NUEVO',
                '💬 Respuesta en NCR: ' || ncr_info.batch_code,
                COALESCE(author_profile.full_name, 'El preparador') || ' envió un mensaje: ' || LEFT(NEW.message, 50),
                '/calidad/ncr/' || ncr_info.id,
                jsonb_build_object('ncr_id', ncr_info.id)
              );
          END IF;
      END LOOP;
  END IF;

  -- 3. DISPOSITION REGISTERED
  IF TG_OP = 'INSERT' AND TG_TABLE_NAME = 'quality_disposition' THEN
      SELECT * INTO ncr_info FROM quality_ncr WHERE id = NEW.ncr_id;
      
      IF ncr_info.preparer_user_id IS NOT NULL THEN
          INSERT INTO notifications (user_id, type, title, message, link, metadata)
          VALUES (
            ncr_info.preparer_user_id, 
            'DISPOSICION_REGISTRADA',
            '📋 Disposición Registrada',
            'Se ha determinado: ' || NEW.disposition_type || ' para el lote ' || ncr_info.batch_code,
            '/calidad/ncr/' || ncr_info.id,
            jsonb_build_object('ncr_id', ncr_info.id, 'disposition', NEW.disposition_type)
          );
      END IF;
  END IF;

  RETURN NEW;
END;
$function$;


-- 2. Update rpc_ncr_list to include last_message_author_id
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
    last_message_author_id uuid,
    disposition_type ncr_disposition_type
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
        n.status,
        n.created_at,
        COALESCE(n.nombre_preparador, u.raw_user_meta_data->>'full_name', 'Sin asignar') as preparer_name,
        n.liters_involved,
        d.liters_involved as liters_recovered,
        (SELECT COUNT(*) FROM public.quality_ncr_comments c WHERE c.ncr_id = n.id) as message_count,
        lc.author_user_id as last_message_author_id,
        d.disposition_type
    FROM public.quality_ncr n
    LEFT JOIN public.bitacora_produccion_calidad b ON n.measurement_id = b.id
    LEFT JOIN auth.users u ON n.preparer_user_id = u.id
    LEFT JOIN public.bitacora_produccion_calidad p ON n.measurement_id = p.id
    LEFT JOIN public.quality_disposition d ON n.id = d.ncr_id
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
