"use client"

import { useState, useEffect, useMemo } from "react"
import { useAuth } from "@/components/AuthProvider"
import { supabase } from "@/lib/supabase"
import { analyzeRecord, EnrichedRecord } from "@/lib/analysis-utils"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCcw, Filter, Download } from "lucide-react"
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
    LineChart,
    Line,
    ReferenceLine,
    ComposedChart
} from "recharts"
import { SUCURSALES, PRODUCT_STANDARDS, PH_STANDARDS } from "@/lib/production-constants"

// --- Components ---

const KPICard = ({ title, value, subtitle, icon: Icon, colorClass }: any) => (
    <Card className="border-none shadow-sm bg-white dark:bg-slate-900">
        <CardContent className="p-6">
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{title}</h3>
                    <div className="text-3xl font-bold text-slate-800 dark:text-white mb-1">{value}</div>
                    {subtitle && <p className={`text-xs ${colorClass}`}>{subtitle}</p>}
                </div>
                {Icon && (
                    <div className={`p-3 rounded-full opacity-10 ${colorClass.replace('text-', 'bg-')}`}>
                        <Icon className={`h-6 w-6 ${colorClass}`} />
                    </div>
                )}
            </div>
        </CardContent>
    </Card>
)

export default function ReportesPage() {
    const { user } = useAuth()
    const [records, setRecords] = useState<EnrichedRecord[]>([])
    const [loading, setLoading] = useState(true)

    // Filters
    const [selectedSucursal, setSelectedSucursal] = useState("all")
    const [selectedProduct, setSelectedProduct] = useState("all")
    // const [selectedDateRange, setSelectedDateRange] = useState("30d") // Future implementation

    useEffect(() => {
        if (user) {
            fetchData()
        }
    }, [user])

    const fetchData = async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('bitacora_produccion_calidad')
                .select('*')
                .order('created_at', { ascending: true }) // Ascending for charts

            if (error) throw error

            if (data) {
                // Analyze all records
                const analyzed = data.map(analyzeRecord)
                setRecords(analyzed)
            }
        } catch (error) {
            console.error("Error loading reports data:", error)
        } finally {
            setLoading(false)
        }
    }

    // --- Data Processing for Charts ---

    // Get unique products for filter
    const uniqueProducts = useMemo(() => {
        const products = new Set(records.map(r => r.codigo_producto))
        return Array.from(products).sort()
    }, [records])

    // 1. Filtered Data
    const filteredRecords = useMemo(() => {
        return records.filter(r => {
            if (selectedSucursal !== "all" && r.sucursal !== selectedSucursal) return false
            if (selectedProduct !== "all" && r.codigo_producto !== selectedProduct) return false
            return true
        })
    }, [records, selectedSucursal, selectedProduct])

    // 2. KPIs
    const kpis = useMemo(() => {
        const total = filteredRecords.length

        // Families that are counted in Pieces instead of Volume
        const PIECE_FAMILIES = ["Bases Aromatizantes", "Bases limpiadores liquidos multiusos"]

        const totalVolume = filteredRecords.reduce((sum, r) => {
            if (!PIECE_FAMILIES.includes(r.familia_producto)) {
                return sum + (r.tamano_lote || 0)
            }
            return sum
        }, 0)

        const totalPieces = filteredRecords.reduce((sum, r) => {
            if (PIECE_FAMILIES.includes(r.familia_producto)) {
                return sum + (r.tamano_lote || 0)
            }
            return sum
        }, 0)

        const conformes = filteredRecords.filter(r => r.analysis.isConform).length
        const noConformes = total - conformes
        const percentConformidad = total > 0 ? ((conformes / total) * 100).toFixed(1) : "0.0"

        return { total, conformes, noConformes, percentConformidad, totalVolume, totalPieces }
    }, [filteredRecords])

    // 3. Stacked Bar Chart (Sucursales)
    const sucursalChartData = useMemo(() => {
        const grouped: Record<string, { name: string, conformes: number, noConformes: number }> = {}

        filteredRecords.forEach(r => {
            const suc = r.sucursal || "Sin Sucursal"
            if (!grouped[suc]) {
                grouped[suc] = { name: suc, conformes: 0, noConformes: 0 }
            }
            if (r.analysis.isConform) {
                grouped[suc].conformes++
            } else {
                grouped[suc].noConformes++
            }
        })

        return Object.values(grouped).sort((a, b) => (b.conformes + b.noConformes) - (a.conformes + a.noConformes))
    }, [filteredRecords])

    // 4. Pareto Data (Defectos)
    const paretoData = useMemo(() => {
        const defects = {
            ph: 0,
            solidos: 0,
            apariencia: 0,
            // color: 0, // Not analyzing yet
            // aroma: 0
        }

        filteredRecords.forEach(r => {
            if (!r.analysis.isConform) {
                r.analysis.failedParams.forEach(param => {
                    if (defects[param as keyof typeof defects] !== undefined) {
                        defects[param as keyof typeof defects]++
                    }
                })
            }
        })

        const data = [
            { name: "pH", count: defects.ph },
            { name: "Sólidos", count: defects.solidos },
            { name: "Apariencia", count: defects.apariencia }
        ].sort((a, b) => b.count - a.count)

        // Calculate cumulative percentage
        let accumulated = 0
        const totalDefects = data.reduce((sum, item) => sum + item.count, 0)

        return data.map(item => {
            accumulated += item.count
            return {
                ...item,
                accumulatedPercent: totalDefects > 0 ? Math.round((accumulated / totalDefects) * 100) : 0
            }
        })
    }, [filteredRecords])

    // 5. Control Charts Data (pH & Solids)
    const controlChartData = useMemo(() => {
        return filteredRecords.map((r, i) => ({
            index: i + 1,
            lote: r.lote_producto,
            ph: r.ph,
            solidos: r.solidos_promedio,
        }))
    }, [filteredRecords])

    // Get Standards for Selected Product (if any)
    const currentStandards = useMemo(() => {
        if (selectedProduct === "all") return null

        return {
            ph: PH_STANDARDS[selectedProduct],
            solids: PRODUCT_STANDARDS[selectedProduct]
        }
    }, [selectedProduct])

    // 6. Dynamic Y-Axis Domain Calculation
    // Calculates the min/max scale to ensure both Data and Limits are visible
    const canvasSolids = useMemo(() => {
        if (selectedProduct === "all" || !currentStandards?.solids) return ['auto', 'auto']

        const dataValues = controlChartData.map(d => d.solidos).filter(v => v !== null) as number[]
        const limits = [
            currentStandards.solids.min * 0.95, // Tolerance Min
            currentStandards.solids.max * 1.05, // Tolerance Max
            currentStandards.solids.min,
            currentStandards.solids.max
        ]

        const allValues = [...dataValues, ...limits]
        if (allValues.length === 0) return ['auto', 'auto']

        const min = Math.min(...allValues)
        const max = Math.max(...allValues)

        // Add 5% padding
        const padding = (max - min) * 0.05
        return [parseFloat((min - padding).toFixed(2)), parseFloat((max + padding).toFixed(2))]

    }, [controlChartData, selectedProduct, currentStandards])

    const canvasPH = useMemo(() => {
        if (selectedProduct === "all" || !currentStandards?.ph) return ['auto', 'auto']

        const dataValues = controlChartData.map(d => d.ph).filter(v => v !== null) as number[]
        const limits = [
            currentStandards.ph.min,
            currentStandards.ph.max
        ]

        const allValues = [...dataValues, ...limits]
        if (allValues.length === 0) return ['auto', 'auto']

        const min = Math.min(...allValues)
        const max = Math.max(...allValues)

        // Add 0.5 unit padding for pH as it is small scale
        return [parseFloat((min - 0.5).toFixed(1)), parseFloat((max + 0.5).toFixed(1))]

    }, [controlChartData, selectedProduct, currentStandards])

    const COLORS = ['#22c55e', '#ef4444', '#eab308', '#3b82f6'];

    return (
        <div className="space-y-6 pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                        Tablero de Análisis
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                        Visualización de desempeño de calidad y control de procesos
                    </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <Select value={selectedSucursal} onValueChange={setSelectedSucursal}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Todas las sucursales" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todas las sucursales</SelectItem>
                            {SUCURSALES.map((sucursal: string) => (
                                <SelectItem key={sucursal} value={sucursal}>{sucursal}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Todos los productos" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos los productos</SelectItem>
                            {uniqueProducts.map((p) => (
                                <SelectItem key={p} value={p}>{p}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Button variant="outline" size="icon" onClick={fetchData} title="Actualizar datos">
                        <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="h-64 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
            ) : (
                <>
                    {/* KPI Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                        <KPICard
                            title="Total Registros"
                            value={kpis.total}
                            colorClass="text-blue-600"
                        />
                        <KPICard
                            title="Volumen Total"
                            value={kpis.totalVolume.toLocaleString()}
                            subtitle="Litros/Kg producidos"
                            colorClass="text-indigo-600"
                        />
                        <KPICard
                            title="Total Piezas"
                            value={kpis.totalPieces.toLocaleString()}
                            subtitle="Unidades producidas"
                            colorClass="text-purple-600"
                        />
                        <KPICard
                            title="Total Conformes"
                            value={kpis.conformes}
                            subtitle={`${kpis.percentConformidad}% del total`}
                            colorClass="text-green-600"
                        />
                        <KPICard
                            title="Total No Conformes"
                            value={kpis.noConformes}
                            subtitle={`${(100 - parseFloat(kpis.percentConformidad)).toFixed(1)}% del total`}
                            colorClass="text-red-600"
                        />
                        <KPICard
                            title="Índice de Calidad"
                            value={`${kpis.percentConformidad}%`}
                            colorClass={parseFloat(kpis.percentConformidad) > 90 ? "text-green-600" : "text-yellow-600"}
                        />
                    </div>

                    {/* Row 1: Sucursales & Pareto */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Sucursales Performance */}
                        <Card className="border-none shadow-sm dark:bg-slate-900">
                            <CardHeader>
                                <CardTitle className="text-lg font-bold">Conformidad por Sucursal</CardTitle>
                                <CardDescription>Volumen de producción conforme vs no conforme</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[300px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={sucursalChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                            <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                                            <YAxis fontSize={12} tickLine={false} axisLine={false} />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                                cursor={{ fill: '#F1F5F9' }}
                                            />
                                            <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                            <Bar dataKey="conformes" name="Conformes" stackId="a" fill="#22c55e" radius={[0, 0, 4, 4]} />
                                            <Bar dataKey="noConformes" name="No Conformes" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Pareto de Defectos */}
                        <Card className="border-none shadow-sm dark:bg-slate-900">
                            <CardHeader>
                                <CardTitle className="text-lg font-bold">Pareto de Defectos</CardTitle>
                                <CardDescription>Frecuencia de fallos por parámetro de calidad</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[300px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={paretoData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                            <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                                            <YAxis yAxisId="left" fontSize={12} tickLine={false} axisLine={false} />
                                            <YAxis yAxisId="right" orientation="right" fontSize={12} tickLine={false} axisLine={false} unit="%" />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            />
                                            <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                            <Bar yAxisId="left" dataKey="count" name="Cantidad Fallos" fill="#ef4444" barSize={40} radius={[4, 4, 0, 0]} />
                                            <Line yAxisId="right" type="monotone" dataKey="accumulatedPercent" name="% Acumulado" stroke="#2563eb" strokeWidth={2} dot={{ r: 4 }} />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Row 2: Control Charts (Solids & pH) */}
                    <div className="grid grid-cols-1 gap-6">
                        {/* 1. Gráfico de Sólidos (Primero) */}
                        <Card className="border-none shadow-sm dark:bg-slate-900">
                            <CardHeader>
                                <div className="flex justify-between items-center">
                                    <div>
                                        <CardTitle className="text-lg font-bold">Gráfico de Control: % Sólidos</CardTitle>
                                        <CardDescription>Historial de mediciones de Sólidos de todos los lotes</CardDescription>
                                    </div>
                                    {selectedProduct !== "all" && currentStandards?.solids && (
                                        <div className="text-xs text-slate-500 text-right">
                                            Std: <span className="font-mono font-bold">{currentStandards.solids.min}% - {currentStandards.solids.max}%</span>
                                        </div>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[300px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={controlChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                            <XAxis dataKey="lote" fontSize={10} angle={-45} textAnchor="end" height={60} interval={0} tick={{ fill: '#64748b' }} />
                                            <YAxis domain={canvasSolids as any} fontSize={12} tickLine={false} axisLine={false} unit="%" />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            />
                                            <Legend verticalAlign="top" height={36} />
                                            <Line type="monotone" dataKey="solidos" name="% Sólidos" stroke="#eab308" strokeWidth={2} dot={{ r: 3, fill: '#eab308' }} activeDot={{ r: 6 }} />

                                            {/* Reference Lines for Solids */}
                                            {selectedProduct !== "all" && currentStandards?.solids && (
                                                <>
                                                    {/* Tolerance Limits (+-5% Error Relativo) - YELLOW */}
                                                    <ReferenceLine y={currentStandards.solids.max * 1.05} label={{ value: 'TLS (+5%)', position: 'insideTopRight', fill: '#eab308', fontSize: 10 }} stroke="#eab308" strokeDasharray="5 5" strokeWidth={2} />
                                                    <ReferenceLine y={currentStandards.solids.min * 0.95} label={{ value: 'TLI (-5%)', position: 'insideBottomRight', fill: '#eab308', fontSize: 10 }} stroke="#eab308" strokeDasharray="5 5" strokeWidth={2} />

                                                    {/* Standard Limits (Rango Estándar) - RED */}
                                                    <ReferenceLine y={currentStandards.solids.max} label={{ value: 'LCS', position: 'insideTopRight', fill: '#ef4444', fontSize: 10, dy: 10 }} stroke="#ef4444" strokeWidth={2} />
                                                    <ReferenceLine y={currentStandards.solids.min} label={{ value: 'LCI', position: 'insideBottomRight', fill: '#ef4444', fontSize: 10, dy: -10 }} stroke="#ef4444" strokeWidth={2} />
                                                </>
                                            )}

                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>

                        {/* 2. Gráfico de pH (Segundo) */}
                        <Card className="border-none shadow-sm dark:bg-slate-900">
                            <CardHeader>
                                <div className="flex justify-between items-center">
                                    <div>
                                        <CardTitle className="text-lg font-bold">Gráfico de Control: pH</CardTitle>
                                        <CardDescription>Historial de mediciones de pH de todos los lotes</CardDescription>
                                    </div>
                                    {selectedProduct !== "all" && currentStandards?.ph && (
                                        <div className="text-xs text-slate-500 text-right">
                                            Rango: <span className="font-mono font-bold">{currentStandards.ph.min} - {currentStandards.ph.max}</span>
                                        </div>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[300px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={controlChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                            <XAxis dataKey="lote" fontSize={10} angle={-45} textAnchor="end" height={60} interval={0} tick={{ fill: '#64748b' }} />
                                            <YAxis domain={canvasPH as [number, number]} fontSize={12} tickLine={false} axisLine={false} />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            />
                                            <Legend verticalAlign="top" height={36} />
                                            <Line type="monotone" dataKey="ph" name="Valor pH" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: '#3b82f6' }} activeDot={{ r: 6 }} />

                                            {/* Reference Lines for pH */}
                                            {selectedProduct !== "all" && currentStandards?.ph && (
                                                <>
                                                    <ReferenceLine y={currentStandards.ph.max} label={{ value: 'LCS', position: 'insideTopRight', fill: '#ef4444', fontSize: 10 }} stroke="#ef4444" strokeWidth={2} isFront={true} />
                                                    <ReferenceLine y={currentStandards.ph.min} label={{ value: 'LCI', position: 'insideBottomRight', fill: '#ef4444', fontSize: 10 }} stroke="#ef4444" strokeWidth={2} isFront={true} />
                                                </>
                                            )}
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </>
            )}
        </div>
    )
}
