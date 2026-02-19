-- Trigger to remind operator to calibrate refractometer every 15 solids measurements
-- 1. Create the function
CREATE OR REPLACE FUNCTION public.check_refractometer_calibration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_count integer;
BEGIN
  -- Check if the current record has solids measurements
  IF NEW.solidos_medicion_1 IS NOT NULL OR NEW.solidos_medicion_2 IS NOT NULL THEN
      
      -- Count how many records this user has with solids measurements
      -- This counts the current one too since it's an AFTER INSERT trigger?
      -- If it's AFTER INSERT, the new row is already in the table visible to the transaction?
      -- Usually yes in Postgres for AFTER trigger.
      -- Let's check the count.
      
      SELECT COUNT(*) INTO v_count
      FROM public.bitacora_produccion_calidad
      WHERE user_id = NEW.user_id
      AND (solidos_medicion_1 IS NOT NULL OR solidos_medicion_2 IS NOT NULL);
      
      -- Validar si es múltiplo de 15
      IF v_count > 0 AND (v_count % 15) = 0 THEN
          INSERT INTO notifications (user_id, type, title, message, link, metadata)
          VALUES (
            NEW.user_id,
            'calibration_reminder',
            '🔧 Calibración de Refractómetro',
            'Has realizado ' || v_count || ' mediciones de sólidos. Por favor verifica la calibración y limpieza del refractómetro.',
            '/calidad', -- Stay on quality page or go to guide
            jsonb_build_object('count', v_count, 'trigger_record', NEW.id)
          );
      END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 2. Create the trigger
DROP TRIGGER IF EXISTS on_solids_measurement_insert ON public.bitacora_produccion_calidad;

CREATE TRIGGER on_solids_measurement_insert
AFTER INSERT ON public.bitacora_produccion_calidad
FOR EACH ROW
EXECUTE FUNCTION public.check_refractometer_calibration();
