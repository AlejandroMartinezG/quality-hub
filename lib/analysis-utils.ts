"use client"

import { PRODUCT_STANDARDS, PH_STANDARDS, APPEARANCE_STANDARDS } from "@/lib/production-constants"

// Definir tipos para los resultados de análisis
export type ConformityLevel = 'conforme' | 'semi-conforme' | 'no-conforme' | 'na'

export type AnalysisResult = {
    isConform: boolean
    failedParams: string[] // 'ph', 'solidos', 'apariencia', 'color', 'aroma'
    phStatus: ConformityLevel
    solidsStatus: ConformityLevel
    appearanceStatus: ConformityLevel
    overallStatus: ConformityLevel
}

export type EnrichedRecord = {
    id: number
    lote_producto: string
    codigo_producto: string
    sucursal: string
    familia_producto: string
    fecha_fabricacion: string
    ph: number | null
    solidos_medicion_1: number | null
    solidos_medicion_2: number | null
    solidos_promedio: number | null
    apariencia: string
    analysis: AnalysisResult
    tamano_lote: number
}

export const analyzeRecord = (record: any): EnrichedRecord => {
    const stdSolids = PRODUCT_STANDARDS[record.codigo_producto]
    const stdPH = PH_STANDARDS[record.codigo_producto]
    const stdApp = APPEARANCE_STANDARDS[record.codigo_producto]

    // Parse batch size (it might be a string in DB)
    const lotSize = record.tamano_lote ? parseFloat(record.tamano_lote.toString()) : 0

    let avgSolids: number | null = null
    if (record.solidos_medicion_1 !== null && record.solidos_medicion_2 !== null) {
        avgSolids = (record.solidos_medicion_1 + record.solidos_medicion_2) / 2
    } else if (record.solidos_medicion_1 !== null) {
        avgSolids = record.solidos_medicion_1
    }

    const failedParams: string[] = []

    // ========== CONTROL CHART LOGIC FOR SÓLIDOS ==========
    // Red lines (specification limits): min and max from PRODUCT_STANDARDS
    // Yellow lines (tolerance limits): min*0.95 and max*1.05 (5% relative error)
    let solidsStatus: ConformityLevel = 'na'
    if (avgSolids !== null && stdSolids && stdSolids.min !== undefined && stdSolids.max !== undefined) {
        const specMin = stdSolids.min  // Red line (lower)
        const specMax = stdSolids.max  // Red line (upper)
        const warnMin = specMin * 0.95 // Yellow line (lower) - 5% tolerance
        const warnMax = specMax * 1.05 // Yellow line (upper) - 5% tolerance

        if (avgSolids >= specMin && avgSolids <= specMax) {
            // Between red lines = CONFORME
            solidsStatus = 'conforme'
        } else if ((avgSolids >= warnMin && avgSolids < specMin) || (avgSolids > specMax && avgSolids <= warnMax)) {
            // Between red and yellow lines = SEMI-CONFORME
            solidsStatus = 'semi-conforme'
            failedParams.push('solidos')
        } else {
            // Outside yellow lines = NO CONFORME
            solidsStatus = 'no-conforme'
            failedParams.push('solidos')
        }
    }

    // ========== pH ANALYSIS (keeping simple pass/fail for now) ==========
    let phStatus: ConformityLevel = 'na'
    if (record.ph !== null && stdPH) {
        if (record.ph >= stdPH.min && record.ph <= stdPH.max) {
            phStatus = 'conforme'
        } else {
            phStatus = 'no-conforme'
            failedParams.push('ph')
        }
    }

    // ========== APPEARANCE ANALYSIS (keeping simple pass/fail) ==========
    let appearanceStatus: ConformityLevel = 'na'
    if (record.apariencia && stdApp) {
        // Simple string includes check, ignoring case
        if (record.apariencia.toLowerCase().includes(stdApp.toLowerCase()) || stdApp.toLowerCase().includes(record.apariencia.toLowerCase())) {
            appearanceStatus = 'conforme'
        } else {
            // Check for specific synonyms if needed, otherwise fail
            if (record.apariencia.toUpperCase() === stdApp.toUpperCase()) {
                appearanceStatus = 'conforme'
            } else {
                appearanceStatus = 'no-conforme'
                failedParams.push('apariencia')
            }
        }
    }

    // ========== OVERALL CONFORMITY ==========
    // For now, focusing only on sólidos as per user request
    // Overall status is determined by the worst status among all checked parameters
    const getWorstStatus = (statuses: ConformityLevel[]): ConformityLevel => {
        const activeStatuses = statuses.filter(s => s !== 'na')
        if (activeStatuses.length === 0) return 'na'
        if (activeStatuses.includes('no-conforme')) return 'no-conforme'
        if (activeStatuses.includes('semi-conforme')) return 'semi-conforme'
        return 'conforme'
    }

    // For now, only considering sólidos for overall status
    const overallStatus = solidsStatus

    // Legacy isConform for backward compatibility
    const isConform = overallStatus === 'conforme'

    return {
        ...record,
        solidos_promedio: avgSolids,
        tamano_lote: lotSize,
        analysis: {
            isConform,
            failedParams,
            phStatus,
            solidsStatus,
            appearanceStatus,
            overallStatus
        }
    }
}
