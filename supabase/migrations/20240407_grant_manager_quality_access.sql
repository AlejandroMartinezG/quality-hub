-- ============================================
-- SQL de Migración para acceso de Gerente de Sucursal
-- ============================================

-- 1. Actualizar el nivel de acceso al módulo de Control de Calidad
UPDATE public.module_access_levels 
SET access_level = 'AC' 
WHERE role_key = 'gerente_sucursal' AND module_key = 'control_calidad';

-- 2. Políticas RLS para visibilidad por sucursal

-- 2.1 Tabla bitacora_produccion_calidad
DROP POLICY IF EXISTS "Enable select for gerente_sucursal on bitacora" ON public.bitacora_produccion_calidad;
CREATE POLICY "Enable select for gerente_sucursal on bitacora" 
ON public.bitacora_produccion_calidad
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role = 'gerente_sucursal'
    AND (p.sucursal IS NULL OR p.sucursal = public.bitacora_produccion_calidad.sucursal)
  )
);

-- 2.2 Tabla quality_ncr
DROP POLICY IF EXISTS "Enable select for gerente_sucursal on ncr" ON public.quality_ncr;
CREATE POLICY "Enable select for gerente_sucursal on ncr" 
ON public.quality_ncr
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role = 'gerente_sucursal'
    AND (p.sucursal IS NULL OR p.sucursal = public.quality_ncr.sucursal)
  )
);

-- 2.3 Tabla quality_ncr_comments
DROP POLICY IF EXISTS "Enable select for gerente_sucursal on ncr_comments" ON public.quality_ncr_comments;
CREATE POLICY "Enable select for gerente_sucursal on ncr_comments" 
ON public.quality_ncr_comments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.quality_ncr n
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE n.id = quality_ncr_comments.ncr_id
    AND p.role = 'gerente_sucursal'
    AND (p.sucursal IS NULL OR p.sucursal = n.sucursal)
  )
);

-- Permiso para que el Gerente pueda comentar en NCRs de su sucursal
DROP POLICY IF EXISTS "Enable insert for gerente_sucursal on ncr_comments" ON public.quality_ncr_comments;
CREATE POLICY "Enable insert for gerente_sucursal on ncr_comments" 
ON public.quality_ncr_comments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.quality_ncr n
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE n.id = ncr_id
    AND p.role = 'gerente_sucursal'
    AND (p.sucursal IS NULL OR p.sucursal = n.sucursal)
  )
);

-- 2.4 Tabla quality_disposition
DROP POLICY IF EXISTS "Enable select for gerente_sucursal on disposition" ON public.quality_disposition;
CREATE POLICY "Enable select for gerente_sucursal on disposition" 
ON public.quality_disposition
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.quality_ncr n
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE n.id = quality_disposition.ncr_id
    AND p.role = 'gerente_sucursal'
    AND (p.sucursal IS NULL OR p.sucursal = n.sucursal)
  )
);
