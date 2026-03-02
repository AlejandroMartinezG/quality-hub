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
    Cell
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

                // Registrar en el gráfico de torta (todos los NCRs con disposición)
                dispositionStatsMap.set(typeRaw, (dispositionStatsMap.get(typeRaw) || 0) + vol)

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

            // Format disposition data for the pie chart
            const fullDispositionData = Array.from(dispositionStatsMap.entries())
                .map(([name, value]) => ({
                    name,
                    value,
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

            const paretoData = Array.from(defectsMap.entries())
                .map(([name, value]) => ({ name, value }))
                .sort((a, b) => b.value - a.value)

            // Reprocess Breakdown (What defects cause reprocess?)
            const reprocessItems = ncrWithDisposition.filter((item: any) => {
                const type = item.disposition?.disposition_type?.toUpperCase() || ''
                return type.includes('REPROCESO') || type.includes('AJUSTE')
            })

            const reprocessMap = new Map<string, number>()
            reprocessItems.forEach((item: any) => {
                const defect = item.defect_parameter || 'No Especificado'
                const isPiece = PIECE_FAMILIES.includes(item.family || '');
                const rawVol = Number(item.liters_involved) || 0;
                const vol = metricMode === 'LITROS' ? (isPiece ? rawVol * 20 : rawVol) : 1;
                reprocessMap.set(defect, (reprocessMap.get(defect) || 0) + vol)
            })

            const reprocessPareto = Array.from(reprocessMap.entries())
                .map(([name, value]) => ({ name, value }))
                .sort((a, b) => b.value - a.value)

            setData({
                summary: {
                    total_input: baseTotal,
                    first_pass_yield: ftq,
                    final_yield: spy,
                    rework_rate: reworkRate,
                    scrap_rate: scrapRate
                },
                pareto_data: paretoData,
                disposition_data: fullDispositionData,
                reprocess_data: reprocessPareto
            })

        } catch (error) {
            console.error('Error fetching SPY data:', error)
        } finally {
            setLoading(false)
        }
    }

    // Colors for charts
    const COLORS = ['#22c55e', '#eab308', '#ef4444', '#f97316'];

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
                {/* Reprocess Breakdown */}
                <Card className="col-span-1 border-none shadow-sm rounded-[2rem] bg-white dark:bg-slate-900">
                    <CardHeader>
                        <CardTitle className="text-slate-700 dark:text-slate-200">Causas de Reproceso</CardTitle>
                        <CardDescription>Defectos principales que requieren intervención ({UNIT})</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[350px]">
                        {reprocessData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={reprocessData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} strokeOpacity={0.3} />
                                    <XAxis type="number" tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                    <Tooltip
                                        formatter={(value: any) => [`${Number(value).toLocaleString()} ${UNIT}`, 'Impacto']}
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Bar dataKey="value" fill="#f97316" radius={[0, 6, 6, 0]} barSize={24} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-muted-foreground text-sm flex-col gap-2">
                                <CheckCircle2 className="h-8 w-8 text-green-400 opacity-50" />
                                <p>No hay datos de reprocesos en este periodo</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Pareto General Defects */}
                <Card className="col-span-1 border-none shadow-sm rounded-[2rem] bg-white dark:bg-slate-900">
                    <CardHeader>
                        <CardTitle className="text-slate-700 dark:text-slate-200">Pareto de Defectos (General)</CardTitle>
                        <CardDescription>Principales causas de No Conformidad ({UNIT})</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[350px]">
                        {pareto.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={pareto} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} strokeOpacity={0.3} />
                                    <XAxis type="number" tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                    <Tooltip
                                        formatter={(value: any) => [`${Number(value).toLocaleString()} ${UNIT}`, 'Cantidad']}
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Bar dataKey="value" fill="#3b82f6" radius={[0, 6, 6, 0]} barSize={24} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-muted-foreground text-sm flex-col gap-2">
                                <CheckCircle2 className="h-8 w-8 text-green-400 opacity-50" />
                                <p>No hay defectos registrados en este periodo</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Disposition Breakdown */}
                <Card className="col-span-1 md:col-span-2 border-none shadow-sm rounded-[2rem] bg-white dark:bg-slate-900">
                    <CardHeader>
                        <CardTitle className="text-slate-700 dark:text-slate-200">Destino de Material No Conforme</CardTitle>
                        <CardDescription>Efectividad de las disposiciones de calidad</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[350px] flex items-center justify-center">
                        {dispositionData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={dispositionData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={80}
                                        outerRadius={100}
                                        paddingAngle={5}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {dispositionData.map((entry: any, index: number) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={(value: any) => [`${Number(value).toLocaleString()} ${UNIT}`, 'Volumen']}
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Legend
                                        verticalAlign="middle"
                                        align="right"
                                        layout="vertical"
                                        iconType="circle"
                                        wrapperStyle={{ paddingLeft: '20px' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-muted-foreground text-sm flex-col gap-2">
                                <Activity className="h-8 w-8 text-slate-300" />
                                <p>No hay datos de disposición en este periodo</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
