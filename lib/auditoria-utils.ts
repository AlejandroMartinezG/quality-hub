"use client"

import { analyzeRecord, type ConformityLevel } from "@/lib/analysis-utils"
import { PARAMETER_APPLICABILITY, APPEARANCE_STANDARDS } from "@/lib/production-constants"

/**
 * Tolerancias para la diferencia entre la medición del operador y la de Calidad.
 *
 * No definen conformidad —de eso se encarga `analyzeRecord` contra los estándares
 * del producto— sino cuánto puede separarse una relectura del mismo lote antes de
 * que valga la pena mirarla. Dos personas midiendo el mismo bote nunca dan idéntico.
 */
export const TOLERANCIAS = {
    ph: 0.3,
    solidos: 0.5,   // puntos porcentuales sobre el promedio de M1/M2
}

export type ResultadoLote = 'PENDIENTE' | 'COINCIDE' | 'DESVIACION' | 'DISCREPANCIA'

/** 🟢 coincide · 🟡 mismo veredicto pero Δ fuera de tolerancia · 🔴 el veredicto cambia */
export type NivelParametro = 'ok' | 'desviacion' | 'discrepancia' | 'na'

export type ComparacionParametro = {
    nombre: string
    clave: 'ph' | 'solidos' | 'apariencia' | 'color' | 'aroma'
    valorOperador: string
    valorCalidad: string
    delta: number | null
    veredictoOperador: ConformityLevel | null
    veredictoCalidad: ConformityLevel | null
    nivel: NivelParametro
}

export type Comparacion = {
    resultado: ResultadoLote
    parametros: ComparacionParametro[]
    parametrosAfectados: string[]
}

/** Campos de medición, tal como los usan la bitácora y `analyzeRecord`. */
export type Mediciones = {
    ph?: number | string | null
    solidos_medicion_1?: number | string | null
    solidos_medicion_2?: number | string | null
    apariencia?: string | null
    color?: string | null
    aroma?: string | null
}

/**
 * Normaliza a número o null.
 *
 * Importa más de lo que parece: `analyzeRecord` comprueba `record.ph !== null`,
 * así que un `undefined` pasaría el filtro y luego fallaría toda comparación
 * numérica, marcando el pH como no-conforme sin que nadie lo haya medido.
 */
export function num(valor: unknown): number | null {
    if (valor === null || valor === undefined || valor === '') return null
    const n = typeof valor === 'number' ? valor : parseFloat(String(valor))
    return isNaN(n) ? null : n
}

/** Promedio de las dos mediciones de sólidos, con el mismo criterio de `analyzeRecord`. */
export function promedioSolidos(m1: unknown, m2: unknown): number | null {
    const a = num(m1)
    const b = num(m2)
    if (a !== null && b !== null) return (a + b) / 2
    if (a !== null) return a
    return null
}

/** Deja el registro listo para `analyzeRecord`, con nulls explícitos. */
function paraAnalizar(codigo: string, m: Mediciones) {
    return {
        codigo_producto: codigo,
        ph: num(m.ph),
        solidos_medicion_1: num(m.solidos_medicion_1),
        solidos_medicion_2: num(m.solidos_medicion_2),
        apariencia: m.apariencia || null,
        tamano_lote: 0,
    }
}

const texto = (v: unknown): string => {
    const s = v === null || v === undefined ? '' : String(v).trim()
    return s === '' ? '—' : s
}

const numeroTexto = (v: number | null, decimales = 2): string =>
    v === null ? '—' : v.toFixed(decimales)

/**
 * Compara la medición del operador contra la de Calidad para un mismo lote.
 *
 * Analiza ambos lados por separado con `analyzeRecord` y contrasta parámetro por
 * parámetro. No usa `analysis.overallStatus`: en `analysis-utils.ts` ese campo es
 * únicamente el estado de sólidos, así que un cambio de veredicto en pH o
 * apariencia pasaría desapercibido.
 */
export function compararMediciones(
    codigo: string,
    operador: Mediciones,
    calidad: Mediciones
): Comparacion {
    const aplica = PARAMETER_APPLICABILITY[codigo] || { solidos: false, ph: false }
    const esperaApariencia = Boolean(APPEARANCE_STANDARDS[codigo])

    const aOp = analyzeRecord(paraAnalizar(codigo, operador)).analysis
    const aCal = analyzeRecord(paraAnalizar(codigo, calidad)).analysis

    const parametros: ComparacionParametro[] = []

    // Decide el nivel de un parámetro a partir de ambos veredictos y la diferencia.
    const evaluar = (
        vOp: ConformityLevel,
        vCal: ConformityLevel,
        delta: number | null,
        tolerancia: number | null
    ): NivelParametro => {
        // Sin medición de Calidad todavía: no hay nada que comparar.
        if (vCal === 'na' && delta === null) return 'na'
        if (vOp !== vCal) return 'discrepancia'
        if (delta !== null && tolerancia !== null && Math.abs(delta) > tolerancia) return 'desviacion'
        return 'ok'
    }

    // --- pH ---
    if (aplica.ph) {
        const op = num(operador.ph)
        const cal = num(calidad.ph)
        const delta = op !== null && cal !== null ? cal - op : null
        parametros.push({
            nombre: 'pH',
            clave: 'ph',
            valorOperador: numeroTexto(op, 1),
            valorCalidad: numeroTexto(cal, 1),
            delta,
            veredictoOperador: aOp.phStatus,
            veredictoCalidad: aCal.phStatus,
            nivel: cal === null ? 'na' : evaluar(aOp.phStatus, aCal.phStatus, delta, TOLERANCIAS.ph),
        })
    }

    // --- Sólidos (se compara el promedio, que es lo que evalúa el estándar) ---
    if (aplica.solidos) {
        const op = promedioSolidos(operador.solidos_medicion_1, operador.solidos_medicion_2)
        const cal = promedioSolidos(calidad.solidos_medicion_1, calidad.solidos_medicion_2)
        const delta = op !== null && cal !== null ? cal - op : null
        parametros.push({
            nombre: 'Sólidos',
            clave: 'solidos',
            valorOperador: numeroTexto(op),
            valorCalidad: numeroTexto(cal),
            delta,
            veredictoOperador: aOp.solidsStatus,
            veredictoCalidad: aCal.solidsStatus,
            nivel: cal === null ? 'na' : evaluar(aOp.solidsStatus, aCal.solidsStatus, delta, TOLERANCIAS.solidos),
        })
    }

    // --- Apariencia ---
    if (esperaApariencia) {
        const op = operador.apariencia || null
        const cal = calidad.apariencia || null
        parametros.push({
            nombre: 'Apariencia',
            clave: 'apariencia',
            valorOperador: texto(op),
            valorCalidad: texto(cal),
            delta: null,
            veredictoOperador: aOp.appearanceStatus,
            veredictoCalidad: aCal.appearanceStatus,
            nivel: !cal ? 'na' : evaluar(aOp.appearanceStatus, aCal.appearanceStatus, null, null),
        })
    }

    // --- Color y aroma: categóricos, se comparan directo ---
    for (const [clave, nombre] of [['color', 'Color'], ['aroma', 'Aroma']] as const) {
        const op = (operador[clave] || '').toString().toUpperCase() || null
        const cal = (calidad[clave] || '').toString().toUpperCase() || null
        parametros.push({
            nombre,
            clave,
            valorOperador: texto(operador[clave]),
            valorCalidad: texto(calidad[clave]),
            delta: null,
            veredictoOperador: null,
            veredictoCalidad: null,
            nivel: !cal ? 'na' : (op === cal ? 'ok' : 'discrepancia'),
        })
    }

    // El lote vale lo que su peor parámetro.
    const evaluados = parametros.filter(p => p.nivel !== 'na')
    const parametrosAfectados = parametros
        .filter(p => p.nivel === 'discrepancia' || p.nivel === 'desviacion')
        .map(p => p.clave)

    let resultado: ResultadoLote = 'PENDIENTE'
    if (evaluados.length > 0) {
        if (evaluados.some(p => p.nivel === 'discrepancia')) resultado = 'DISCREPANCIA'
        else if (evaluados.some(p => p.nivel === 'desviacion')) resultado = 'DESVIACION'
        else resultado = 'COINCIDE'
    }

    return { resultado, parametros, parametrosAfectados }
}

// ============================================================
// Presentación
// ============================================================

export const COLOR_RESULTADO: Record<ResultadoLote, { bg: string, text: string, label: string }> = {
    PENDIENTE:    { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-500 dark:text-slate-400', label: 'Sin medir' },
    COINCIDE:     { bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-400', label: 'Coincide' },
    DESVIACION:   { bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-400', label: 'Desviación' },
    DISCREPANCIA: { bg: 'bg-red-100 dark:bg-red-900/40', text: 'text-red-700 dark:text-red-400', label: 'Discrepancia' },
}

/** Colores planos para el PDF, donde no hay Tailwind ni tema oscuro. */
export const COLOR_RESULTADO_PDF: Record<ResultadoLote, { bg: string, fg: string, label: string }> = {
    PENDIENTE:    { bg: '#f1f5f9', fg: '#64748b', label: 'Sin medir' },
    COINCIDE:     { bg: '#d1fae5', fg: '#047857', label: 'Coincide' },
    DESVIACION:   { bg: '#fef3c7', fg: '#b45309', label: 'Desviación' },
    DISCREPANCIA: { bg: '#fee2e2', fg: '#b91c1c', label: 'Discrepancia' },
}

export const ETIQUETA_VEREDICTO: Record<ConformityLevel, string> = {
    'conforme': 'conforme',
    'semi-conforme': 'tolerancia',
    'no-conforme': 'no conforme',
    'na': 'n/a',
}

/**
 * Porcentaje de lotes con discrepancia. Devuelve también `n` porque con pocos
 * lotes auditados el porcentaje engaña: 1 de 3 es 33% y no significa nada.
 */
export function tasaDiscrepancia(lotes: { resultado: ResultadoLote }[]): { pct: number, n: number, confiable: boolean } {
    const evaluados = lotes.filter(l => l.resultado !== 'PENDIENTE')
    const n = evaluados.length
    const rojos = evaluados.filter(l => l.resultado === 'DISCREPANCIA').length
    return {
        pct: n > 0 ? (rojos / n) * 100 : 0,
        n,
        confiable: n >= 5,
    }
}
