-- Fotos de evidencia para las auditorías presenciales.
--
-- Una sola tabla cubre los dos casos: foto de un lote específico (`lote_id`
-- apunta al renglón de auditoria_lotes) y foto general de la visita
-- (`lote_id` en NULL).
--
-- De cada foto se guardan dos archivos: la versión completa para verla en
-- pantalla y una miniatura, que es la que se embebe en el PDF. Rasterizar
-- imágenes grandes con html2canvas hace el reporte lento y pesado.
--
-- El bucket es PRIVADO, a diferencia de `avatars`: estas fotos documentan el
-- desempeño de un operador y se sirven solo con URL firmada.

-- ============================================
-- 1. Tabla
-- ============================================

CREATE TABLE IF NOT EXISTS public.auditoria_evidencias (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auditoria_id    UUID NOT NULL
                    REFERENCES public.auditorias_presenciales(id) ON DELETE CASCADE,

    -- NULL = evidencia general de la visita, no de un lote concreto.
    lote_id         UUID
                    REFERENCES public.auditoria_lotes(id) ON DELETE CASCADE,

    ruta            TEXT NOT NULL,
    ruta_miniatura  TEXT NOT NULL,
    descripcion     TEXT,

    -- Permite medir el consumo real de disco sin ir a contar objetos al bucket.
    bytes           INTEGER NOT NULL DEFAULT 0,

    subida_por      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evidencias_auditoria
    ON public.auditoria_evidencias (auditoria_id, created_at);

CREATE INDEX IF NOT EXISTS idx_evidencias_lote
    ON public.auditoria_evidencias (lote_id);

-- ============================================
-- 2. RLS de la tabla
-- ============================================
-- Misma regla que el resto del módulo: Calidad y dirección ven todo, el
-- gerente solo su sucursal, los preparadores nada.

ALTER TABLE public.auditoria_evidencias ENABLE ROW LEVEL SECURITY;

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
      OR p.role IN ('admin', 'gerente_calidad', 'coordinador',
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
    AND (p.is_admin = true OR p.role IN ('admin', 'gerente_calidad', 'coordinador'))
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
    AND (p.is_admin = true OR p.role IN ('admin', 'gerente_calidad', 'coordinador'))
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
    AND (p.is_admin = true OR p.role IN ('admin', 'gerente_calidad', 'coordinador'))
  )
);

-- ============================================
-- 3. Bucket privado
-- ============================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('evidencia-auditorias', 'evidencia-auditorias', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- ============================================
-- 4. RLS de los objetos
-- ============================================
-- La ruta es `{auditoria_id}/{evidencia_id}.jpg`, así que el primer segmento
-- de la carpeta identifica la auditoría y permite aplicar la misma regla de
-- sucursal que en la tabla.

DROP POLICY IF EXISTS "evidencia_auditorias_select" ON storage.objects;
CREATE POLICY "evidencia_auditorias_select"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'evidencia-auditorias'
  AND EXISTS (
    SELECT 1 FROM public.auditorias_presenciales a
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE a.id = ((storage.foldername(name))[1])::uuid
    AND (
      p.is_admin = true
      OR p.role IN ('admin', 'gerente_calidad', 'coordinador',
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
    AND (p.is_admin = true OR p.role IN ('admin', 'gerente_calidad', 'coordinador'))
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
    AND (p.is_admin = true OR p.role IN ('admin', 'gerente_calidad', 'coordinador'))
  )
);
