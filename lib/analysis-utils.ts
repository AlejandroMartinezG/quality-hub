"use client"

import { PRODUCT_STANDARDS, PH_STANDARDS, APPEARANCE_STANDARDS } from "@/lib/production-constants"

// Definir tipos para los resultados de análisis
export type AnalysisResult = {
    isConform: boolean
    failedParams: string[] // 'ph', 'solidos', 'apariencia', 'color', 'aroma'
    phStatus: 'ok' | 'fail' | 'na'
    solidsStatus: 'ok' | 'fail' | 'na'
    appearanceStatus: 'ok' | 'fail' | 'na'
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

    // 1. Analyze pH
    let phStatus: 'ok' | 'fail' | 'na' = 'na'
    if (record.ph !== null && stdPH) {
        if (record.ph >= stdPH.min && record.ph <= stdPH.max) {
            phStatus = 'ok'
        } else {
            phStatus = 'fail'
            failedParams.push('ph')
        }
    }

    // 2. Analyze Solids (using tolerance limits same as Quality Table)
    let solidsStatus: 'ok' | 'fail' | 'na' = 'na'
    if (avgSolids !== null && stdSolids && stdSolids.min !== undefined && stdSolids.max !== undefined) {
        const minTol = stdSolids.min * 0.95
        const maxTol = stdSolids.max * 1.05
        if (avgSolids >= minTol && avgSolids <= maxTol) {
            solidsStatus = 'ok'
        } else {
            solidsStatus = 'fail'
            failedParams.push('solidos')
        }
    }

    // 3. Analyze Appearance
    let appearanceStatus: 'ok' | 'fail' | 'na' = 'na'
    if (record.apariencia && stdApp) {
        // Simple string includes check, ignoring case
        if (record.apariencia.toLowerCase().includes(stdApp.toLowerCase()) || stdApp.toLowerCase().includes(record.apariencia.toLowerCase())) {
            appearanceStatus = 'ok'
        } else {
            // Check for specific synonyms if needed, otherwise fail
            // Assuming strict match isn't required but logical match is. 
            // For now, if the recorded appearance name matches the standard name roughly
            if (record.apariencia === stdApp) {
                appearanceStatus = 'ok'
            } else {
                // Creating a lenient check based on current data patterns
                // e.g., Standard "CRISTALINO" vs Record "CRISTALINO"
                if (record.apariencia.toUpperCase() === stdApp.toUpperCase()) {
                    appearanceStatus = 'ok'
                } else {
                    appearanceStatus = 'fail'
                    failedParams.push('apariencia')
                }
            }
        }
    }

    // Assuming Color and Aroma are always OK if present for now unless we have standards
    // The user mentioned "Pareto por defectos", including color and aroma.
    // If we don't have standards for them, we can filter by specific "No Conforme" flags if they existed in DB, 
    // but looking at the table structure, we only have the values.
    // We will assume "characteristic" values are passed as OK.

    // Final Conformity
    // Success if NO failures in checked params
    const isConform = failedParams.length === 0

    return {
        ...record,
        solidos_promedio: avgSolids,
        tamano_lote: lotSize,
        analysis: {
            isConform,
            failedParams,
            phStatus,
            solidsStatus,
            appearanceStatus
        }
    }
}
