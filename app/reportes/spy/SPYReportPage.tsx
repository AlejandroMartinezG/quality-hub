'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    LineChart,
    Line,
    ReferenceLine,
    ComposedChart,
    RadarChart,
    Radar,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    Cell
} from 'recharts'
import {
    Activity,
    Package,
    Box,
    TrendingUp,
    CheckCircle2,
    Factory,
    Scale,
    Printer,
    AlertCircle,
    XCircle,
    Filter,
    Info
} from 'lucide-react'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { DateRangeModal } from '@/components/DateRangeModal'
import { PrintReportWrapper } from '@/components/PrintReportWrapper'
import { PRODUCT_STANDARDS, PH_STANDARDS, SUCURSALES } from "@/lib/production-constants"

// Definir constante local para las familias que se tratan como piezas
const PIECE_FAMILIES = ["Bases aromatizante ambiental", "Bases limpiadores liquidos multiusos", "Bases Aromatizantes"];

interface SPYReportPageProps {
    records: any[];
    profile?: any;
}

export default function SPYReportPage({ records = [], profile }: SPYReportPageProps) {
    const [showPrintModal, setShowPrintModal] = useState(false)
    const [printView, setPrintView] = useState<{ dateFrom: string, dateTo: string } | null>(null)

    // ─── FILTROS INTERNOS ────────────────────────────────────────────
    const [filterSucursal, setFilterSucursal] = useState("all")
    const [filterProduct, setFilterProduct] = useState("all")
    const [filterPeriod, setFilterPeriod] = useState("all")

    const role = (profile?.role || '').toLowerCase()
    const showSucursalFilter = role === 'admin' || role === 'gerente_calidad'

    const uniqueProducts = useMemo(() =>
        (Array.from(new Set(records.map((r: any) => r.codigo_producto).filter(Boolean))) as string[]).sort()
    , [records])

    const spyRecords = useMemo(() => {
        const now = new Date()
        let dateThreshold: Date | null = null
        switch (filterPeriod) {
            case '7d':  dateThreshold = new Date(now.getTime() - 7   * 86400000); break
            case '30d': dateThreshold = new Date(now.getTime() - 30  * 86400000); break
            case '3m':  dateThreshold = new Date(now.getTime() - 90  * 86400000); break
            case '6m':  dateThreshold = new Date(now.getTime() - 180 * 86400000); break
            case '1y':  dateThreshold = new Date(now.getTime() - 365 * 86400000); break
        }
        return records.filter((r: any) => {
            if (filterSucursal !== 'all' && r.sucursal !== filterSucursal) return false
            if (filterProduct !== 'all' && r.codigo_producto !== filterProduct) return false
            if (dateThreshold && r.fecha_fabricacion && new Date(r.fecha_fabricacion) < dateThreshold) return false
            return true
        })
    }, [records, filterSucursal, filterProduct, filterPeriod])

    // ─── A. CÁLCULO DE VOLÚMENES Y REGISTROS ─────────────────────────
    const stats = useMemo(() => {
        let totalVolumeProducts = 0
        let totalPiecesBases = 0
        let totalNCRs = 0
        let ftqVolume = 0
        let noConformeVolume = 0
        let affectedVolume = 0

        let conformesPH = 0
        let noConformesPH = 0
        let conformesPHLiters = 0
        let noConformesPHLiters = 0

        let conformesSolids = 0
        let warningSolids = 0
        let noConformesSolids = 0
        let conformesSolidsLiters = 0
        let warningSolidsLiters = 0
        let noConformesSolidsLiters = 0

        spyRecords.forEach(r => {
            const isPiece = PIECE_FAMILIES.includes(r.familia_producto || '')
            const val = Number(r.tamano_lote) || 0
            const vol = isPiece ? (val * 20) : val

            if (isPiece) {
                totalPiecesBases += val
            } else {
                totalVolumeProducts += val
            }

            // --- Cálculos de conformidad y afectación para FTQ y Yield ---
            // Lógica solicitada:
            // - FTQ = bien bien en todos los parámetros.
            // - Afectado = cualquier desviación de calidad (incluyendo solidos semi-conforme/ warning y no-conforme, ph no-conforme, apariencia no-conforme).
            // - Yield = descuenta únicamente los lotes calificados analíticamente como "No Conforme" totales (excluye los semi-conformes).

            const phStat = r.analysis?.phStatus || 'na'
            const solidsStat = r.analysis?.solidsStatus || 'na'
            const appStat = r.analysis?.appearanceStatus || 'na'

            const solidsConforme = solidsStat === 'conforme' || solidsStat === 'na'
            const phConforme = phStat === 'conforme' || phStat === 'na'
            const appConforme = appStat === 'conforme' || appStat === 'na'

            // FTQ: Perfecto a la primera
            const isFTQ = solidsConforme && phConforme && appConforme

            if (isFTQ) {
                ftqVolume += vol
            } else {
                affectedVolume += vol
                totalNCRs++
            }

            // Final Yield: Descuenta los "no-conforme" totales de cualquiera de los parámetros
            const isSolidsNoConforme = solidsStat === 'no-conforme'
            const isPHNoConforme = phStat === 'no-conforme'
            const isAppearanceNoConforme = appStat === 'no-conforme'
            const isNoConformeTotal = isSolidsNoConforme || isPHNoConforme || isAppearanceNoConforme

            if (isNoConformeTotal) {
                noConformeVolume += vol
            }

            // --- Estadísticas individuales para pH ---
            if (phStat === 'conforme') {
                conformesPH++
                conformesPHLiters += vol
            } else if (phStat === 'no-conforme') {
                noConformesPH++
                noConformesPHLiters += vol
            }

            // --- Estadísticas individuales para Sólidos ---
            if (solidsStat === 'conforme') {
                conformesSolids++
                conformesSolidsLiters += vol
            } else if (solidsStat === 'semi-conforme') {
                warningSolids++
                warningSolidsLiters += vol
            } else if (solidsStat === 'no-conforme') {
                noConformesSolids++
                noConformesSolidsLiters += vol
            }
        })

        const totalVolumeBases = totalPiecesBases * 20
        const totalVolumeUnified = totalVolumeProducts + totalVolumeBases

        const ftqPercent = totalVolumeUnified > 0 ? (ftqVolume / totalVolumeUnified) * 100 : 100
        const finalYieldPercent = totalVolumeUnified > 0 ? ((totalVolumeUnified - noConformeVolume) / totalVolumeUnified) * 100 : 100

        return {
            totalVolumeProducts,
            totalPiecesBases,
            totalVolumeBases,
            totalVolumeUnified,
            ftqVolume,
            noConformeVolume,
            affectedVolume,
            totalNCRs,
            ftqPercent,
            finalYieldPercent,
            conformesPH,
            noConformesPH,
            conformesPHLiters,
            noConformesPHLiters,
            conformesSolids,
            warningSolids,
            noConformesSolids,
            conformesSolidsLiters,
            warningSolidsLiters,
            noConformesSolidsLiters
        }
    }, [spyRecords])

    // ─── B. DEDUCCIÓN AUTOMÁTICA DE PRODUCTO Y ESTÁNDARES ──────────
    const { selectedProductCode, currentStandards, canvasSolids, canvasPH, controlChartData } = useMemo(() => {
        const uniqueFilteredProducts = Array.from(new Set(spyRecords.map(r => r.codigo_producto).filter(Boolean)))
        const productCode = uniqueFilteredProducts.length === 1 ? uniqueFilteredProducts[0] : "all"

        const standards = productCode !== "all" ? {
            ph: PH_STANDARDS[productCode],
            solids: PRODUCT_STANDARDS[productCode]
        } : null

        const chartData = spyRecords.map((r, i) => ({
            index: i + 1,
            lote: r.lote_producto,
            ph: r.ph,
            solidos: r.solidos_promedio,
        }))

        // Cálculo de canvasSolids dinámico
        let solidsDomain: [string | number, string | number] = ['auto', 'auto']
        if (standards?.solids) {
            const dataValues = chartData.map(d => d.solidos).filter(v => v !== null && v !== undefined) as number[]
            const limits = [
                (standards.solids.min || 0) * 0.95,
                (standards.solids.max || 100) * 1.05,
                (standards.solids.min || 0),
                (standards.solids.max || 100)
            ]
            const allValues = [...dataValues, ...limits]
            if (allValues.length > 0) {
                const min = Math.min(...allValues)
                const max = Math.max(...allValues)
                const padding = (max - min) * 0.05
                solidsDomain = [parseFloat((min - padding).toFixed(2)), parseFloat((max + padding).toFixed(2))]
            }
        }

        // Cálculo de canvasPH dinámico
        let phDomain: [string | number, string | number] = ['auto', 'auto']
        if (standards?.ph) {
            const dataValues = chartData.map(d => d.ph).filter(v => v !== null && v !== undefined) as number[]
            const limits = [standards.ph.min, standards.ph.max]
            const allValues = [...dataValues, ...limits]
            if (allValues.length > 0) {
                const min = Math.min(...allValues)
                const max = Math.max(...allValues)
                phDomain = [parseFloat((min - 0.5).toFixed(1)), parseFloat((max + 0.5).toFixed(1))]
            }
        }

        return {
            selectedProductCode: productCode,
            currentStandards: standards,
            canvasSolids: solidsDomain,
            canvasPH: phDomain,
            controlChartData: chartData
        }
    }, [spyRecords])

    // ─── C. DATOS PARA GRÁFICOS (PARETO, RADIAL, SUCURSAL) ───────────
    const chartsData = useMemo(() => {
        const defects = { ph: 0, solidos: 0, apariencia: 0 }

        spyRecords.forEach(r => {
            const isPiece = PIECE_FAMILIES.includes(r.familia_producto || '')
            const val = Number(r.tamano_lote) || 0
            const vol = isPiece ? (val * 20) : val
            const weight = vol

            if (r.analysis?.phStatus === 'no-conforme') {
                defects.ph += weight
            }
            if (r.analysis?.solidsStatus === 'semi-conforme' || r.analysis?.solidsStatus === 'no-conforme') {
                defects.solidos += weight
            }
            if (r.analysis?.appearanceStatus === 'no-conforme') {
                defects.apariencia += weight
            }
        })

        const paretoRaw = [
            { name: "Sólidos", count: defects.solidos },
            { name: "pH", count: defects.ph },
            { name: "Apariencia", count: defects.apariencia },
        ].sort((a, b) => b.count - a.count)

        let accum = 0
        const totalDef = paretoRaw.reduce((sum, item) => sum + item.count, 0)
        const paretoData = paretoRaw.map(item => {
            accum += item.count
            return {
                ...item,
                accumulatedPercent: totalDef > 0 ? Math.round((accum / totalDef) * 100) : 0
            }
        })

        // Radar chart
        const radarData = [
            { param: "pH", count: spyRecords.filter(r => r.analysis?.phStatus === 'no-conforme').length },
            { param: "Sólidos", count: spyRecords.filter(r => r.analysis?.solidsStatus === 'semi-conforme' || r.analysis?.solidsStatus === 'no-conforme').length },
            { param: "Apariencia", count: spyRecords.filter(r => r.analysis?.appearanceStatus === 'no-conforme').length },
        ]

        // Sucursal breakdown
        const groupedSucursal: Record<string, { name: string, conformes: number, semiConformes: number, noConformes: number }> = {}
        spyRecords.forEach(r => {
            const suc = r.sucursal || "Sin Sucursal"
            if (!groupedSucursal[suc]) {
                groupedSucursal[suc] = { name: suc, conformes: 0, semiConformes: 0, noConformes: 0 }
            }

            const overall = r.analysis?.overallStatus || 'na'
            if (overall === 'conforme') {
                groupedSucursal[suc].conformes++
            } else if (overall === 'semi-conforme') {
                groupedSucursal[suc].semiConformes++
            } else if (overall === 'no-conforme') {
                groupedSucursal[suc].noConformes++
            }
        })

        const sucursalData = Object.values(groupedSucursal).sort((a, b) => 
            (b.conformes + b.semiConformes + b.noConformes) - (a.conformes + a.semiConformes + a.noConformes)
        )

        return {
            paretoData,
            radarData,
            sucursalData
        }
    }, [spyRecords])

    const printInsights = useMemo(() => {
        type InsightLevel = 'ok' | 'warn' | 'critical'
        const insights: { level: InsightLevel; text: string }[] = []
        if (spyRecords.length === 0) return insights

        const ftq = stats.ftqPercent
        const yld = stats.finalYieldPercent
        const totalAnalyzedSolids = stats.conformesSolids + stats.warningSolids + stats.noConformesSolids
        const totalAnalyzedPH = stats.conformesPH + stats.noConformesPH

        // 1. FTQ global
        if (ftq >= 95) {
            insights.push({ level: 'ok', text: `El índice FTQ de ${ftq.toFixed(1)}% es excelente — prácticamente toda la producción del período cumplió los parámetros de calidad a la primera.` })
        } else if (ftq >= 85) {
            insights.push({ level: 'warn', text: `El índice FTQ de ${ftq.toFixed(1)}% es aceptable pero tiene margen de mejora. Aproximadamente 1 de cada ${Math.round(100 / Math.max(100 - ftq, 1))} lotes presentó alguna desviación.` })
        } else if (ftq >= 70) {
            insights.push({ level: 'warn', text: `El índice FTQ de ${ftq.toFixed(1)}% está por debajo del objetivo recomendado (≥ 85%). Se recomienda revisar los procesos de formulación y control del período analizado.` })
        } else {
            insights.push({ level: 'critical', text: `El índice FTQ de ${ftq.toFixed(1)}% es crítico. Más del 30% de los lotes presentaron desviaciones. Se requiere análisis de causas raíz y acciones correctivas inmediatas.` })
        }

        // 2. Brecha FTQ vs Yield
        const gap = yld - ftq
        if (gap > 10) {
            insights.push({ level: 'warn', text: `Existe una brecha de ${gap.toFixed(1)} pp entre FTQ y Yield (${ftq.toFixed(1)}% vs ${yld.toFixed(1)}%). Indica un volumen considerable de lotes semi-conformes liberables que operan cerca del límite de especificación.` })
        }

        // 3. Parámetro dominante (Pareto)
        const topDefect = chartsData.paretoData.find(d => d.count > 0)
        if (topDefect) {
            const totalDef = chartsData.paretoData.reduce((s, d) => s + d.count, 0)
            const pct = totalDef > 0 ? Math.round((topDefect.count / totalDef) * 100) : 0
            insights.push({ level: pct >= 70 ? 'warn' : 'ok', text: `El parámetro con mayor impacto en las desviaciones es ${topDefect.name} (${pct}% del volumen afectado). Concentrar los esfuerzos de mejora en este parámetro ofrece el mayor retorno.` })
        }

        // 4. Riesgo por semi-conformes en Sólidos
        const semiPct = totalAnalyzedSolids > 0 ? (stats.warningSolids / totalAnalyzedSolids) * 100 : 0
        if (semiPct > 20) {
            insights.push({ level: 'warn', text: `${semiPct.toFixed(1)}% de los lotes analizados en Sólidos se encuentra en zona semi-conforme (±5% de tolerancia). Cualquier variación adicional podría generar no conformidades.` })
        }

        // 5. pH vs Sólidos
        const phFailPct = totalAnalyzedPH > 0 ? (stats.noConformesPH / totalAnalyzedPH) * 100 : 0
        const solidsFailPct = totalAnalyzedSolids > 0 ? ((stats.warningSolids + stats.noConformesSolids) / totalAnalyzedSolids) * 100 : 0
        if (phFailPct > solidsFailPct && phFailPct > 5) {
            insights.push({ level: 'warn', text: `El pH presenta mayor tasa de desviación (${phFailPct.toFixed(1)}%) que los Sólidos (${solidsFailPct.toFixed(1)}%). Se recomienda revisar condiciones de proceso y el balance ácido-base de las formulaciones.` })
        } else if (solidsFailPct > phFailPct && solidsFailPct > 5) {
            insights.push({ level: 'warn', text: `Los Sólidos presentan mayor tasa de desviación (${solidsFailPct.toFixed(1)}%) que el pH (${phFailPct.toFixed(1)}%). Verificar la precisión en el pesaje de materias primas y los tiempos de mezcla.` })
        }

        // 6. Sucursal con mayor incidencia
        const worstSuc = [...chartsData.sucursalData]
            .filter(s => s.noConformes > 0)
            .sort((a, b) => b.noConformes - a.noConformes)[0]
        if (worstSuc) {
            const tot = worstSuc.conformes + worstSuc.semiConformes + worstSuc.noConformes
            const failPct = tot > 0 ? Math.round((worstSuc.noConformes / tot) * 100) : 0
            insights.push({ level: failPct > 20 ? 'critical' : 'warn', text: `La sucursal con mayor incidencia de No Conformidades es ${worstSuc.name} (${worstSuc.noConformes} lote${worstSuc.noConformes !== 1 ? 's' : ''} no conforme${worstSuc.noConformes !== 1 ? 's' : ''}, ${failPct}% de sus registros en el período).` })
        }

        // 7. NCRs totales
        if (stats.totalNCRs > 0) {
            const affectedPct = stats.totalVolumeUnified > 0 ? (stats.affectedVolume / stats.totalVolumeUnified) * 100 : 0
            insights.push({ level: affectedPct > 20 ? 'critical' : 'warn', text: `Se registraron ${stats.totalNCRs} lote${stats.totalNCRs !== 1 ? 's' : ''} con alguna desviación de calidad en el período, representando ${affectedPct.toFixed(1)}% del volumen total producido.` })
        } else {
            insights.push({ level: 'ok', text: `No se registraron desviaciones de calidad en el período analizado. Todos los lotes evaluados cumplieron los parámetros de calidad a la primera.` })
        }

        return insights
    }, [stats, chartsData, spyRecords])

    return (
        <div className="space-y-6">
            
            {/* Cabecera interna de controles rápidos */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50 dark:bg-slate-900 p-4 rounded-[1.5rem] border border-slate-200/60 dark:border-slate-800">
                <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">Visualización Unificada</span>
                </div>

                <div className="flex items-center gap-4">
                    <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full gap-2 text-[#0e0c9b] border-[#0e0c9b]/30 hover:bg-[#0e0c9b]/5"
                        onClick={() => setShowPrintModal(true)}
                    >
                        <Printer className="h-4 w-4" />
                        Imprimir Calidad
                    </Button>
                </div>
            </div>

            {/* ─── FILA 1: CARDS DE KPIS PREMIUM ────────────────────────────── */}
            <div className="space-y-4">
                
                {/* 1. Card Volumen Total - Horizontal, Ancho Completo */}
                <Card className="border shadow-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-[2rem] overflow-hidden">
                    <CardContent className="p-6">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">

                            {/* Panel Principal */}
                            <div className="flex items-center gap-4 lg:pr-8 lg:border-r border-slate-200 dark:border-slate-700">
                                <div className="p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-[1.2rem] text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/50">
                                    <Factory className="h-8 w-8" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                                        Volumen Total Producido
                                    </p>
                                    <div className="text-4xl font-black mt-1 tracking-tight text-slate-900 dark:text-white flex items-baseline">
                                        {stats.totalVolumeUnified.toLocaleString()}
                                        <span className="text-lg font-bold text-indigo-500 dark:text-indigo-400 ml-1.5">L</span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-0.5">
                                        Consolidado PT + Bases unificadas (×20)
                                    </p>
                                </div>
                            </div>

                            {/* Desglose Segmento 1: Productos Terminados */}
                            <div className="flex-1 flex items-center gap-3">
                                <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                    <Package className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Productos Terminados</p>
                                    <p className="text-xl font-black text-slate-800 dark:text-slate-200 mt-0.5 tracking-tight">
                                        {stats.totalVolumeProducts.toLocaleString()} <span className="text-xs font-semibold text-slate-400">L</span>
                                    </p>
                                </div>
                            </div>

                            {/* Desglose Segmento 2: Bases en Piezas */}
                            <div className="flex-1 flex items-center gap-3">
                                <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                    <Box className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Bases Fabricadas</p>
                                    <p className="text-xl font-black text-slate-800 dark:text-slate-200 mt-0.5 tracking-tight">
                                        {stats.totalPiecesBases.toLocaleString()} <span className="text-xs font-semibold text-slate-400">pzs</span>
                                        <span className="text-xs text-indigo-400 ml-2 font-normal">({stats.totalVolumeBases.toLocaleString()} L eq)</span>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* 2. Cards de Calidad y Yield (FTQ / SPY) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Card FTQ: Calidad a la primera */}
                    <Card className="border shadow-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-[1.8rem] overflow-visible relative transition-all duration-300 hover:shadow-md">
                        <CardContent className="p-6">
                            <div className="pr-10">
                                <p className="text-[10px] font-bold text-green-600 dark:text-green-400 uppercase tracking-widest">
                                    First Time Quality (FTQ)
                                </p>
                                <div className="text-5xl font-black text-slate-900 dark:text-white mt-3 tracking-tight">
                                    {stats.ftqPercent.toFixed(1)}%
                                </div>
                                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">del total producido</p>
                                <p className="text-xs font-bold text-green-600 dark:text-green-400 mt-2.5 flex items-center gap-1">
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    {stats.ftqVolume.toLocaleString()} L bien a la primera
                                </p>
                            </div>
                            <div className="absolute -top-3 -right-3 p-4 bg-green-100 dark:bg-green-900/50 rounded-2xl shadow-lg border-4 border-white dark:border-slate-800">
                                <TrendingUp className="h-10 w-10 text-green-700 dark:text-green-400" />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Card SPY: Final Yield */}
                    <Card className="border shadow-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-[1.8rem] overflow-visible relative transition-all duration-300 hover:shadow-md">
                        <CardContent className="p-6">
                            <div className="pr-10">
                                <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                                    Final Yield (Rendimiento)
                                </p>
                                <div className="text-5xl font-black text-slate-900 dark:text-white mt-3 tracking-tight">
                                    {stats.finalYieldPercent.toFixed(2)}%
                                </div>
                                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">del total producido</p>
                                <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mt-2.5 flex items-center gap-1">
                                    <AlertCircle className="h-3.5 w-3.5" />
                                    {stats.noConformeVolume.toLocaleString()} L descontados del Yield
                                </p>
                            </div>
                            <div className="absolute -top-3 -right-3 p-4 bg-indigo-100 dark:bg-indigo-900/50 rounded-2xl shadow-lg border-4 border-white dark:border-slate-800">
                                <Activity className="h-10 w-10 text-indigo-700 dark:text-indigo-400" />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* ─── FILA 1B: AFECTADOS + DESCUENTO ────────────────────────────── */}
            <div className="grid grid-cols-2 gap-4">
                {/* Litros Afectados (semi + no conformes) */}
                <Card className="border shadow-sm bg-white dark:bg-slate-900 border-amber-200 dark:border-amber-800/40 rounded-[1.4rem] overflow-visible relative">
                    <CardContent className="p-4">
                        <div className="pr-8">
                            <p className="text-[9px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest">Volumen Afectado</p>
                            <p className="text-[9px] text-amber-500/70 dark:text-amber-500/50 leading-tight mb-1">Lotes fuera de FTQ (semi + no conformes)</p>
                            <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                                {stats.affectedVolume.toLocaleString()}
                                <span className="text-base font-bold text-slate-400 dark:text-slate-500 ml-1">L</span>
                            </div>
                            <p className="text-xs font-bold text-amber-600 dark:text-amber-400 mt-1">
                                {stats.totalVolumeUnified > 0 ? (100 - stats.ftqPercent).toFixed(1) : '0.0'}% del total
                                <span className="font-normal text-slate-400 dark:text-slate-500 ml-1">(= 100 − FTQ%)</span>
                            </p>
                        </div>
                        <div className="absolute -top-2.5 -right-2.5 p-3 bg-amber-100 dark:bg-amber-900/40 rounded-xl shadow-md border-4 border-white dark:border-slate-900">
                            <AlertCircle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                        </div>
                    </CardContent>
                </Card>

                {/* Volumen Descontado del Yield (solo no conformes totales) */}
                <Card className="border shadow-sm bg-white dark:bg-slate-900 border-rose-200 dark:border-rose-800/40 rounded-[1.4rem] overflow-visible relative">
                    <CardContent className="p-4">
                        <div className="pr-8">
                            <p className="text-[9px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-widest">Descuento del Yield</p>
                            <p className="text-[9px] text-rose-500/70 dark:text-rose-500/50 leading-tight mb-1">Lotes No Conformes totales (no liberables)</p>
                            <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                                {stats.noConformeVolume.toLocaleString()}
                                <span className="text-base font-bold text-slate-400 dark:text-slate-500 ml-1">L</span>
                            </div>
                            <p className="text-xs font-bold text-rose-600 dark:text-rose-400 mt-1">
                                {stats.totalVolumeUnified > 0 ? (100 - stats.finalYieldPercent).toFixed(1) : '0.0'}% del total
                                <span className="font-normal text-slate-400 dark:text-slate-500 ml-1">(= 100 − Yield%)</span>
                            </p>
                        </div>
                        <div className="absolute -top-2.5 -right-2.5 p-3 bg-rose-100 dark:bg-rose-900/40 rounded-xl shadow-md border-4 border-white dark:border-slate-900">
                            <XCircle className="h-6 w-6 text-rose-600 dark:text-rose-400" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ─── NOTA METODOLÓGICA FTQ / YIELD ─────────────────────────────── */}
            <Card className="border-none shadow-sm rounded-[1.5rem] bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700">
                <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                        <div className="shrink-0 mt-0.5 h-7 w-7 rounded-xl bg-[#0b109f]/10 dark:bg-[#0b109f]/20 flex items-center justify-center">
                            <Info className="h-4 w-4 text-[#0b109f] dark:text-indigo-400" />
                        </div>
                        <div className="w-full space-y-3 text-xs text-slate-600 dark:text-slate-400">
                            <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">¿Cómo se calculan estos porcentajes?</p>

                            {/* FTQ */}
                            <div className="space-y-1">
                                <p className="font-semibold text-green-700 dark:text-green-400">① FTQ — First Time Quality</p>
                                <p>Suma el volumen de los lotes donde <em>todos</em> los parámetros son conformes o sin estándar. Los lotes con cualquier desviación (semi-conforme o no conforme) quedan fuera.</p>
                                <div className="mt-1 font-mono text-[11px] bg-white dark:bg-slate-900 rounded-lg px-3 py-2 border border-slate-200 dark:border-slate-700 space-y-0.5">
                                    <p><span className="text-green-700 dark:text-green-400">FTQ%</span> = Vol. OK ÷ Total = <span className="font-bold">{stats.ftqVolume.toLocaleString()} ÷ {stats.totalVolumeUnified.toLocaleString()} = {stats.ftqPercent.toFixed(1)}%</span></p>
                                    <p><span className="text-amber-600 dark:text-amber-400">Afectados</span> = Total − Vol. OK = <span className="font-bold">{stats.totalVolumeUnified.toLocaleString()} − {stats.ftqVolume.toLocaleString()} = {stats.affectedVolume.toLocaleString()} L</span></p>
                                </div>
                            </div>

                            <div className="border-t border-slate-200 dark:border-slate-700" />

                            {/* Final Yield */}
                            <div className="space-y-1">
                                <p className="font-semibold text-indigo-700 dark:text-indigo-400">② Final Yield — Rendimiento</p>
                                <p>Se recorre cada lote: si <em>cualquier</em> parámetro es No Conforme (fuera de tolerancia ±5%), su volumen se acumula como descuento. Los semi-conformes no entran. Al final se divide lo que queda entre el total.</p>
                                <div className="mt-1 font-mono text-[11px] bg-white dark:bg-slate-900 rounded-lg px-3 py-2 border border-slate-200 dark:border-slate-700 space-y-0.5">
                                    <p className="text-slate-500 font-sans">Paso 1 — sumar volumen de lotes con ≥1 parámetro No Conforme:</p>
                                    <p><span className="text-rose-600 dark:text-rose-400">Descuento</span> = {stats.noConformeVolume.toLocaleString()} L <span className="text-slate-400">(acumulado lote a lote)</span></p>
                                    <p className="text-slate-500 font-sans pt-0.5">Paso 2 — calcular el porcentaje apto:</p>
                                    <p><span className="text-indigo-700 dark:text-indigo-400">Yield%</span> = (Total − Descuento) ÷ Total = ({stats.totalVolumeUnified.toLocaleString()} − {stats.noConformeVolume.toLocaleString()}) ÷ {stats.totalVolumeUnified.toLocaleString()} = <span className="font-bold">{stats.finalYieldPercent.toFixed(2)}%</span></p>
                                </div>
                            </div>

                            <div className="border-t border-slate-200 dark:border-slate-700" />

                            {/* Diferencia */}
                            <div className="space-y-0.5">
                                <p className="font-semibold text-amber-700 dark:text-amber-400">③ Afectados vs. Descuento</p>
                                <p>Los <span className="font-semibold">{stats.affectedVolume.toLocaleString()} L afectados</span> = semi-conformes + no conformes (todo lo que no fue FTQ). El <span className="font-semibold">descuento del Yield son {stats.noConformeVolume.toLocaleString()} L</span> — solo los estrictamente no conformes. La diferencia (<span className="font-semibold">{(stats.affectedVolume - stats.noConformeVolume).toLocaleString()} L</span>) son los semi-conformes: salieron del FTQ pero se liberan.</p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* ─── FILA 2: PARETO Y RADIAL LADO A LADO ───────────────────────── */}
            <div className="grid gap-6 grid-cols-1 lg:grid-cols-5">
                
                {/* 1. Pareto de Defectos (60%) */}
                <Card className="border-none shadow-sm rounded-[2rem] bg-white dark:bg-slate-900 lg:col-span-3 border border-slate-100 dark:border-slate-800">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-slate-700 dark:text-slate-200 text-lg font-bold">Pareto de Defectos</CardTitle>
                        <CardDescription className="text-xs">
                            Causas de No Conformidad en el período (Fila del 80% en ciruela)
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pb-6 pr-4">
                        <div style={{ width: '100%', height: 320 }}>
                            {chartsData.paretoData.length > 0 && spyRecords.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={chartsData.paretoData} margin={{ top: 20, right: 40, left: 10, bottom: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.2} />
                                        <XAxis
                                            dataKey="name"
                                            tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
                                            axisLine={false}
                                            tickLine={false}
                                        />
                                        <YAxis
                                            yAxisId="vol"
                                            tick={{ fill: '#64748b', fontSize: 11 }}
                                            axisLine={false}
                                            tickLine={false}
                                            tickFormatter={(v) => Number(v).toLocaleString()}
                                            width={45}
                                        />
                                        <YAxis
                                            yAxisId="pct"
                                            orientation="right"
                                            domain={[0, 100]}
                                            tickFormatter={(v) => `${v}%`}
                                            tick={{ fill: '#9c2c7a', fontSize: 11 }}
                                            axisLine={false}
                                            tickLine={false}
                                            ticks={[0, 20, 40, 60, 80, 100]}
                                            width={38}
                                        />
                                        <Tooltip
                                            cursor={{ fill: 'rgba(99, 102, 241, 0.04)' }}
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                                            formatter={((value: any, name: string) => {
                                                if (name === 'accumulatedPercent') return [`${value}%`, '% Acumulado']
                                                return [`${Number(value).toLocaleString()} L`, 'Cantidad']
                                            }) as any}
                                        />
                                        <Bar yAxisId="vol" dataKey="count" fill="#0e0c9b" radius={[6, 6, 0, 0]} maxBarSize={50} />
                                        <Line
                                            yAxisId="pct"
                                            dataKey="accumulatedPercent"
                                            type="monotone"
                                            stroke="#c41f1a"
                                            strokeWidth={2.5}
                                            dot={{ r: 4, fill: '#c41f1a', stroke: '#fff', strokeWidth: 2 }}
                                        />
                                        <ReferenceLine
                                            yAxisId="pct"
                                            y={80}
                                            stroke="#9c2c7a"
                                            strokeWidth={1.5}
                                            strokeDasharray="6 4"
                                            label={{
                                                value: '— 80%',
                                                position: 'insideTopLeft',
                                                fill: '#9c2c7a',
                                                fontSize: 10,
                                                fontWeight: 700,
                                                dy: -8
                                            }}
                                        />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-muted-foreground text-sm flex-col gap-2">
                                    <CheckCircle2 className="h-8 w-8 text-green-400 opacity-50" />
                                    <p>Todos los lotes se produjeron perfectamente</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* 2. Parámetros Críticos Radial Chart (40%) */}
                <Card className="border-none shadow-sm rounded-[2rem] bg-white dark:bg-slate-900 lg:col-span-2 border border-slate-100 dark:border-slate-800">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-slate-700 dark:text-slate-200 text-lg font-bold">Parámetros Críticos</CardTitle>
                        <CardDescription className="text-xs">Frecuencia de fallos analíticos (# NCRs)</CardDescription>
                    </CardHeader>
                    <CardContent className="pb-6 flex justify-center items-center">
                        <div style={{ width: '100%', height: 320 }} className="flex justify-center items-center">
                            {spyRecords.length > 0 && stats.totalNCRs > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <RadarChart data={chartsData.radarData} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
                                        <PolarGrid stroke="#e2e8f0" />
                                        <PolarAngleAxis dataKey="param" tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }} />
                                        <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={{ fill: '#94a3b8', fontSize: 9 }} tickCount={4} />
                                        <Radar name="Fallos" dataKey="count" stroke="#0e0c9b" fill="#6b3ba0" fillOpacity={0.15} strokeWidth={2} />
                                        <Tooltip
                                            formatter={(value: any) => [`${value} lotes`, 'Incidencias']}
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                                        />
                                    </RadarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-muted-foreground text-sm flex-col gap-2">
                                    <CheckCircle2 className="h-8 w-8 text-green-400 opacity-40" />
                                    <p className="text-center px-4">Sin incidencias ni desviaciones de calidad registradas</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ─── FILA 3: CONFORMIDAD POR SUCURSAL ─────────────────────────── */}
            <Card className="border-none shadow-sm rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                <CardHeader>
                    <CardTitle className="text-slate-700 dark:text-slate-200 text-lg font-bold">Conformidad por Sucursal</CardTitle>
                    <CardDescription className="text-xs">Rendimiento y distribución de lotes conformes, semi-conformes y no-conformes por sucursal</CardDescription>
                </CardHeader>
                <CardContent>
                    {chartsData.sucursalData.length > 0 ? (
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartsData.sucursalData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.2} />
                                    <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontWeight: 600 }} />
                                    <YAxis fontSize={11} tickLine={false} axisLine={false} tick={{ fill: '#64748b' }} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                                    />
                                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                                    <Bar dataKey="conformes" name="Conformes" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} />
                                    <Bar dataKey="semiConformes" name="Semi-Conformes" stackId="a" fill="#eab308" radius={[0, 0, 0, 0]} />
                                    <Bar dataKey="noConformes" name="No Conformes" stackId="a" fill="#c41f1a" radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-48 flex items-center justify-center text-slate-400 text-sm">
                            No hay información de sucursales para mostrar.
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ─── FILTROS RÁPIDOS ──────────────────────────────────────────────── */}
            <Card className="border-none shadow-sm rounded-[1.5rem] bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800">
                <CardContent className="p-4">
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 shrink-0">
                            <Filter className="h-4 w-4" />
                            <span className="text-xs font-bold uppercase tracking-wider">Filtros Rápidos:</span>
                        </div>

                        {showSucursalFilter && (
                            <Select value={filterSucursal} onValueChange={setFilterSucursal}>
                                <SelectTrigger className="h-8 w-[175px] text-xs rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                                    <SelectValue placeholder="Ubicación" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas las sucursales</SelectItem>
                                    {SUCURSALES.map(s => (
                                        <SelectItem key={s} value={s}>{s}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}

                        <Select value={filterProduct} onValueChange={setFilterProduct}>
                            <SelectTrigger className="h-8 w-[175px] text-xs rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                                <SelectValue placeholder="Código" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos los códigos</SelectItem>
                                {uniqueProducts.map(p => (
                                    <SelectItem key={p} value={p}>{p}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={filterPeriod} onValueChange={setFilterPeriod}>
                            <SelectTrigger className="h-8 w-[145px] text-xs rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                                <SelectValue placeholder="Período" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todo el período</SelectItem>
                                <SelectItem value="7d">Últimos 7 días</SelectItem>
                                <SelectItem value="30d">Últimos 30 días</SelectItem>
                                <SelectItem value="3m">Últimos 3 meses</SelectItem>
                                <SelectItem value="6m">Últimos 6 meses</SelectItem>
                                <SelectItem value="1y">Último año</SelectItem>
                            </SelectContent>
                        </Select>

                        <span className="ml-auto text-xs text-slate-400 dark:text-slate-500 font-medium shrink-0">
                            {spyRecords.length} registro{spyRecords.length !== 1 ? 's' : ''}
                        </span>
                    </div>
                </CardContent>
            </Card>

            {/* ─── FILA 4: GRÁFICOS DE CONTROL Y CONFORMIDAD DE SÓLIDOS ────────── */}
            <div className="space-y-6">
                
                <div className="border-t border-slate-200/60 dark:border-slate-800 pt-6">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Scale className="h-5 w-5 text-yellow-500" />
                        Control del Porcentaje (%) de Sólidos
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                        Historial analítico del control de sólidos en tiempo real en base a los estándares del catálogo.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Conformes Sólidos */}
                    <Card className="border-none shadow-md bg-green-50 dark:bg-slate-900 rounded-[1.5rem] overflow-visible relative">
                        <CardContent className="p-5">
                            <div className="pr-10">
                                <p className="text-[10px] font-bold text-green-700 dark:text-green-400 uppercase tracking-widest">Total Conformes</p>
                                <div className="text-5xl font-black text-slate-900 dark:text-white mt-2 tracking-tight">{stats.conformesSolids}</div>
                                <p className="text-xs font-semibold text-green-600 dark:text-green-400 mt-1">registros</p>
                                <p className="text-base font-bold text-green-600 dark:text-green-400 mt-2">
                                    {(stats.conformesSolids + stats.warningSolids + stats.noConformesSolids) > 0 ? ((stats.conformesSolids / (stats.conformesSolids + stats.warningSolids + stats.noConformesSolids)) * 100).toFixed(1) : 0}%{' '}
                                    <span className="text-xs font-normal">del total</span>
                                </p>
                                <p className="text-[10px] text-green-600/60 dark:text-green-500/60 mt-0.5">{stats.conformesSolidsLiters.toLocaleString()} L</p>
                            </div>
                            <div className="absolute -top-3 -right-3 p-4 bg-green-100 dark:bg-green-900/50 rounded-2xl shadow-lg border-4 border-white dark:border-slate-800">
                                <TrendingUp className="h-10 w-10 text-green-700 dark:text-green-400" />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Semi-Conformes Sólidos */}
                    <Card className="border-none shadow-md bg-yellow-50 dark:bg-slate-900 rounded-[1.5rem] overflow-visible relative">
                        <CardContent className="p-5">
                            <div className="pr-10">
                                <p className="text-[10px] font-bold text-yellow-700 dark:text-yellow-400 uppercase tracking-widest">Semi-Conformes</p>
                                <div className="text-5xl font-black text-slate-900 dark:text-white mt-2 tracking-tight">{stats.warningSolids}</div>
                                <p className="text-xs font-semibold text-yellow-600 dark:text-yellow-400 mt-1">registros</p>
                                <p className="text-base font-bold text-yellow-600 dark:text-yellow-400 mt-2">
                                    {(stats.conformesSolids + stats.warningSolids + stats.noConformesSolids) > 0 ? ((stats.warningSolids / (stats.conformesSolids + stats.warningSolids + stats.noConformesSolids)) * 100).toFixed(1) : 0}%{' '}
                                    <span className="text-xs font-normal">del total</span>
                                </p>
                                <p className="text-[10px] text-yellow-600/60 dark:text-yellow-500/60 mt-0.5">{stats.warningSolidsLiters.toLocaleString()} L</p>
                            </div>
                            <div className="absolute -top-3 -right-3 p-4 bg-yellow-100 dark:bg-yellow-900/50 rounded-2xl shadow-lg border-4 border-white dark:border-slate-800">
                                <AlertCircle className="h-10 w-10 text-yellow-700 dark:text-yellow-400" />
                            </div>
                        </CardContent>
                    </Card>

                    {/* No Conformes Sólidos */}
                    <Card className="border-none shadow-md bg-red-50 dark:bg-slate-900 rounded-[1.5rem] overflow-visible relative">
                        <CardContent className="p-5">
                            <div className="pr-10">
                                <p className="text-[10px] font-bold text-red-700 dark:text-red-400 uppercase tracking-widest">No Conformes</p>
                                <div className="text-5xl font-black text-slate-900 dark:text-white mt-2 tracking-tight">{stats.noConformesSolids}</div>
                                <p className="text-xs font-semibold text-red-600 dark:text-red-400 mt-1">registros</p>
                                <p className="text-base font-bold text-red-600 dark:text-red-400 mt-2">
                                    {(stats.conformesSolids + stats.warningSolids + stats.noConformesSolids) > 0 ? ((stats.noConformesSolids / (stats.conformesSolids + stats.warningSolids + stats.noConformesSolids)) * 100).toFixed(1) : 0}%{' '}
                                    <span className="text-xs font-normal">del total</span>
                                </p>
                                <p className="text-[10px] text-red-600/60 dark:text-red-500/60 mt-0.5">{stats.noConformesSolidsLiters.toLocaleString()} L</p>
                            </div>
                            <div className="absolute -top-3 -right-3 p-4 bg-red-100 dark:bg-red-900/50 rounded-2xl shadow-lg border-4 border-white dark:border-slate-800">
                                <Activity className="h-10 w-10 text-red-700 dark:text-red-400" />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Gráfico de Control: % Sólidos */}
                <Card className="border-none shadow-sm dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800">
                    <CardHeader className="pb-2">
                        <div className="flex justify-between items-center">
                            <div>
                                <CardTitle className="text-base font-bold text-slate-700 dark:text-slate-200">Gráfico de Control: % Sólidos</CardTitle>
                                <CardDescription className="text-xs">Historial y límites de tolerancia (+-5%) y estándar del producto</CardDescription>
                            </div>
                            {selectedProductCode !== "all" && currentStandards?.solids && (
                                <div className="text-xs text-slate-500 font-semibold font-mono">
                                    Estándar: {currentStandards.solids.min}% - {currentStandards.solids.max}%
                                </div>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={controlChartData} margin={{ top: 20, right: 35, left: 10, bottom: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.2} />
                                    <XAxis dataKey="lote" fontSize={9} angle={-45} textAnchor="end" height={60} interval={0} tick={{ fill: '#64748b' }} />
                                    <YAxis domain={canvasSolids as any} fontSize={11} tickLine={false} axisLine={false} unit="%" tick={{ fill: '#64748b' }} />
                                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                                    <Legend verticalAlign="top" height={36} />
                                    <Line type="monotone" dataKey="solidos" name="% Sólidos" stroke="#eab308" strokeWidth={2.5} dot={{ r: 3, fill: '#eab308', stroke: '#fff', strokeWidth: 1.5 }} />

                                    {selectedProductCode !== "all" && currentStandards?.solids && (
                                        <>
                                            {/* Límites de advertencia - AMARILLO */}
                                            <ReferenceLine y={(currentStandards.solids.max || 0) * 1.05} label={{ value: 'TLS (+5%)', position: 'insideTopRight', fill: '#eab308', fontSize: 10 }} stroke="#eab308" strokeDasharray="5 5" strokeWidth={1.5} />
                                            <ReferenceLine y={(currentStandards.solids.min || 0) * 0.95} label={{ value: 'TLI (-5%)', position: 'insideBottomRight', fill: '#eab308', fontSize: 10 }} stroke="#eab308" strokeDasharray="5 5" strokeWidth={1.5} />

                                            {/* Límites estándar - ROJO */}
                                            <ReferenceLine y={(currentStandards.solids.max || 0)} label={{ value: 'LCS', position: 'insideTopRight', fill: '#c41f1a', fontSize: 10, dy: 10 }} stroke="#c41f1a" strokeWidth={2} />
                                            <ReferenceLine y={(currentStandards.solids.min || 0)} label={{ value: 'LCI', position: 'insideBottomRight', fill: '#c41f1a', fontSize: 10, dy: -10 }} stroke="#c41f1a" strokeWidth={2} />
                                        </>
                                    )}
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ─── FILA 5: GRÁFICOS DE CONTROL Y CONFORMIDAD DE pH ─────────────── */}
            <div className="space-y-6 pt-4">
                
                <div className="border-t border-slate-200/60 dark:border-slate-800 pt-6">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        Control del Potencial de Hidrógeno (pH)
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                        Historial analítico del control de pH y conformidad con las especificaciones estándar.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* pH Conformes */}
                    <Card className="border-none shadow-md bg-green-50 dark:bg-slate-900 rounded-[1.5rem] overflow-visible relative">
                        <CardContent className="p-5">
                            <div className="pr-10">
                                <p className="text-[10px] font-bold text-green-700 dark:text-green-400 uppercase tracking-widest">Total Conformes</p>
                                <div className="text-5xl font-black text-slate-900 dark:text-white mt-2 tracking-tight">{stats.conformesPH}</div>
                                <p className="text-xs font-semibold text-green-600 dark:text-green-400 mt-1">registros</p>
                                <p className="text-base font-bold text-green-600 dark:text-green-400 mt-2">
                                    {(stats.conformesPH + stats.noConformesPH) > 0 ? ((stats.conformesPH / (stats.conformesPH + stats.noConformesPH)) * 100).toFixed(1) : 0}%{' '}
                                    <span className="text-xs font-normal">con estándar pH</span>
                                </p>
                                <p className="text-[10px] text-green-600/60 dark:text-green-500/60 mt-0.5">{stats.conformesPHLiters.toLocaleString()} L</p>
                            </div>
                            <div className="absolute -top-3 -right-3 p-4 bg-green-100 dark:bg-green-900/50 rounded-2xl shadow-lg border-4 border-white dark:border-slate-800">
                                <TrendingUp className="h-10 w-10 text-green-700 dark:text-green-400" />
                            </div>
                        </CardContent>
                    </Card>

                    {/* pH No Conformes */}
                    <Card className="border-none shadow-md bg-red-50 dark:bg-slate-900 rounded-[1.5rem] overflow-visible relative">
                        <CardContent className="p-5">
                            <div className="pr-10">
                                <p className="text-[10px] font-bold text-red-700 dark:text-red-400 uppercase tracking-widest">No Conformes</p>
                                <div className="text-5xl font-black text-slate-900 dark:text-white mt-2 tracking-tight">{stats.noConformesPH}</div>
                                <p className="text-xs font-semibold text-red-600 dark:text-red-400 mt-1">registros</p>
                                <p className="text-base font-bold text-red-600 dark:text-red-400 mt-2">
                                    {(stats.conformesPH + stats.noConformesPH) > 0 ? ((stats.noConformesPH / (stats.conformesPH + stats.noConformesPH)) * 100).toFixed(1) : 0}%{' '}
                                    <span className="text-xs font-normal">con estándar pH</span>
                                </p>
                                <p className="text-[10px] text-red-600/60 dark:text-red-500/60 mt-0.5">{stats.noConformesPHLiters.toLocaleString()} L</p>
                            </div>
                            <div className="absolute -top-3 -right-3 p-4 bg-red-100 dark:bg-red-900/50 rounded-2xl shadow-lg border-4 border-white dark:border-slate-800">
                                <Activity className="h-10 w-10 text-red-700 dark:text-red-400" />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Gráfico de Control: pH */}
                <Card className="border-none shadow-sm dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800">
                    <CardHeader className="pb-2">
                        <div className="flex justify-between items-center">
                            <div>
                                <CardTitle className="text-base font-bold text-slate-700 dark:text-slate-200">Gráfico de Control: pH</CardTitle>
                                <CardDescription className="text-xs">Historial y límites específicos de tolerancia estándar de pH</CardDescription>
                            </div>
                            {selectedProductCode !== "all" && currentStandards?.ph && (
                                <div className="text-xs text-slate-500 font-semibold font-mono">
                                    Rango Estándar: {currentStandards.ph.min} - {currentStandards.ph.max}
                                </div>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={controlChartData} margin={{ top: 20, right: 35, left: 10, bottom: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.2} />
                                    <XAxis dataKey="lote" fontSize={9} angle={-45} textAnchor="end" height={60} interval={0} tick={{ fill: '#64748b' }} />
                                    <YAxis domain={canvasPH as [number, number]} fontSize={11} tickLine={false} axisLine={false} tick={{ fill: '#64748b' }} />
                                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                                    <Legend verticalAlign="top" height={36} />
                                    <Line type="monotone" dataKey="ph" name="Valor pH" stroke="#0000A0" strokeWidth={2.5} dot={{ r: 3, fill: '#0000A0', stroke: '#fff', strokeWidth: 1.5 }} />

                                    {selectedProductCode !== "all" && currentStandards?.ph && (
                                        <>
                                            <ReferenceLine y={currentStandards.ph.max} label={{ value: 'LCS', position: 'insideTopRight', fill: '#c41f1a', fontSize: 10 }} stroke="#c41f1a" strokeWidth={2} />
                                            <ReferenceLine y={currentStandards.ph.min} label={{ value: 'LCI', position: 'insideBottomRight', fill: '#c41f1a', fontSize: 10 }} stroke="#c41f1a" strokeWidth={2} />
                                        </>
                                    )}
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Print View y Modal */}
            <DateRangeModal
                open={showPrintModal}
                onClose={() => setShowPrintModal(false)}
                onConfirm={(dateFrom, dateTo) => {
                    setShowPrintModal(false)
                    setPrintView({ dateFrom, dateTo })
                }}
                title="Reporte de Calidad y Rendimiento"
            />

            {printView && (
                <PrintReportWrapper
                    title="Reporte Unificado de Calidad y Rendimiento (FTQ / SPY)"
                    dateFrom={printView.dateFrom}
                    dateTo={printView.dateTo}
                    userName={profile?.full_name}
                    onClose={() => setPrintView(null)}
                >
                    <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>

                        {/* ── 1. RESUMEN EJECUTIVO ── */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                            <div style={{ border: '1px solid #e2e8f0', padding: '14px', borderRadius: '12px', background: '#f8fafc' }}>
                                <p style={{ fontSize: '8pt', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Volumen Total Producido</p>
                                <p style={{ fontSize: '22pt', fontWeight: 900, color: '#0f172a', margin: '4px 0 2px' }}>{stats.totalVolumeUnified.toLocaleString()} <span style={{ fontSize: '10pt', fontWeight: 600 }}>L</span></p>
                                <p style={{ fontSize: '7pt', color: '#94a3b8', margin: 0 }}>PT: {stats.totalVolumeProducts.toLocaleString()} L &nbsp;|&nbsp; Bases: {stats.totalPiecesBases.toLocaleString()} pzs ({stats.totalVolumeBases.toLocaleString()} L eq)</p>
                            </div>
                            <div style={{ border: '1px solid #bbf7d0', padding: '14px', borderRadius: '12px', background: '#f0fdf4' }}>
                                <p style={{ fontSize: '8pt', fontWeight: 900, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>First Time Quality (FTQ)</p>
                                <p style={{ fontSize: '22pt', fontWeight: 900, color: '#15803d', margin: '4px 0 2px' }}>{stats.ftqPercent.toFixed(1)}%</p>
                                <p style={{ fontSize: '7pt', color: '#166534', margin: 0 }}>{stats.ftqVolume.toLocaleString()} L producidos bien a la primera</p>
                            </div>
                            <div style={{ border: '1px solid #c7d2fe', padding: '14px', borderRadius: '12px', background: '#eef2ff' }}>
                                <p style={{ fontSize: '8pt', fontWeight: 900, color: '#3730a3', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Final Yield (Rendimiento)</p>
                                <p style={{ fontSize: '22pt', fontWeight: 900, color: '#4338ca', margin: '4px 0 2px' }}>{stats.finalYieldPercent.toFixed(2)}%</p>
                                <p style={{ fontSize: '7pt', color: '#3730a3', margin: 0 }}>{stats.affectedVolume.toLocaleString()} L intervenidos o no conformes</p>
                            </div>
                        </div>

                        {/* ── 2. CONFORMIDAD DE SÓLIDOS ── */}
                        <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
                            <h4 style={{ fontSize: '10pt', fontWeight: 800, margin: '0 0 10px 0', color: '#0f172a' }}>Conformidad del % de Sólidos</h4>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt' }}>
                                <thead>
                                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                                        <th style={{ textAlign: 'left', padding: '7px 10px' }}>Estado</th>
                                        <th style={{ textAlign: 'right', padding: '7px 10px' }}>Lotes</th>
                                        <th style={{ textAlign: 'right', padding: '7px 10px' }}>Volumen (L)</th>
                                        <th style={{ textAlign: 'right', padding: '7px 10px' }}>% del total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr style={{ borderBottom: '1px solid #f1f5f9', background: '#f0fdf4' }}>
                                        <td style={{ padding: '7px 10px', fontWeight: 700, color: '#15803d' }}>Conforme</td>
                                        <td style={{ textAlign: 'right', padding: '7px 10px', fontWeight: 800 }}>{stats.conformesSolids}</td>
                                        <td style={{ textAlign: 'right', padding: '7px 10px' }}>{stats.conformesSolidsLiters.toLocaleString()}</td>
                                        <td style={{ textAlign: 'right', padding: '7px 10px', fontWeight: 700, color: '#15803d' }}>{(stats.conformesSolids + stats.warningSolids + stats.noConformesSolids) > 0 ? ((stats.conformesSolids / (stats.conformesSolids + stats.warningSolids + stats.noConformesSolids)) * 100).toFixed(1) : 0}%</td>
                                    </tr>
                                    <tr style={{ borderBottom: '1px solid #f1f5f9', background: '#fefce8' }}>
                                        <td style={{ padding: '7px 10px', fontWeight: 700, color: '#a16207' }}>Semi-Conforme (tolerancia ±5%)</td>
                                        <td style={{ textAlign: 'right', padding: '7px 10px', fontWeight: 800 }}>{stats.warningSolids}</td>
                                        <td style={{ textAlign: 'right', padding: '7px 10px' }}>{stats.warningSolidsLiters.toLocaleString()}</td>
                                        <td style={{ textAlign: 'right', padding: '7px 10px', fontWeight: 700, color: '#a16207' }}>{(() => { const t = stats.conformesSolids + stats.warningSolids + stats.noConformesSolids; if (t === 0) return '0.0'; const a = parseFloat((stats.conformesSolids / t * 100).toFixed(1)); const b = parseFloat((stats.noConformesSolids / t * 100).toFixed(1)); return (100 - a - b).toFixed(1) })()}%</td>
                                    </tr>
                                    <tr style={{ background: '#fff1f2' }}>
                                        <td style={{ padding: '7px 10px', fontWeight: 700, color: '#be123c' }}>No Conforme</td>
                                        <td style={{ textAlign: 'right', padding: '7px 10px', fontWeight: 800 }}>{stats.noConformesSolids}</td>
                                        <td style={{ textAlign: 'right', padding: '7px 10px' }}>{stats.noConformesSolidsLiters.toLocaleString()}</td>
                                        <td style={{ textAlign: 'right', padding: '7px 10px', fontWeight: 700, color: '#be123c' }}>{(stats.conformesSolids + stats.warningSolids + stats.noConformesSolids) > 0 ? ((stats.noConformesSolids / (stats.conformesSolids + stats.warningSolids + stats.noConformesSolids)) * 100).toFixed(1) : 0}%</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* ── 3. CONFORMIDAD DE pH ── */}
                        <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
                            <h4 style={{ fontSize: '10pt', fontWeight: 800, margin: '0 0 10px 0', color: '#0f172a' }}>Conformidad de pH</h4>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt' }}>
                                <thead>
                                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                                        <th style={{ textAlign: 'left', padding: '7px 10px' }}>Estado</th>
                                        <th style={{ textAlign: 'right', padding: '7px 10px' }}>Lotes</th>
                                        <th style={{ textAlign: 'right', padding: '7px 10px' }}>Volumen (L)</th>
                                        <th style={{ textAlign: 'right', padding: '7px 10px' }}>% del total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr style={{ borderBottom: '1px solid #f1f5f9', background: '#f0fdf4' }}>
                                        <td style={{ padding: '7px 10px', fontWeight: 700, color: '#15803d' }}>Conforme</td>
                                        <td style={{ textAlign: 'right', padding: '7px 10px', fontWeight: 800 }}>{stats.conformesPH}</td>
                                        <td style={{ textAlign: 'right', padding: '7px 10px' }}>{stats.conformesPHLiters.toLocaleString()}</td>
                                        <td style={{ textAlign: 'right', padding: '7px 10px', fontWeight: 700, color: '#15803d' }}>{(stats.conformesPH + stats.noConformesPH) > 0 ? ((stats.conformesPH / (stats.conformesPH + stats.noConformesPH)) * 100).toFixed(1) : 0}%</td>
                                    </tr>
                                    <tr style={{ background: '#fff1f2' }}>
                                        <td style={{ padding: '7px 10px', fontWeight: 700, color: '#be123c' }}>No Conforme</td>
                                        <td style={{ textAlign: 'right', padding: '7px 10px', fontWeight: 800 }}>{stats.noConformesPH}</td>
                                        <td style={{ textAlign: 'right', padding: '7px 10px' }}>{stats.noConformesPHLiters.toLocaleString()}</td>
                                        <td style={{ textAlign: 'right', padding: '7px 10px', fontWeight: 700, color: '#be123c' }}>{(stats.conformesPH + stats.noConformesPH) > 0 ? ((stats.noConformesPH / (stats.conformesPH + stats.noConformesPH)) * 100).toFixed(1) : 0}%</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* ── 4. PARETO DE DEFECTOS ── */}
                        <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
                            <h4 style={{ fontSize: '10pt', fontWeight: 800, margin: '0 0 10px 0', color: '#0f172a' }}>Análisis Pareto — Principales Causas de No Conformidad</h4>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt' }}>
                                <thead>
                                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                                        <th style={{ textAlign: 'left', padding: '7px 10px' }}>Parámetro</th>
                                        <th style={{ textAlign: 'right', padding: '7px 10px' }}>Volumen afectado (L)</th>
                                        <th style={{ textAlign: 'right', padding: '7px 10px' }}>% Acumulado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {chartsData.paretoData.map((d, i) => (
                                        <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                                            <td style={{ padding: '7px 10px', fontWeight: 600 }}>{d.name}</td>
                                            <td style={{ textAlign: 'right', padding: '7px 10px', color: '#0e0c9b', fontWeight: 800 }}>{d.count.toLocaleString()}</td>
                                            <td style={{ textAlign: 'right', padding: '7px 10px', fontWeight: 700, color: d.accumulatedPercent >= 80 ? '#9c2c7a' : '#64748b' }}>{d.accumulatedPercent}%</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* ── 5. CONFORMIDAD POR SUCURSAL ── */}
                        {chartsData.sucursalData.length > 0 && (
                            <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
                                <h4 style={{ fontSize: '10pt', fontWeight: 800, margin: '0 0 10px 0', color: '#0f172a' }}>Conformidad por Sucursal</h4>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt' }}>
                                    <thead>
                                        <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                                            <th style={{ textAlign: 'left', padding: '7px 10px' }}>Sucursal</th>
                                            <th style={{ textAlign: 'right', padding: '7px 10px', color: '#15803d' }}>Conformes</th>
                                            <th style={{ textAlign: 'right', padding: '7px 10px', color: '#a16207' }}>Semi-Conf.</th>
                                            <th style={{ textAlign: 'right', padding: '7px 10px', color: '#be123c' }}>No Conf.</th>
                                            <th style={{ textAlign: 'right', padding: '7px 10px' }}>Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {chartsData.sucursalData.map((s, i) => {
                                            const total = s.conformes + s.semiConformes + s.noConformes
                                            return (
                                                <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                                                    <td style={{ padding: '7px 10px', fontWeight: 600 }}>{s.name}</td>
                                                    <td style={{ textAlign: 'right', padding: '7px 10px', color: '#15803d', fontWeight: 700 }}>{s.conformes}</td>
                                                    <td style={{ textAlign: 'right', padding: '7px 10px', color: '#a16207', fontWeight: 700 }}>{s.semiConformes}</td>
                                                    <td style={{ textAlign: 'right', padding: '7px 10px', color: '#be123c', fontWeight: 700 }}>{s.noConformes}</td>
                                                    <td style={{ textAlign: 'right', padding: '7px 10px', fontWeight: 800 }}>{total}</td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* ── 6. ANÁLISIS AUTOMÁTICO ── */}
                        {printInsights.length > 0 && (
                            <div style={{ marginTop: '20px', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                                <div style={{ background: 'linear-gradient(to right, #0e0c9b, #2a28b5)', padding: '10px 16px' }}>
                                    <h4 style={{ margin: 0, fontSize: '10pt', fontWeight: 900, color: 'white', letterSpacing: '0.02em' }}>Análisis Automático del Período</h4>
                                    <p style={{ margin: '2px 0 0 0', fontSize: '7pt', color: 'rgba(255,255,255,0.65)' }}>Generado a partir de los datos del reporte — no sustituye el criterio técnico del equipo de calidad</p>
                                </div>
                                <div style={{ padding: '12px 16px', background: 'white' }}>
                                    {printInsights.map((ins, i) => (
                                        <div key={i} style={{
                                            display: 'flex', gap: '10px', alignItems: 'flex-start',
                                            padding: '7px 10px', marginBottom: i < printInsights.length - 1 ? '6px' : 0,
                                            borderRadius: '8px',
                                            background: ins.level === 'ok' ? '#f0fdf4' : ins.level === 'critical' ? '#fff1f2' : '#fffbeb',
                                            borderLeft: `3px solid ${ins.level === 'ok' ? '#16a34a' : ins.level === 'critical' ? '#e2211c' : '#d97706'}`
                                        }}>
                                            <span style={{ fontSize: '9pt', lineHeight: 1, marginTop: '1px', flexShrink: 0 }}>
                                                {ins.level === 'ok' ? '✓' : ins.level === 'critical' ? '✕' : '⚠'}
                                            </span>
                                            <p style={{ margin: 0, fontSize: '8pt', color: '#1e293b', lineHeight: '1.5' }}>{ins.text}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ── 7. GLOSARIO ── */}
                        <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '8pt', color: '#64748b' }}>
                            <h5 style={{ fontWeight: 900, color: '#0f172a', margin: '0 0 6px 0', fontSize: '9pt' }}>Glosario y Criterios de Evaluación</h5>
                            <p style={{ margin: '3px 0' }}><strong>First Time Quality (FTQ):</strong> Litros producidos que cumplen pH, sólidos y apariencia a la primera, sin ninguna desviación.</p>
                            <p style={{ margin: '3px 0' }}><strong>Final Yield (Rendimiento):</strong> Litros aptos para liberación; se descuentan únicamente los lotes con No Conformidad total en cualquier parámetro.</p>
                            <p style={{ margin: '3px 0' }}><strong>Semi-Conforme:</strong> Lote dentro de la tolerancia relativa ±5% del estándar; se considera afectado en FTQ pero no se descuenta del Yield.</p>
                            <p style={{ margin: '3px 0' }}><strong>No Conforme:</strong> Lote fuera de tolerancia; genera NCR automática y se descuenta del Final Yield.</p>
                            <p style={{ margin: '3px 0' }}><strong>Bases:</strong> Familias de bases se miden en piezas (pzs); se convierten a litros equivalentes con factor ×20 para los cálculos de volumen.</p>
                        </div>

                        {/* ── NOTA METODOLÓGICA ── */}
                        <div style={{ marginTop: '12px', padding: '12px 14px', background: '#fffbeb', borderRadius: '10px', border: '1px solid #fde68a', fontSize: '7.5pt', color: '#78350f' }}>
                            <p style={{ fontWeight: 900, color: '#92400e', margin: '0 0 5px 0', fontSize: '8.5pt' }}>⚠ Nota metodológica — Alcance de los conteos de conformidad</p>
                            <p style={{ margin: '3px 0' }}>
                                Los conteos de este reporte (FTQ, Yield, Conformes, Semi-Conformes, No Conformes) <strong>excluyen</strong> los registros cuyo código de producto no cuenta con un estándar técnico definido en el catálogo (estado interno: <em>N/A</em>). Dichos lotes no se clasifican en ninguna categoría de conformidad y no afectan los índices calculados.
                            </p>
                            <p style={{ margin: '6px 0 3px 0' }}>
                                El módulo <strong>Control de Calidad</strong> presenta los mismos registros pero, por diseño operativo, los lotes sin estándar se muestran como "Conformes" en sus tarjetas de resumen. Esto puede generar diferencias en los totales por categoría entre ambos módulos para el mismo período. Los índices FTQ / Yield de este reporte son los valores analíticamente válidos.
                            </p>
                        </div>
                    </div>
                </PrintReportWrapper>
            )}
        </div>
    )
}
