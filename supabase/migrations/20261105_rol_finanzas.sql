-- =====================================================
-- ROL "FINANZAS" — mismos permisos que Gerente de Calidad
-- =====================================================
-- El alias que se agregó en AuthProvider resuelve los permisos del lado del
-- navegador, pero las políticas RLS leen el rol REAL de `profiles.role` y no
-- ven ese alias. Sin esta migración, un usuario con rol `finanzas` vería los
-- módulos en el menú y le rebotaría cada consulta a la base.
--
-- Dos partes:
--   1. Catálogo de roles: para que "Finanzas" aparezca en el selector de
--      Configuración → Usuarios, que lee `user_roles_v2` de la base.
--   2. Políticas RLS: agregar 'finanzas' junto a 'gerente_calidad'.
--
-- Los permisos de BORRADO no se tocan: son exclusivos de admin, y el gerente
-- de calidad tampoco los tiene (salvo en evidencias, donde sí se incluye).
--
-- Idempotente: se puede correr varias veces sin efecto adicional.

BEGIN;

-- =====================================================
-- 1. CATÁLOGO DE ROLES
-- =====================================================

INSERT INTO public.user_roles_v2 (role_key, role_name, description) VALUES
    ('finanzas', 'Finanzas', 'Mismos permisos que Gerente de Calidad y Desarrollo')
ON CONFLICT (role_key) DO UPDATE
    SET role_name   = EXCLUDED.role_name,
        description = EXCLUDED.description;

-- Copia los niveles de acceso por módulo que tiene hoy gerente_calidad.
-- Se hace con SELECT y no con valores literales para que refleje el estado
-- actual de la tabla, incluyendo ajustes manuales posteriores.
INSERT INTO public.module_access_levels (
    role_key, module_key, access_level,
    can_view, can_download, can_create, can_edit, can_delete, can_export,
    available_filters, visible_tabs
)
SELECT
    'finanzas', module_key, access_level,
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
-- 2. AUDITORÍAS PRESENCIALES
-- =====================================================

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
                    'director_operaciones', 'director_compras')
      OR (
        p.role IN ('gerente_sucursal', 'gerente')
        AND (p.sucursal IS NULL OR p.sucursal = public.auditorias_presenciales.sucursal)
      )
    )
  )
);

DROP POLICY IF EXISTS "auditoria_lotes_select" ON public.auditoria_lotes;
CREATE POLICY "auditoria_lotes_select"
ON public.auditoria_lotes
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.auditorias_presenciales a
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE a.id = public.auditoria_lotes.auditoria_id
    AND (
      p.is_admin = true
      OR p.role IN ('admin', 'gerente_calidad', 'finanzas', 'coordinador',
                    'director_operaciones', 'director_compras')
      OR (
        p.role IN ('gerente_sucursal', 'gerente')
        AND (p.sucursal IS NULL OR p.sucursal = a.sucursal)
      )
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
    AND (p.is_admin = true OR p.role IN ('admin', 'gerente_calidad', 'finanzas', 'coordinador'))
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
    AND (p.is_admin = true OR p.role IN ('admin', 'gerente_calidad', 'finanzas', 'coordinador'))
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
    AND (p.is_admin = true OR p.role IN ('admin', 'gerente_calidad', 'finanzas', 'coordinador'))
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
    AND (p.is_admin = true OR p.role IN ('admin', 'gerente_calidad', 'finanzas', 'coordinador'))
  )
);

-- =====================================================
-- 3. EVIDENCIA FOTOGRÁFICA DE AUDITORÍAS
-- =====================================================

DROP POLICY IF EXISTS "evidencias_select" ON public.auditoria_evidencias;
CREATE POLICY "evidencias_select"
ON public.auditoria_evidencias
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.auditorias_presenciales a
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE a.id = public.auditoria_evidencias.auditoria_id
    AND (
      p.is_admin = true
      OR p.role IN ('admin', 'gerente_calidad', 'finanzas', 'coordinador',
                    'director_operaciones', 'director_compras')
      OR (
        p.role IN ('gerente_sucursal', 'gerente')
        AND (p.sucursal IS NULL OR p.sucursal = a.sucursal)
      )
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
    AND (p.is_admin = true OR p.role IN ('admin', 'gerente_calidad', 'finanzas', 'coordinador'))
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
    AND (p.is_admin = true OR p.role IN ('admin', 'gerente_calidad', 'finanzas', 'coordinador'))
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
    AND (p.is_admin = true OR p.role IN ('admin', 'gerente_calidad', 'finanzas', 'coordinador'))
  )
);

-- --- Objetos del bucket privado `evidencia-auditorias` ---
-- La ruta es `{auditoria_id}/{evidencia_id}.jpg`. La comparación se hace en
-- texto y no casteando la ruta a uuid: Postgres puede reordenar el AND y
-- evaluar esta expresión sobre objetos de otros buckets, donde el cast
-- reventaría.

DROP POLICY IF EXISTS "evidencia_auditorias_select" ON storage.objects;
CREATE POLICY "evidencia_auditorias_select"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'evidencia-auditorias'
  AND EXISTS (
    SELECT 1 FROM public.auditorias_presenciales a
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE a.id::text = split_part(name, '/', 1)
    AND (
      p.is_admin = true
      OR p.role IN ('admin', 'gerente_calidad', 'finanzas', 'coordinador',
                    'director_operaciones', 'director_compras')
      OR (
        p.role IN ('gerente_sucursal', 'gerente')
        AND (p.sucursal IS NULL OR p.sucursal = a.sucursal)
      )
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
    AND (p.is_admin = true OR p.role IN ('admin', 'gerente_calidad', 'finanzas', 'coordinador'))
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
    AND (p.is_admin = true OR p.role IN ('admin', 'gerente_calidad', 'finanzas', 'coordinador'))
  )
);

-- =====================================================
-- 4. PRODUCTOS ESPECIALES
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
    AND (p.is_admin = true OR p.role IN ('admin', 'gerente_calidad', 'finanzas', 'coordinador'))
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
    AND (p.is_admin = true OR p.role IN ('admin', 'gerente_calidad', 'finanzas', 'coordinador'))
  )
);

COMMIT;
