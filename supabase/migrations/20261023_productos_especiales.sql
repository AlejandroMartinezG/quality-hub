-- Productos terminados especiales: fabricaciones fuera de línea a las que
-- Calidad asigna un código al momento.
--
-- No están en `CATEGORY_PRODUCTS` ni tienen estándares, así que la Bitácora no
-- puede deducir qué se les mide. Esta tabla lo dice: Calidad da de alta el
-- código y marca qué parámetros debe registrar el operador.
--
-- No se guardan rangos a propósito. Los valores quedan como dato, sin veredicto
-- de conformidad, en línea con que estos lotes se excluyan del FTQ: evaluarlos
-- sugeriría una conformidad que no se está midiendo contra nada oficial.

CREATE TABLE IF NOT EXISTS public.productos_especiales (
    -- El código tal como se teclea en la Bitácora: hasta 8 caracteres,
    -- mayúsculas, números y guiones.
    codigo          TEXT PRIMARY KEY
                    CHECK (codigo = upper(codigo) AND codigo ~ '^[A-Z0-9-]{1,8}$'),

    nombre          TEXT NOT NULL,

    -- Qué debe registrar el operador para este producto.
    mide_ph         BOOLEAN NOT NULL DEFAULT false,
    mide_solidos    BOOLEAN NOT NULL DEFAULT false,
    mide_apariencia BOOLEAN NOT NULL DEFAULT false,

    notas           TEXT,

    -- Se desactiva en vez de borrarse: los lotes ya registrados con ese código
    -- deben seguir siendo interpretables.
    activo          BOOLEAN NOT NULL DEFAULT true,

    creado_por      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_productos_especiales_activo
    ON public.productos_especiales (activo);

-- ============================================
-- RLS
-- ============================================

ALTER TABLE public.productos_especiales ENABLE ROW LEVEL SECURITY;

-- Lectura: cualquiera que haya iniciado sesión. El preparador necesita leerla
-- para que la Bitácora sepa qué campos mostrarle.
DROP POLICY IF EXISTS "especiales_select" ON public.productos_especiales;
CREATE POLICY "especiales_select"
ON public.productos_especiales
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Escritura: solo Calidad. Es quien define el producto y asigna el código.
DROP POLICY IF EXISTS "especiales_insert" ON public.productos_especiales;
CREATE POLICY "especiales_insert"
ON public.productos_especiales
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND (p.is_admin = true OR p.role IN ('admin', 'gerente_calidad', 'coordinador'))
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
    AND (p.is_admin = true OR p.role IN ('admin', 'gerente_calidad', 'coordinador'))
  )
);

DROP POLICY IF EXISTS "especiales_delete" ON public.productos_especiales;
CREATE POLICY "especiales_delete"
ON public.productos_especiales
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND (p.is_admin = true OR p.role = 'admin')
  )
);
