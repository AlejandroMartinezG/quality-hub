'use client'

import { useState, useEffect } from 'react'
import { useAuth } from "@/components/AuthProvider"
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    ComposedChart,
    Line,
    ReferenceLine,
    RadarChart,
    Radar,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis
} from 'recharts'
import {
    Activity,
    BarChart3,
    Calendar,
    Filter,
    TrendingUp,
    AlertTriangle,
    CheckCircle2,
    RefreshCcw,
    Scale,
    Package,
    Factory,
    XCircle
} from 'lucide-react'
import { format, subDays, startOfDay, endOfDay } from 'date-fns'
import { es } from 'date-fns/locale'

export default function SPYReportPage() {
    const { user, profile } = useAuth()
    const [loading, setLoading] = useState(true)
    const [data, setData] = useState<any>(null)

    const isPreparador = profile?.role === 'preparador'

    // Filters
    const [timeRange, setTimeRange] = useState('30') // days
    const [metricMode, setMetricMode] = useState<'LOTES' | 'LITROS'>('LITROS')

    useEffect(() => {
        if (user && profile) {
            fetchSPYData()
        }
    }, [user?.id, profile?.role, timeRange, metricMode])

    async function fetchSPYData() {
        if (!user) return
        setLoading(true)
        console.log("Starting SPY Data Fetch...")

        try {
            console.log("Current User:", user.id, profile?.role)

            // Date Filters
            const endDate = endOfDay(new Date()).toISOString()
            const startDate = startOfDay(subDays(new Date(), parseInt(timeRange))).toISOString()
            console.log(`Date Range: ${startDate} to ${endDate}`)

            // DEBUG: Fetch ANY data (no filter) to verify connection
            const { data: testData, error: testError } = await supabase
                .from('quality_ncr')
                .select('id, created_at')
                .limit(3)
            if (testError) console.error("TEST QUERY CHECK FAILED:", testError)
            else console.log("TEST QUERY SUCCESS (Sample 3):", testData)


            // 1. Fetch Total Production (Bitacora)
            let fetchProduction = supabase
                .from('bitacora_produccion_calidad')
                .select('*')
                .gte('created_at', startDate)
                .lte('created_at', endDate)

            if (isPreparador) {
                fetchProduction = fetchProduction.eq('user_id', user.id)
            }

            // 2. Fetch NCRs (Quality NCR)
            let fetchNCRs = supabase
                .from('quality_ncr')
                .select('*, quality_disposition(*)')
                .gte('created_at', startDate)
                .lte('created_at', endDate)

            if (isPreparador) {
                fetchNCRs = fetchNCRs.eq('preparer_user_id', user.id)
            }

            const [prodRes, ncrRes] = await Promise.all([fetchProduction, fetchNCRs])

            if (prodRes.error) console.error("Error fetching production:", prodRes.error)
            if (ncrRes.error) console.error("Error fetching NCRs:", ncrRes.error)

            const productionData = prodRes.data || []
            let ncrData = ncrRes.data || []

            // Fix: We need `familia_producto` for NCRs to properly calculate Pieces * 20 L.
            // quality_ncr does not store `familia_producto`, so we must fetch it from `productionData` or from DB if missing.
            const fetchedBatchCodes = new Set(productionData.map((p: any) => p.lote_producto))
            const missingBatchCodes = Array.from(new Set(ncrData.map((n: any) => n.batch_code).filter((b: string) => b && !fetchedBatchCodes.has(b))))

            let missingBatches: any[] = []
            if (missingBatchCodes.length > 0) {
                const { data: mData } = await supabase
                    .from('bitacora_produccion_calidad')
                    .select('lote_producto, familia_producto')
                    .in('lote_producto', missingBatchCodes)
                if (mData) missingBatches = mData
            }

            const batchFamilyMap = new Map<string, string>()
            productionData.forEach((p: any) => batchFamilyMap.set(p.lote_producto, p.familia_producto || ''))
            missingBatches.forEach((p: any) => batchFamilyMap.set(p.lote_producto, p.familia_producto || ''))

            // Append family to NCRs
            ncrData = ncrData.map((n: any) => ({
                ...n,
                family: batchFamilyMap.get(n.batch_code) || ''
            }))

            console.log(`Fetched ${productionData.length} production records`)
            console.log(`Fetched ${ncrData.length} NCR records`)

            // A. Volume / Count Basis
            const PIECE_FAMILIES = ["Bases aromatizante ambiental", "Bases limpiadores liquidos multiusos", "Bases Aromatizantes"];

            // Exclude piece families from the pure "Batches" (Lotes) count
            const totalProduction = productionData.filter((p: any) => !PIECE_FAMILIES.includes(p.familia_producto || '')).length;

            // Calculate Total Volume: If family is 'Pieces', multiply by 20 Liters
            const totalVolume = productionData.reduce((sum, item) => {
                const isPiece = PIECE_FAMILIES.includes(item.familia_producto || '');
                const val = Number(item.tamano_lote) || 0;
                return sum + (isPiece ? (val * 20) : val);
            }, 0)

            // Pure "Batches" NCR count (all statuses) for FTQ — FTQ mide todo lo que tuvo problema
            const totalNCRs = ncrData.filter((n: any) => !PIECE_FAMILIES.includes(n.family || '')).length;
            const volumeAffected = ncrData.reduce((sum, item) => {
                const isPiece = PIECE_FAMILIES.includes(item.family || '');
                const val = Number(item.liters_involved) || 0;
                return sum + (isPiece ? (val * 20) : val);
            }, 0)

            // C. Disposition Breakdown
            // Siempre tomar la disposición MÁS RECIENTE por NCR (no la primera [0])
            const ncrWithDisposition = ncrData.map((ncr: any) => {
                const dispositions: any[] = ncr.quality_disposition || []
                const dispo = [...dispositions].sort((a: any, b: any) =>
                    new Date(b.closed_at || b.created_at || 0).getTime() -
                    new Date(a.closed_at || a.created_at || 0).getTime()
                )[0] || null
                return { ...ncr, disposition: dispo }
            })

            // Para SPY/Final Yield y Reproceso: SOLO NCRs con status CERRADO
            // Un NCR abierto o en investigación aún no tiene disposición final confirmada
            const closedNCRs = ncrWithDisposition.filter((n: any) => n.status === 'CERRADO')

            console.log(`[SPY] Total NCRs: ${ncrWithDisposition.length} | Cerrados: ${closedNCRs.length}`)
            console.log('[SPY] NCRs con SCRAP_DESTRUCCION (cerrados):', closedNCRs.filter((n: any) =>
                n.disposition?.disposition_type?.toUpperCase().includes('SCRAP')
            ).map((n: any) => ({
                batch: n.batch_code,
                dispType: n.disposition?.disposition_type,
                dispLiters: n.disposition?.liters_involved,
                ncrLiters: n.liters_involved
            })))

            // Segregate by Disposition Type
            // scrapTotal y reprocessTotal: solo de NCRs CERRADOS (disposición final confirmada)
            let scrapTotal = 0;
            let reprocessTotal = 0;
            const dispositionStatsMap = new Map<string, number>()
            const dispositionBatchesMap = new Map<string, Set<string>>()
            const dispositionColorMap = new Map<string, string>()

            // El gráfico de destino de material usa TODOS los NCRs con disposición (independiente del status)
            ncrWithDisposition.forEach((item: any) => {
                const isPiece = PIECE_FAMILIES.includes(item.family || '');
                if (metricMode === 'LOTES' && isPiece) return;

                // Prioridad: litros de la disposición → litros del NCR → 0
                const dispLiters = Number(item.disposition?.liters_involved)
                const ncrLiters = Number(item.liters_involved)
                const rawVol = (dispLiters > 0 ? dispLiters : ncrLiters) || 0

                const vol = metricMode === 'LITROS' ? (isPiece ? rawVol * 20 : rawVol) : 1;

                const typeRaw = item.disposition?.disposition_type
                    ? item.disposition.disposition_type.replace(/_/g, ' ')
                    : 'PENDIENTE / SIN DISPOSICION'
                const typeUpper = typeRaw.toUpperCase()

                // Registrar volumen
                dispositionStatsMap.set(typeRaw, (dispositionStatsMap.get(typeRaw) || 0) + vol)

                // Registrar lote único (batch_code) por disposición
                const batchKey = item.batch_code || item.id || String(Math.random())
                const batchSet = dispositionBatchesMap.get(typeRaw) || new Set<string>()
                batchSet.add(batchKey)
                dispositionBatchesMap.set(typeRaw, batchSet)

                // Color map
                if (typeUpper.includes('SCRAP') || typeUpper.includes('DESECHO') || typeUpper.includes('DESTRUCCI')) {
                    dispositionColorMap.set(typeRaw, '#ef4444')
                } else if (typeUpper.includes('REPROCESO') || typeUpper.includes('AJUSTE')) {
                    dispositionColorMap.set(typeRaw, '#f97316')
                } else if (typeUpper.includes('CONCESION') || typeUpper.includes('DOWNGRADE') || typeUpper.includes('USE AS IS')) {
                    dispositionColorMap.set(typeRaw, '#22c55e')
                } else if (typeUpper.includes('HOLD') || typeUpper.includes('RETENCION')) {
                    dispositionColorMap.set(typeRaw, '#3b82f6')
                } else if (typeUpper.includes('PENDIENTE')) {
                    dispositionColorMap.set(typeRaw, '#eab308')
                } else {
                    dispositionColorMap.set(typeRaw, '#94a3b8')
                }
            })

            // KPIs de SCRAP y REPROCESO: solo de NCRs CERRADOS
            closedNCRs.forEach((item: any) => {
                const isPiece = PIECE_FAMILIES.includes(item.family || '');
                if (metricMode === 'LOTES' && isPiece) return;

                const dispLiters = Number(item.disposition?.liters_involved)
                const ncrLiters = Number(item.liters_involved)
                const rawVol = (dispLiters > 0 ? dispLiters : ncrLiters) || 0
                const vol = metricMode === 'LITROS' ? (isPiece ? rawVol * 20 : rawVol) : 1;

                const typeUpper = (item.disposition?.disposition_type || '').toUpperCase()

                if (typeUpper.includes('SCRAP') || typeUpper.includes('DESECHO') || typeUpper.includes('DESTRUCCI')) {
                    scrapTotal += vol
                } else if (typeUpper.includes('REPROCESO') || typeUpper.includes('AJUSTE')) {
                    reprocessTotal += vol
                }
            })

            console.log('[SPY] scrapTotal:', scrapTotal, '| reprocessTotal:', reprocessTotal, '| baseTotal:', metricMode === 'LITROS' ? totalVolume : totalProduction)

            // Format disposition data for chart
            const fullDispositionData = Array.from(dispositionStatsMap.entries())
                .map(([name, value]) => ({
                    name,
                    value,
                    // Número de lotes únicos (batch_code) que tuvieron esta disposición
                    count: dispositionBatchesMap.get(name)?.size || 0,
                    color: dispositionColorMap.get(name) || '#94a3b8'
                }))
                .sort((a, b) => b.value - a.value)
                .filter(d => d.value > 0)


            // Cálculo correcto de KPIs:
            // FTQ = (Total - Todos los NCRs con defecto) / Total  → mide «primera vez bien»
            // SPY = (Total - Scrap CERRADO confirmado) / Total    → mide rendimiento final real
            // Rework Rate = Reprocesos CERRADOS / Total

            const baseTotal = metricMode === 'LITROS' ? totalVolume : totalProduction
            const badFirstTime = metricMode === 'LITROS' ? volumeAffected : totalNCRs

            const calcPercent = (val: number, total: number) => total > 0 ? (val / total) * 100 : 0

            const ftq = baseTotal > 0 ? ((baseTotal - badFirstTime) / baseTotal) * 100 : 100
            const spy = baseTotal > 0 ? ((baseTotal - scrapTotal) / baseTotal) * 100 : 100
            const reworkRate = calcPercent(reprocessTotal, baseTotal)
            const scrapRate = calcPercent(scrapTotal, baseTotal)

            console.log('[SPY] Métricas finales:', { baseTotal, badFirstTime, scrapTotal, reprocessTotal, ftq, spy, reworkRate })

            // Pareto Data (Defects)
            const defectsMap = new Map<string, number>()
            ncrWithDisposition.forEach((item: any) => {
                const defect = item.defect_parameter || 'No Especificado'
                const val = metricMode === 'LITROS' ? (Number(item.liters_involved) || 0) : 1
                defectsMap.set(defect, (defectsMap.get(defect) || 0) + val)
            })

            // Pareto base: ordenar por volumen desc
            const paretoData = Array.from(defectsMap.entries())
                .map(([name, value]) => ({ name, value }))
                .sort((a, b) => b.value - a.value)

            // Pareto con % acumulado (para línea 80/20)
            let cumulative = 0
            const totalDefects = paretoData.reduce((s, d) => s + d.value, 0)
            const paretoWithCumulative = paretoData.map(d => {
                cumulative += d.value
                return {
                    ...d,
                    cumPercent: totalDefects > 0 ? Math.round((cumulative / totalDefects) * 100) : 0
                }
            })


            // Parámetros críticos: usar ncrData directamente (defect_parameter no depende de disposición)
            const radarMap = new Map<string, number>()
            ncrData.forEach((item: any) => {
                const param = item.defect_parameter || 'Sin parametro'
                radarMap.set(param, (radarMap.get(param) || 0) + 1)
            })
            const radarData = Array.from(radarMap.entries()).map(([param, count]) => ({ param, count }))
            console.log('[SPY] radarData:', radarData, '| ncrData sample defect_parameter:', ncrData.slice(0, 3).map((n: any) => n.defect_parameter))
            // Reprocess Breakdown — solo NCRs CERRADOS con disposición REPROCESO o AJUSTE
            const reprocessItems = closedNCRs.filter((item: any) => {
                const type = item.disposition?.disposition_type?.toUpperCase() || ''
                return type.includes('REPROCESO') || type.includes('AJUSTE')
            })

            // ─── Diagnóstico detallado ────────────────────────────────────────────────
            console.log(`[SPY] closedNCRs total: ${closedNCRs.length}`)
            console.log('[SPY] closedNCRs por disposición:',
                closedNCRs.map((n: any) => ({
                    id: n.id,
                    status: n.status,
                    dispType: n.disposition?.disposition_type,
                    defectParam: n.defect_parameter,
                    liters: n.liters_involved,
                    dispLiters: n.disposition?.liters_involved
                }))
            )
            console.log(`[SPY] reprocessItems (filtrados REPROCESO/AJUSTE): ${reprocessItems.length}`)
            console.log('[SPY] reprocessItems detalle:',
                reprocessItems.map((n: any) => ({
                    id: n.id,
                    dispType: n.disposition?.disposition_type,
                    defectParam: n.defect_parameter,
                    liters: n.liters_involved,
                    dispLiters: n.disposition?.liters_involved,
                    family: n.family
                }))
            )
            // ─────────────────────────────────────────────────────────────────────────

            const reprocessMap = new Map<string, { vol: number; count: number }>()
            reprocessItems.forEach((item: any) => {
                const defect = item.defect_parameter || 'No Especificado'
                const isPiece = PIECE_FAMILIES.includes(item.family || '')
                const dispLiters = Number(item.disposition?.liters_involved)
                const ncrLiters = Number(item.liters_involved)
                const rawVol = (dispLiters > 0 ? dispLiters : ncrLiters) || 0
                const vol = metricMode === 'LITROS' ? (isPiece ? rawVol * 20 : rawVol) : 1
                const prev = reprocessMap.get(defect) || { vol: 0, count: 0 }
                reprocessMap.set(defect, { vol: prev.vol + vol, count: prev.count + 1 })
            })
            const reprocessPareto = Array.from(reprocessMap.entries())
                .map(([name, { vol, count }]) => ({ name, value: vol, count }))
                .sort((a, b) => b.value - a.value)


            setData({
                summary: {
                    total_input: baseTotal,
                    first_pass_yield: ftq,
                    final_yield: spy,
                    rework_rate: reworkRate,
                    scrap_rate: scrapRate
                },
                pareto_data: paretoWithCumulative,
                disposition_data: fullDispositionData,
                reprocess_data: reprocessPareto,
                radar_data: radarData
            })

        } catch (error) {
            console.error('Error fetching SPY data:', error)
        } finally {
            setLoading(false)
        }
    }

    // ─── Paleta corporativa: #0e0c9b (azul) → #c41f1a (rojo) ───────────────────
    // Interpolación: Azul → Índigo → Violeta → Magenta/Ciruela → Rojo
    const CORP_BLUE = '#0e0c9b'
    const CORP_INDIGO = '#3b3ab5'
    const CORP_VIOLET = '#6b3ab0'
    const CORP_PLUM = '#9c2c7a'
    const CORP_RED = '#c41f1a'
    const CORP_AMBER = '#a8470e'   // acento cálido intermedio para "hold/pendiente"

    // Colores para gráficos en arco de 5 pasos
    const COLORS = [CORP_BLUE, CORP_INDIGO, CORP_VIOLET, CORP_PLUM, CORP_RED, CORP_AMBER, '#1e3a8a', '#7c3aed']

    const DISPOSITION_COLORS: Record<string, string> = {
        'REPROCESO': CORP_PLUM,     // magenta/ciruela
        'AJUSTE FORMULA': CORP_VIOLET,   // violeta
        'SCRAP DESTRUCCION': CORP_RED,      // rojo corporativo
        'DESECHO': CORP_RED,
        'DOWNGRADE': CORP_INDIGO,   // índigo
        'HOLD INVESTIGACION': CORP_BLUE,     // azul corporativo
        'CONCESION': '#1e3a8a',     // azul marino
        'DEVOLUCION': CORP_AMBER,    // acento cálido
        'PENDIENTE': '#6b7280',     // gris neutro
    }

    if (loading && !data) return (
        <div className="h-[50vh] flex flex-col items-center justify-center space-y-4">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-500">Analizando datos de calidad...</p>
        </div>
    )

    // Derived Metric Unit
    const UNIT = metricMode === 'LITROS' ? 'L' : 'Lotes'

    // Safe destructuring
    const summary = data?.summary || { total_input: 0, first_pass_yield: 0, final_yield: 0, rework_rate: 0, scrap_rate: 0 }
    const pareto = data?.pareto_data || []
    const dispositionData = data?.disposition_data || []
    const reprocessData = data?.reprocess_data || []
    const radarData = data?.radar_data || []

    return (
        <div className="space-y-6 pb-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                        Análisis de Rendimiento (SPY / Yield)
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        Indicadores de calidad a la primera y recuperación.
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    <Select value={timeRange} onValueChange={setTimeRange}>
                        <SelectTrigger className="w-[180px]">
                            <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
                            <SelectValue placeholder="Periodo" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="7">Últimos 7 días</SelectItem>
                            <SelectItem value="30">Últimos 30 días</SelectItem>
                            <SelectItem value="90">Últimos 90 días</SelectItem>
                            <SelectItem value="365">Último Año</SelectItem>
                        </SelectContent>
                    </Select>

                    <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
                        <button
                            onClick={() => setMetricMode('LOTES')}
                            className={`px-3 py-1.5 text-xs font-bold uppercase rounded-md transition-colors flex items-center gap-2 ${metricMode === 'LOTES' ? 'bg-white shadow-sm text-blue-900' : 'text-slate-500'}`}
                        >
                            <Package className="h-3 w-3" />
                            Por Lotes
                        </button>
                        <button
                            onClick={() => setMetricMode('LITROS')}
                            className={`px-3 py-1.5 text-xs font-bold uppercase rounded-md transition-colors flex items-center gap-2 ${metricMode === 'LITROS' ? 'bg-white shadow-sm text-blue-900' : 'text-slate-500'}`}
                        >
                            <Scale className="h-3 w-3" />
                            Por Litros
                        </button>
                    </div>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

                {/* KPI 1: Volumen Total */}
                <Card className="border-none shadow-md bg-gradient-to-br from-blue-900 to-blue-950 text-white dark:from-blue-950 dark:to-slate-900 rounded-[2rem]">
                    <CardContent className="p-8 relative overflow-hidden">
                        <div className="relative z-10">
                            <div className="mb-4">
                                <p className="text-blue-200 font-semibold mb-3 flex items-center gap-2 text-base">
                                    <Activity className="h-6 w-6" />
                                    VOLUMEN TOTAL
                                </p>
                                <div className="text-5xl font-extrabold tracking-tight leading-none">
                                    {summary.total_input?.toLocaleString()}
                                    <span className="text-xl font-semibold opacity-80 ml-2">{UNIT}</span>
                                </div>
                                <p className="text-base text-blue-200 mt-3 opacity-80 font-medium">
                                    Producido en el periodo
                                </p>
                            </div>
                        </div>
                        <Activity className="absolute -right-8 -bottom-8 h-48 w-48 text-white opacity-10 rotate-12" />
                    </CardContent>
                </Card>

                {/* KPI 2: First Time Quality (FTQ) */}
                <Card className="border-none shadow-lg dark:bg-slate-900 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-slate-900 dark:to-slate-800 relative overflow-visible rounded-[2rem]">
                    <CardContent className="p-6 h-full flex flex-col justify-between">
                        <div>
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex-1 pr-12">
                                    <h3 className="text-base font-extrabold text-green-700 dark:text-green-400 tracking-wide mb-2 uppercase">FIRST TIME QUALITY</h3>
                                    <div className="text-5xl font-extrabold text-slate-900 dark:text-white mt-1 leading-none">
                                        {summary.first_pass_yield?.toFixed(1)}%
                                    </div>
                                    <p className="text-sm text-green-700 dark:text-green-400 font-medium mt-2">Aprobado sin incidentes</p>
                                </div>
                                <div className="absolute -top-3 -right-3 p-4 bg-green-100 dark:bg-green-900/50 rounded-2xl shadow-lg border-4 border-white dark:border-slate-800">
                                    <CheckCircle2 className="h-10 w-10 text-green-700 dark:text-green-400" />
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* KPI 3: Final Yield (SPY) */}
                <Card className="border-none shadow-lg dark:bg-slate-900 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 relative overflow-visible rounded-[2rem]">
                    <CardContent className="p-6 h-full flex flex-col justify-between">
                        <div>
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex-1 pr-12">
                                    <h3 className="text-base font-extrabold text-indigo-700 dark:text-indigo-400 tracking-wide mb-2 uppercase">FINAL YIELD (SPY)</h3>
                                    <div className="text-5xl font-extrabold text-slate-900 dark:text-white mt-1 leading-none">
                                        {summary.final_yield?.toFixed(2)}%
                                    </div>
                                    <p className="text-sm text-indigo-700 dark:text-indigo-400 font-medium mt-2">Incluyendo recuperaciones</p>
                                </div>
                                <div className="absolute -top-3 -right-3 p-4 bg-indigo-100 dark:bg-indigo-900/50 rounded-2xl shadow-lg border-4 border-white dark:border-slate-800">
                                    <TrendingUp className="h-10 w-10 text-indigo-700 dark:text-indigo-400" />
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* KPI 4: Tasa de Reproceso */}
                <Card className="border-none shadow-lg dark:bg-slate-900 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-slate-900 dark:to-slate-800 relative overflow-visible rounded-[2rem]">
                    <CardContent className="p-6 h-full flex flex-col justify-between">
                        <div>
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex-1 pr-12">
                                    <h3 className="text-base font-extrabold text-orange-700 dark:text-orange-400 tracking-wide mb-2 uppercase">TASA DE REPROCESO</h3>
                                    <div className="text-5xl font-extrabold text-slate-900 dark:text-white mt-1 leading-none">
                                        {summary.rework_rate?.toFixed(1)}%
                                    </div>
                                    <p className="text-sm text-orange-700 dark:text-orange-400 font-medium mt-2">Intervenidos</p>
                                </div>
                                <div className="absolute -top-3 -right-3 p-4 bg-orange-100 dark:bg-orange-900/50 rounded-2xl shadow-lg border-4 border-white dark:border-slate-800">
                                    <RefreshCcw className="h-10 w-10 text-orange-700 dark:text-orange-400" />
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2">

                {/* 1. Pareto real con barras verticales y línea acumulada */}
                <Card className="col-span-1 border-none shadow-sm rounded-[2rem] bg-white dark:bg-slate-900">
                    <CardHeader>
                        <CardTitle className="text-slate-700 dark:text-slate-200">Pareto de Defectos</CardTitle>
                        <CardDescription>Causas de No Conformidad — barras de mayor a menor, línea naranja = % acumulado</CardDescription>
                    </CardHeader>
                    <CardContent className="pb-6 pr-4">
                        <div style={{ width: '100%', height: 340 }}>
                            {pareto.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={pareto} margin={{ top: 20, right: 60, left: 10, bottom: 60 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.3} />
                                        {/* Eje X: nombres de los defectos (bottom) */}
                                        <XAxis
                                            dataKey="name"
                                            tick={{ fontSize: 11, fill: '#64748b' }}
                                            axisLine={false}
                                            tickLine={false}
                                            angle={-35}
                                            textAnchor="end"
                                            interval={0}
                                            height={60}
                                        />
                                        {/* Eje Y izquierdo: volumen de defectos */}
                                        <YAxis
                                            yAxisId="vol"
                                            tick={{ fill: '#94a3b8', fontSize: 11 }}
                                            axisLine={false}
                                            tickLine={false}
                                            tickFormatter={(v) => Number(v).toLocaleString()}
                                            width={55}
                                        />
                                        {/* Eje Y derecho: porcentaje acumulado 0-100 */}
                                        <YAxis
                                            yAxisId="pct"
                                            orientation="right"
                                            domain={[0, 100]}
                                            tickFormatter={(v) => `${v}%`}
                                            tick={{ fill: CORP_PLUM, fontSize: 11 }}
                                            axisLine={false}
                                            tickLine={false}
                                            ticks={[0, 20, 40, 60, 80, 100]}
                                            width={42}
                                        />
                                        <Tooltip
                                            cursor={{ fill: 'rgba(14,12,155,0.04)' }}
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            formatter={(value: any, name: string) => {
                                                if (name === 'cumPercent') return [`${value}%`, '% Acumulado']
                                                return [`${Number(value).toLocaleString()} ${UNIT}`, 'Cantidad']
                                            }}
                                        />
                                        {/* Barras verticales de volumen — azul corporativo */}
                                        <Bar yAxisId="vol" dataKey="value" fill={CORP_BLUE} radius={[6, 6, 0, 0]} maxBarSize={60} />
                                        {/* Línea de % acumulado — rojo corporativo */}
                                        <Line
                                            yAxisId="pct"
                                            dataKey="cumPercent"
                                            type="monotone"
                                            stroke={CORP_RED}
                                            strokeWidth={2.5}
                                            dot={{ r: 4, fill: CORP_RED, stroke: '#fff', strokeWidth: 2 }}
                                            activeDot={{ r: 6 }}
                                        />
                                        {/* Umbral 80% — ciruela corporativo */}
                                        <ReferenceLine
                                            yAxisId="pct"
                                            y={80}
                                            stroke={CORP_PLUM}
                                            strokeWidth={1.5}
                                            strokeDasharray="6 4"
                                            label={{
                                                value: '— 80%',
                                                position: 'insideTopLeft',
                                                fill: CORP_PLUM,
                                                fontSize: 10,
                                                fontWeight: 700,
                                                dy: -8,
                                                dx: 4
                                            }}
                                        />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-muted-foreground text-sm flex-col gap-2">
                                    <CheckCircle2 className="h-8 w-8 text-green-400 opacity-50" />
                                    <p>No hay defectos en este periodo</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* 2. Parámetros críticos — RadarChart */}
                <Card className="col-span-1 border-none shadow-sm rounded-[2rem] bg-white dark:bg-slate-900">
                    <CardHeader>
                        <CardTitle className="text-slate-700 dark:text-slate-200">Parámetros Críticos</CardTitle>
                        <CardDescription>Frecuencia de incidencias por parámetro (# NCRs)</CardDescription>
                    </CardHeader>
                    <CardContent className="pb-6 pr-6">
                        <div style={{ width: '100%', height: 320 }}>
                            {radarData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <RadarChart data={radarData} margin={{ top: 20, right: 40, bottom: 20, left: 40 }}>
                                        <PolarGrid stroke="#e2e8f0" />
                                        <PolarAngleAxis dataKey="param" tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }} />
                                        <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={{ fill: '#94a3b8', fontSize: 9 }} tickCount={4} />
                                        <Radar name="NCRs" dataKey="count" stroke={CORP_BLUE} fill={CORP_VIOLET} fillOpacity={0.2} strokeWidth={2} />
                                        <Tooltip
                                            formatter={(value: any) => [`${value} NCRs`, 'Incidencias']}
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        />
                                    </RadarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-muted-foreground text-sm flex-col gap-2">
                                    <Activity className="h-8 w-8 text-slate-300" />
                                    <p>Sin datos de parámetros</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* 3. Destino de Material — barras horizontales individuales por disposición */}
                <Card className="col-span-1 md:col-span-2 border-none shadow-sm rounded-[2rem] bg-white dark:bg-slate-900">
                    <CardHeader>
                        <CardTitle className="text-slate-700 dark:text-slate-200">Destino de Material No Conforme</CardTitle>
                        <CardDescription>Volumen ({UNIT}) por tipo de disposición — ordenado de mayor a menor impacto</CardDescription>
                    </CardHeader>
                    <CardContent className="pb-6 pr-6">
                        <div style={{ width: '100%', height: Math.max(220, dispositionData.length * 52) }}>
                            {dispositionData.length > 0 ? (() => {
                                const sorted = [...dispositionData].sort((a: any, b: any) => b.value - a.value)
                                const maxVal = sorted[0]?.value || 1
                                return (
                                    <div className="flex flex-col gap-3 pt-2">
                                        {sorted.map((entry: any) => (
                                            <div key={entry.name} className="flex items-center gap-3 group relative">
                                                {/* Etiqueta */}
                                                <span className="w-36 text-xs font-semibold text-slate-600 dark:text-slate-400 text-right shrink-0 truncate" title={entry.name}>
                                                    {entry.name}
                                                </span>
                                                {/* Barra con tooltip */}
                                                <div className="flex-1 relative h-8 rounded-full overflow-visible bg-slate-100 dark:bg-slate-800">
                                                    <div
                                                        className="h-full rounded-full transition-all duration-500 ease-out cursor-pointer"
                                                        style={{
                                                            width: `${(entry.value / maxVal) * 100}%`,
                                                            backgroundColor: entry.color,
                                                            opacity: 0.85
                                                        }}
                                                    />
                                                    {/* Tooltip flotante */}
                                                    <div className="
                                                        absolute bottom-full left-1/4 mb-2 z-50
                                                        opacity-0 group-hover:opacity-100
                                                        transition-opacity duration-200 pointer-events-none
                                                    ">
                                                        <div className="bg-slate-900 text-white text-xs rounded-xl px-3 py-2 shadow-lg whitespace-nowrap">
                                                            <p className="font-bold" style={{ color: entry.color }}>{entry.name}</p>
                                                            <p className="mt-0.5">{Number(entry.value).toLocaleString()} {UNIT}</p>
                                                            <p className="text-slate-400">{entry.count || 0} lote{entry.count !== 1 ? 's' : ''} comprometido{entry.count !== 1 ? 's' : ''}</p>
                                                        </div>
                                                        {/* Triángulo */}
                                                        <div className="w-2 h-2 bg-slate-900 rotate-45 mx-auto -mt-1" />
                                                    </div>
                                                </div>
                                                {/* Valor */}
                                                <span className="w-24 text-xs font-bold shrink-0" style={{ color: entry.color }}>
                                                    {Number(entry.value).toLocaleString()} {UNIT}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )
                            })() : (
                                <div className="h-full flex items-center justify-center text-muted-foreground text-sm flex-col gap-2">
                                    <Activity className="h-8 w-8 text-slate-300" />
                                    <p>No hay datos de disposición en este periodo</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>


                {/* 5. Causas de Reproceso */}
                <Card className="col-span-1 md:col-span-2 border-none shadow-sm rounded-[2rem] bg-white dark:bg-slate-900">
                    <CardHeader>
                        <CardTitle className="text-slate-700 dark:text-slate-200">Causas de Reproceso</CardTitle>
                        <CardDescription>
                            Parámetros que derivaron en reproceso o ajuste en NCRs cerrados
                            {reprocessData.length > 0 && (
                                <span className="ml-2 text-orange-600 font-semibold">
                                    ({reprocessData.reduce((s: number, d: any) => s + d.count, 0)} NCRs • {reprocessData.reduce((s: number, d: any) => s + d.value, 0).toLocaleString()} {UNIT} totales)
                                </span>
                            )}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pb-6 pr-6">
                        <div style={{ width: '100%', height: Math.max(200, reprocessData.length * 58) }}>
                            {reprocessData.length > 0 ? (() => {
                                const maxVal = reprocessData[0]?.value || 1
                                const totalVol = reprocessData.reduce((s: number, d: any) => s + d.value, 0)
                                return (
                                    <div className="flex flex-col gap-4 pt-2">
                                        {reprocessData.map((entry: any, idx: number) => (
                                            <div key={entry.name} className="flex items-center gap-3">
                                                {/* Etiqueta + conteo */}
                                                <div className="w-36 shrink-0 text-right">
                                                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 truncate" title={entry.name}>{entry.name}</p>
                                                    <p className="text-[10px] text-slate-400">{entry.count} NCR{entry.count !== 1 ? 's' : ''}</p>
                                                </div>
                                                {/* Barra */}
                                                <div className="flex-1 relative h-8 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                                                    <div
                                                        className="h-full rounded-full transition-all duration-500 ease-out"
                                                        style={{
                                                            width: `${(entry.value / maxVal) * 100}%`,
                                                            background: idx === 0
                                                                ? `linear-gradient(90deg, ${CORP_PLUM}, ${CORP_RED})`
                                                                : `color-mix(in srgb, ${CORP_PLUM} ${Math.round(85 - idx * 12)}%, transparent)`,
                                                        }}
                                                    />
                                                </div>
                                                {/* Valor + % */}
                                                <div className="w-28 shrink-0">
                                                    <p className="text-xs font-bold" style={{ color: CORP_PLUM }}>{Number(entry.value).toLocaleString()} {UNIT}</p>
                                                    <p className="text-[10px] text-slate-400">{totalVol > 0 ? Math.round((entry.value / totalVol) * 100) : 0}% del reproceso</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )
                            })() : (
                                <div className="h-full flex items-center justify-center text-muted-foreground text-sm flex-col gap-2">
                                    <CheckCircle2 className="h-8 w-8 text-green-400 opacity-50" />
                                    <p>No hay reprocesos cerrados en este periodo</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

            </div>
        </div >
    )
}
