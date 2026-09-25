-- Lotes encontrados en campo que NO tenían registro en la plataforma.
--
-- Son un hallazgo de otra naturaleza al de "midió mal": el operador no registró
-- el lote. Mezclarlos con las discrepancias oculta el problema — una sucursal
-- que registra 3 lotes y deja 7 sin registrar puede salir con 0% de discrepancia.
--
-- La tabla ya los admite tal cual: measurement_id, lote_producto,
-- nombre_preparador y fecha_fabricacion son nullables, y el UNIQUE sobre
-- (auditoria_id, measurement_id) no estorba porque Postgres trata los NULL como
-- distintos entre sí. Solo hacen falta el discriminador y ampliar el CHECK.

-- ============================================
-- 1. Discriminador de origen
-- ============================================

ALTER TABLE public.auditoria_lotes
    ADD COLUMN IF NOT EXISTS origen TEXT NOT NULL DEFAULT 'REGISTRADO';

-- Se agrega por separado para poder repetir la migración sin error.
ALTER TABLE public.auditoria_lotes
    DROP CONSTRAINT IF EXISTS auditoria_lotes_origen_check;

ALTER TABLE public.auditoria_lotes
    ADD CONSTRAINT auditoria_lotes_origen_check
    CHECK (origen IN ('REGISTRADO', 'SIN_REGISTRO'));

-- Las filas que ya existían son todas lotes que sí estaban registrados: el
-- DEFAULT las cubre y no hace falta backfill.

-- ============================================
-- 2. Nuevo valor de `resultado`
-- ============================================
-- Un lote sin registro no es PENDIENTE (sí se midió) ni COINCIDE/DESVIACION/
-- DISCREPANCIA (no hay medición del operador contra qué comparar).

ALTER TABLE public.auditoria_lotes
    DROP CONSTRAINT IF EXISTS auditoria_lotes_resultado_check;

ALTER TABLE public.auditoria_lotes
    ADD CONSTRAINT auditoria_lotes_resultado_check
    CHECK (resultado IN ('PENDIENTE', 'COINCIDE', 'DESVIACION', 'DISCREPANCIA', 'SIN_REGISTRO'));

-- ============================================
-- 3. Índice
-- ============================================
-- El KPI de cumplimiento agrupa por origen dentro de cada auditoría.

CREATE INDEX IF NOT EXISTS idx_auditoria_lotes_origen
    ON public.auditoria_lotes (auditoria_id, origen);
