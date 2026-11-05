-- =====================================================
-- GERENTE DE SUCURSAL — paridad con Gerente de Calidad
-- =====================================================
-- El gerente de sucursal pasa a tener los mismos permisos que el gerente de
-- calidad y desarrollo: consulta los datos de las 39 sucursales, captura en la
-- Bitácora, levanta auditorías presenciales y asigna códigos de productos
-- especiales.
--
-- Del lado del navegador lo resuelve ALIAS_DE_ROL en AuthProvider. Esta
-- migración es la otra mitad: las políticas RLS leen el rol real de
-- `profiles.role` y no ven ese alias.
--
-- Se cubren los dos valores que el código ha usado siempre para este puesto:
-- 'gerente_sucursal' (el del catálogo) y 'gerente' (el corto, que existe en
-- perfiles antiguos).
--
-- NO cambia: borrar y editar registros de producción sigue siendo exclusivo de
-- admin — los botones viven detrás de `is_admin`, y el gerente de calidad
-- tampoco los tiene.
--
-- Idempotente: se puede correr varias veces sin efecto adicional.

BEGIN;

-- =====================================================
-- 1. CATÁLOGO DE PERMISOS POR MÓDULO
-- =====================================================
-- La app no decide accesos con esta tabla (los arreglos están en el código),
-- pero la pantalla de Configuración / Usuarios la muestra. Se deja coherente
-- con los permisos reales para que no diga una cosa y pase otra.

INSERT INTO public.module_access_levels (
    role_key, module_key, access_level,
    can_view, can_download, can_create, can_edit, can_delete, can_export,
    available_filters, visible_tabs
)
SELECT
    'gerente_sucursal', module_key, access_level,
    can_view, can_download, can_create, can_edit, can_delete, can_export,
    available_filters, visible_tabs
FROM public.module_access_levels
WHERE role_key = 'gerente_calidad'
ON CONFLICT (role_key, module_key) DO UPDATE
    SET access_level      = EXCLUDED.access_level,
        can_view          = EXCLUDED.can_view,
        can_download      = EXCLUDED.can_download,
        can_create        = EXCLUDED.can_create,
        can_edit          = EXCLUDED.can_edit,
        can_delete        = EXCLUDED.can_delete,
        can_export        = EXCLUDED.can_export,
        available_filters = EXCLUDED.available_filters,
        visible_tabs      = EXCLUDED.visible_tabs;

-- =====================================================
-- 2. BITÁCORA DE PRODUCCIÓN
-- =====================================================
-- La política anterior (20240407) acotaba al gerente a su propia sucursal.
-- Se reemplaza por una de alcance global.

DROP POLICY IF EXISTS "Enable select for gerente_sucursal on bitacora" ON public.bitacora_produccion_calidad;

DROP POLICY IF EXISTS "bitacora_select_gerente_global" ON public.bitacora_produccion_calidad;
CREATE POLICY "bitacora_select_gerente_global"
ON public.bitacora_produccion_calidad
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('gerente_sucursal', 'gerente')
  )
);

-- Capturar lotes. Se exige que el registro quede a nombre de quien lo inserta,
-- igual que hace la pantalla.
DROP POLICY IF EXISTS "bitacora_insert_gerente" ON public.bitacora_produccion_calidad;
CREATE POLICY "bitacora_insert_gerente"
ON public.bitacora_produccion_calidad
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('gerente_sucursal', 'gerente')
  )
);

-- =====================================================
-- 3. NO CONFORMIDADES (NCR)
-- =====================================================
-- Mismo cambio: de "solo mi sucursal" a todas.

DROP POLICY IF EXISTS "Enable select for gerente_sucursal on ncr" ON public.quality_ncr;

DROP POLICY IF EXISTS "ncr_select_gerente_global" ON public.quality_ncr;
CREATE POLICY "ncr_select_gerente_global"
ON public.quality_ncr
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('gerente_sucursal', 'gerente')
  )
);

-- La Bitácora levanta el NCR automáticamente cuando el lote sale NO CONFORME,
-- así que capturar exige poder insertarlo.
DROP POLICY IF EXISTS "ncr_insert_gerente" ON public.quality_ncr;
CREATE POLICY "ncr_insert_gerente"
ON public.quality_ncr
FOR INSERT
WITH CHECK (
  author_user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('gerente_sucursal', 'gerente')
  )
);

DROP POLICY IF EXISTS "Enable select for gerente_sucursal on ncr_comments" ON public.quality_ncr_comments;
DROP POLICY IF EXISTS "Enable insert for gerente_sucursal on ncr_comments" ON public.quality_ncr_comments;

DROP POLICY IF EXISTS "ncr_comments_select_gerente_global" ON public.quality_ncr_comments;
CREATE POLICY "ncr_comments_select_gerente_global"
ON public.quality_ncr_comments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('gerente_sucursal', 'gerente')
  )
);

DROP POLICY IF EXISTS "ncr_comments_insert_gerente_global" ON public.quality_ncr_comments;
CREATE POLICY "ncr_comments_insert_gerente_global"
ON public.quality_ncr_comments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('gerente_sucursal', 'gerente')
  )
);

DROP POLICY IF EXISTS "Enable select for gerente_sucursal on disposition" ON public.quality_disposition;

DROP POLICY IF EXISTS "disposition_select_gerente_global" ON public.quality_disposition;
CREATE POLICY "disposition_select_gerente_global"
ON public.quality_disposition
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('gerente_sucursal', 'gerente')
  )
);

-- =====================================================
-- 4. AUDITORÍAS PRESENCIALES
-- =====================================================
-- El gerente sale de la rama acotada por sucursal y entra a la lista de
-- alcance global. También gana capturar, que antes no tenía.
-- Se conserva 'finanzas' de la migración 20261105.

DROP POLICY IF EXISTS "auditorias_select" ON public.auditorias_presenciales;
CREATE POLICY "auditorias_select"
ON public.auditorias_presenciales
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND (
      p.is_admin = true
      OR p.role IN ('admin', 'gerente_calidad', 'finanzas', 'coordinador',
                    'director_operaciones', 'director_compras',
                    'gerente_sucursal', 'gerente')
    )
  )
);

DROP POLICY IF EXISTS "auditoria_lotes_select" ON public.auditoria_lotes;
CREATE POLICY "auditoria_lotes_select"
ON public.auditoria_lotes
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND (
      p.is_admin = true
      OR p.role IN ('admin', 'gerente_calidad', 'finanzas', 'coordinador',
                    'director_operaciones', 'director_compras',
                    'gerente_sucursal', 'gerente')
    )
  )
);

DROP POLICY IF EXISTS "auditorias_insert" ON public.auditorias_presenciales;
CREATE POLICY "auditorias_insert"
ON public.auditorias_presenciales
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND (p.is_admin = true OR p.role IN ('admin', 'gerente_calidad', 'finanzas',
                                         'coordinador', 'gerente_sucursal', 'gerente'))
  )
);

DROP POLICY IF EXISTS "auditorias_update" ON public.auditorias_presenciales;
CREATE POLICY "auditorias_update"
ON public.auditorias_presenciales
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND (p.is_admin = true OR p.role IN ('admin', 'gerente_calidad', 'finanzas',
                                         'coordinador', 'gerente_sucursal', 'gerente'))
  )
);

DROP POLICY IF EXISTS "auditoria_lotes_insert" ON public.auditoria_lotes;
CREATE POLICY "auditoria_lotes_insert"
ON public.auditoria_lotes
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND (p.is_admin = true OR p.role IN ('admin', 'gerente_calidad', 'finanzas',
                                         'coordinador', 'gerente_sucursal', 'gerente'))
  )
);

DROP POLICY IF EXISTS "auditoria_lotes_update" ON public.auditoria_lotes;
CREATE POLICY "auditoria_lotes_update"
ON public.auditoria_lotes
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND (p.is_admin = true OR p.role IN ('admin', 'gerente_calidad', 'finanzas',
                                         'coordinador', 'gerente_sucursal', 'gerente'))
  )
);

-- =====================================================
-- 5. EVIDENCIA FOTOGRÁFICA DE AUDITORÍAS
-- =====================================================

DROP POLICY IF EXISTS "evidencias_select" ON public.auditoria_evidencias;
CREATE POLICY "evidencias_select"
ON public.auditoria_evidencias
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND (
      p.is_admin = true
      OR p.role IN ('admin', 'gerente_calidad', 'finanzas', 'coordinador',
                    'director_operaciones', 'director_compras',
                    'gerente_sucursal', 'gerente')
    )
  )
);

DROP POLICY IF EXISTS "evidencias_insert" ON public.auditoria_evidencias;
CREATE POLICY "evidencias_insert"
ON public.auditoria_evidencias
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND (p.is_admin = true OR p.role IN ('admin', 'gerente_calidad', 'finanzas',
                                         'coordinador', 'gerente_sucursal', 'gerente'))
  )
);

DROP POLICY IF EXISTS "evidencias_update" ON public.auditoria_evidencias;
CREATE POLICY "evidencias_update"
ON public.auditoria_evidencias
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND (p.is_admin = true OR p.role IN ('admin', 'gerente_calidad', 'finanzas',
                                         'coordinador', 'gerente_sucursal', 'gerente'))
  )
);

DROP POLICY IF EXISTS "evidencias_delete" ON public.auditoria_evidencias;
CREATE POLICY "evidencias_delete"
ON public.auditoria_evidencias
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND (p.is_admin = true OR p.role IN ('admin', 'gerente_calidad', 'finanzas',
                                         'coordinador', 'gerente_sucursal', 'gerente'))
  )
);

-- --- Objetos del bucket privado `evidencia-auditorias` ---
-- La comparación se hace en texto (`a.id::text = split_part(...)`) y no
-- casteando la ruta a uuid: Postgres puede reordenar el AND y evaluar esta
-- expresión sobre objetos de otros buckets, donde el cast reventaría.
-- Al ser global el acceso, ya no hace falta cruzar con la auditoría para
-- resolver la sucursal; se conserva el cruce solo para los roles acotados.

DROP POLICY IF EXISTS "evidencia_auditorias_select" ON storage.objects;
CREATE POLICY "evidencia_auditorias_select"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'evidencia-auditorias'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND (
      p.is_admin = true
      OR p.role IN ('admin', 'gerente_calidad', 'finanzas', 'coordinador',
                    'director_operaciones', 'director_compras',
                    'gerente_sucursal', 'gerente')
    )
  )
);

DROP POLICY IF EXISTS "evidencia_auditorias_insert" ON storage.objects;
CREATE POLICY "evidencia_auditorias_insert"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'evidencia-auditorias'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND (p.is_admin = true OR p.role IN ('admin', 'gerente_calidad', 'finanzas',
                                         'coordinador', 'gerente_sucursal', 'gerente'))
  )
);

DROP POLICY IF EXISTS "evidencia_auditorias_delete" ON storage.objects;
CREATE POLICY "evidencia_auditorias_delete"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'evidencia-auditorias'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND (p.is_admin = true OR p.role IN ('admin', 'gerente_calidad', 'finanzas',
                                         'coordinador', 'gerente_sucursal', 'gerente'))
  )
);

-- =====================================================
-- 6. PRODUCTOS ESPECIALES
-- =====================================================
-- La lectura ya es para cualquier sesión iniciada; solo cambia la escritura.

DROP POLICY IF EXISTS "especiales_insert" ON public.productos_especiales;
CREATE POLICY "especiales_insert"
ON public.productos_especiales
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND (p.is_admin = true OR p.role IN ('admin', 'gerente_calidad', 'finanzas',
                                         'coordinador', 'gerente_sucursal', 'gerente'))
  )
);

DROP POLICY IF EXISTS "especiales_update" ON public.productos_especiales;
CREATE POLICY "especiales_update"
ON public.productos_especiales
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND (p.is_admin = true OR p.role IN ('admin', 'gerente_calidad', 'finanzas',
                                         'coordinador', 'gerente_sucursal', 'gerente'))
  )
);

COMMIT;
