-- Auditorías presenciales: Calidad visita una sucursal y vuelve a medir lotes que
-- el operador ya registró, para comprobar que sus mediciones son confiables.
--
-- Dos tablas: la cabecera de la visita y un renglón por lote verificado.
--
-- Decisión importante: `auditoria_lotes` guarda una COPIA de los valores que el
-- operador había capturado (columnas `*_operador`). El registro original en
-- bitacora_produccion_calidad se puede editar después desde Control de Calidad,
-- y un reporte de auditoría debe reflejar lo que decía el registro EL DÍA DE LA
-- VISITA, no lo que diga hoy. El `measurement_id` queda solo para navegar.

-- ============================================
-- 1. Cabecera de la auditoría
-- ============================================

CREATE TABLE IF NOT EXISTS public.auditorias_presenciales (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sucursal         TEXT NOT NULL,
    fecha_auditoria  DATE NOT NULL,
    auditor_user_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    -- Desnormalizado a propósito, igual que `nombre_preparador` en la bitácora:
    -- el reporte impreso debe seguir nombrando al auditor aunque su cuenta se borre.
    auditor_nombre   TEXT,
    estado           TEXT NOT NULL DEFAULT 'EN_PROCESO'
                     CHECK (estado IN ('EN_PROCESO', 'CERRADA')),
    observaciones    TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    cerrada_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_auditorias_sucursal_fecha
    ON public.auditorias_presenciales (sucursal, fecha_auditoria DESC);

-- ============================================
-- 2. Lotes verificados
-- ============================================

CREATE TABLE IF NOT EXISTS public.auditoria_lotes (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auditoria_id           UUID NOT NULL
                           REFERENCES public.auditorias_presenciales(id) ON DELETE CASCADE,

    -- Vínculo al registro original. SET NULL: si el registro se borra, la
    -- auditoría conserva su evidencia y solo pierde la navegación.
    measurement_id         UUID
                           REFERENCES public.bitacora_produccion_calidad(id) ON DELETE SET NULL,

    -- --- Foto de lo que capturó el operador ---
    lote_producto          TEXT,
    codigo_producto        TEXT NOT NULL,
    nombre_preparador      TEXT,
    fecha_fabricacion      DATE,
    tamano_lote            NUMERIC,
    ph_operador            NUMERIC,
    solidos_1_operador     NUMERIC,
    solidos_2_operador     NUMERIC,
    apariencia_operador    TEXT,
    color_operador         TEXT,
    aroma_operador         TEXT,

    -- --- Medición hecha por Calidad durante la visita ---
    ph_calidad             NUMERIC,
    solidos_1_calidad      NUMERIC,
    temp_1_calidad         NUMERIC,
    solidos_2_calidad      NUMERIC,
    temp_2_calidad         NUMERIC,
    apariencia_calidad     TEXT,
    color_calidad          TEXT,
    aroma_calidad          TEXT,

    -- --- Resultado de la comparación ---
    -- PENDIENTE mientras Calidad no haya capturado nada todavía.
    resultado              TEXT NOT NULL DEFAULT 'PENDIENTE'
                           CHECK (resultado IN ('PENDIENTE', 'COINCIDE', 'DESVIACION', 'DISCREPANCIA')),
    parametros_afectados   TEXT[] NOT NULL DEFAULT '{}',
    notas                  TEXT,

    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Un mismo lote no se audita dos veces dentro de la misma visita.
    UNIQUE (auditoria_id, measurement_id)
);

CREATE INDEX IF NOT EXISTS idx_auditoria_lotes_auditoria
    ON public.auditoria_lotes (auditoria_id);

CREATE INDEX IF NOT EXISTS idx_auditoria_lotes_preparador
    ON public.auditoria_lotes (nombre_preparador);

-- ============================================
-- 3. RLS
-- ============================================

ALTER TABLE public.auditorias_presenciales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria_lotes         ENABLE ROW LEVEL SECURITY;

-- --- Lectura ---
-- Calidad y dirección ven todas las sucursales.
-- gerente_sucursal / gerente ven únicamente la suya.
-- Los preparadores no tienen ninguna política: la tabla les es invisible.

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
      OR p.role IN ('admin', 'gerente_calidad', 'coordinador',
                    'director_operaciones', 'director_compras')
      OR (
        p.role IN ('gerente_sucursal', 'gerente')
        AND (p.sucursal IS NULL OR p.sucursal = public.auditorias_presenciales.sucursal)
      )
    )
  )
);

-- Los lotes heredan la visibilidad de su auditoría.
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
      OR p.role IN ('admin', 'gerente_calidad', 'coordinador',
                    'director_operaciones', 'director_compras')
      OR (
        p.role IN ('gerente_sucursal', 'gerente')
        AND (p.sucursal IS NULL OR p.sucursal = a.sucursal)
      )
    )
  )
);

-- --- Escritura ---
-- Solo quien audita. Los directores y gerentes leen, no capturan.

DROP POLICY IF EXISTS "auditorias_insert" ON public.auditorias_presenciales;
CREATE POLICY "auditorias_insert"
ON public.auditorias_presenciales
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND (p.is_admin = true OR p.role IN ('admin', 'gerente_calidad', 'coordinador'))
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
    AND (p.is_admin = true OR p.role IN ('admin', 'gerente_calidad', 'coordinador'))
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
    AND (p.is_admin = true OR p.role IN ('admin', 'gerente_calidad', 'coordinador'))
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
    AND (p.is_admin = true OR p.role IN ('admin', 'gerente_calidad', 'coordinador'))
  )
);

-- --- Borrado: solo admin ---

DROP POLICY IF EXISTS "auditorias_delete" ON public.auditorias_presenciales;
CREATE POLICY "auditorias_delete"
ON public.auditorias_presenciales
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND (p.is_admin = true OR p.role = 'admin')
  )
);

DROP POLICY IF EXISTS "auditoria_lotes_delete" ON public.auditoria_lotes;
CREATE POLICY "auditoria_lotes_delete"
ON public.auditoria_lotes
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND (p.is_admin = true OR p.role = 'admin')
  )
);
