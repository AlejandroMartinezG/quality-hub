-- Unify Global Quality Alert and New NCR Alert
-- 1. Update handle_ncr_notifications to include Global Alert logic
CREATE OR REPLACE FUNCTION public.handle_ncr_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  ncr_info record;
  target_user record;
BEGIN
  -- 1. NEW NCR CREATED (Insert on quality_ncr)
  IF TG_OP = 'INSERT' AND TG_TABLE_NAME = 'quality_ncr' THEN
      
      -- A. Notify the Preparer (Personalized)
      -- Only if preparer is assigned
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

      -- B. Notify Global Admins & Quality Managers (UNIFIED "Global Alert")
      -- Replaces the old 'Alerta Global Calidad'
      FOR target_user IN 
         SELECT id FROM profiles 
         WHERE role IN ('admin', 'administrador', 'coordinador', 'gerente_calidad', 'director_operaciones')
      LOOP
         INSERT INTO notifications (user_id, type, title, message, link, metadata)
         VALUES (
           target_user.id,
           'NCR_CREATED',
           '🚨 Alerta de Calidad: ' || NEW.sucursal,
           'Nuevo NCR generado para ' || NEW.product_id || ' Lote ' || NEW.batch_code || '. Defecto: ' || NEW.defect_parameter,
           '/calidad/ncr/' || NEW.id,
           jsonb_build_object('ncr_id', NEW.id, 'lote', NEW.batch_code, 'sucursal', NEW.sucursal)
         );
      END LOOP;

      -- C. Notify Local Branch Managers
      -- Notify managers of the specific sucursal
      FOR target_user IN 
         SELECT id FROM profiles 
         WHERE role IN ('gerente', 'gerente_sucursal', 'director_compras') AND sucursal = NEW.sucursal
      LOOP
         INSERT INTO notifications (user_id, type, title, message, link, metadata)
         VALUES (
           target_user.id,
           'NCR_CREATED',
           '⚠️ Alerta NCR Local',
           'Nuevo NCR en su sucursal. Lote ' || NEW.batch_code || '.',
           '/calidad/ncr/' || NEW.id,
           jsonb_build_object('ncr_id', NEW.id, 'lote', NEW.batch_code, 'sucursal', NEW.sucursal)
         );
      END LOOP;

  END IF;

  -- 2. NEW COMMENT (Insert on quality_ncr_comments)
  IF TG_OP = 'INSERT' AND TG_TABLE_NAME = 'quality_ncr_comments' THEN
      SELECT * INTO ncr_info FROM quality_ncr WHERE id = NEW.ncr_id;
      
      -- Notify preparer if comment is public and author is not the preparer
      IF NEW.visibility = 'PUBLICO_NCR' AND ncr_info.preparer_user_id IS NOT NULL AND NEW.author_user_id != ncr_info.preparer_user_id THEN
          INSERT INTO notifications (user_id, type, title, message, link, metadata)
          VALUES (
            ncr_info.preparer_user_id, 
            'COMENTARIO_NUEVO',
            '💬 Nuevo comentario en NCR',
            'Calidad ha comentado en el lote ' || ncr_info.batch_code,
            '/calidad/ncr/' || ncr_info.id,
            jsonb_build_object('ncr_id', ncr_info.id)
          );
      END IF;
  END IF;

  -- 3. DISPOSITION REGISTERED (Insert on quality_disposition)
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

-- 2. Drop the old trigger that caused duplicate/separate global alerts
DROP TRIGGER IF EXISTS on_nonconformity_insert ON public.bitacora_produccion_calidad;

-- 3. Optionally drop the old function if it's no longer used
DROP FUNCTION IF EXISTS public.create_nonconformity_notifications();
