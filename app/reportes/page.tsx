"use client"

import { useState, useEffect, useMemo } from "react"
import { useAuth } from "@/components/AuthProvider"
import { supabase } from "@/lib/supabase"
import { analyzeRecord, EnrichedRecord } from "@/lib/analysis-utils"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Loader2, RefreshCcw, Filter, Download, Factory, Trophy, TrendingUp, Package, Activity, AlertCircle, ChevronRight } from "lucide-react"
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
    ComposedChart,
    Area,
    AreaChart
} from "recharts"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SUCURSALES, PRODUCT_STANDARDS, PH_STANDARDS, CATEGORY_PRODUCTS, PRODUCT_GROUPS, PRODUCT_CATEGORIES } from "@/lib/production-constants"

// --- Components ---

const KPICard = ({ title, value, subtitle, icon: Icon, colorClass }: any) => (
    <Card className="border-none shadow-sm bg-white dark:bg-slate-900 rounded-[2rem]">
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
    const [selectedBranch, setSelectedBranch] = useState<string>("all")
    const [selectedProduct, setSelectedProduct] = useState<string>("all")
    const [selectedCategory, setSelectedCategory] = useState<string>("all") // NEW: Category filter
    const [dateRange, setDateRange] = useState<string>("all")
    const [showAllProducts, setShowAllProducts] = useState(false)
    const [rankingCategoryFilter, setRankingCategoryFilter] = useState<string>("all")
    const [selectedDateRange, setSelectedDateRange] = useState("all") // Date range filter

    // Drill-down modal state
    const [drillDownFamily, setDrillDownFamily] = useState<string | null>(null)

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
            // Silently handle fetch failure
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
        // Calculate date threshold based on selected range
        const now = new Date()
        let dateThreshold: Date | null = null

        switch (selectedDateRange) {
            case '7d':
                dateThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
                break
            case '30d':
                dateThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
                break
            case '3m':
                dateThreshold = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
                break
            case '6m':
                dateThreshold = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000)
                break
            case '1y':
                dateThreshold = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
                break
            case 'all':
            default:
                dateThreshold = null
                break
        }

        return records.filter(r => {
            // Filter by sucursal
            if (selectedSucursal !== "all" && r.sucursal !== selectedSucursal) return false

            // Filter by category
            if (selectedCategory !== "all" && r.familia_producto !== selectedCategory) return false

            // Filter by product
            if (selectedProduct !== "all" && r.codigo_producto !== selectedProduct) return false

            // Filter by date range
            if (dateThreshold && r.fecha_fabricacion) {
                const recordDate = new Date(r.fecha_fabricacion)
                if (recordDate < dateThreshold) return false
            }

            return true
        })
    }, [records, selectedSucursal, selectedCategory, selectedProduct, selectedDateRange])

    // 2. KPIs
    const kpis = useMemo(() => {
        const total = filteredRecords.length

        // Families that are counted in Pieces instead of Volume
        // Matching exact strings from CATEGORY_PRODUCTS keys or likely DB values
        const PIECE_FAMILIES = ["Bases aromatizante ambiental", "Bases limpiadores liquidos multiusos", "Bases Aromatizantes"]

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

        // Classify records using new control chart-based conformity levels
        const conformes = filteredRecords.filter(r => r.analysis.overallStatus === 'conforme').length
        const semiConformes = filteredRecords.filter(r => r.analysis.overallStatus === 'semi-conforme').length
        const noConformes = filteredRecords.filter(r => r.analysis.overallStatus === 'no-conforme').length

        const percentConformidad = total > 0 ? ((conformes / total) * 100).toFixed(1) : "0.0"
        const percentSemiConformidad = total > 0 ? ((semiConformes / total) * 100).toFixed(1) : "0.0"
        const percentNoConformidad = total > 0 ? ((noConformes / total) * 100).toFixed(1) : "0.0"

        return { total, conformes, semiConformes, noConformes, percentConformidad, percentSemiConformidad, percentNoConformidad, totalVolume, totalPieces }
    }, [filteredRecords])

    // 3. Stacked Bar Chart (Sucursales)
    const sucursalChartData = useMemo(() => {
        const grouped: Record<string, { name: string, conformes: number, semiConformes: number, noConformes: number }> = {}

        filteredRecords.forEach(r => {
            const suc = r.sucursal || "Sin Sucursal"
            if (!grouped[suc]) {
                grouped[suc] = { name: suc, conformes: 0, semiConformes: 0, noConformes: 0 }
            }
            // Use new control chart-based conformity levels
            if (r.analysis.overallStatus === 'conforme') {
                grouped[suc].conformes++
            } else if (r.analysis.overallStatus === 'semi-conforme') {
                grouped[suc].semiConformes++
            } else if (r.analysis.overallStatus === 'no-conforme') {
                grouped[suc].noConformes++
            }
            // 'na' status is not counted
        })

        return Object.values(grouped).sort((a, b) => (b.conformes + b.semiConformes + b.noConformes) - (a.conformes + a.semiConformes + a.noConformes))
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
            (currentStandards.solids.min || 0) * 0.95, // Tolerance Min
            (currentStandards.solids.max || 100) * 1.05, // Tolerance Max
            (currentStandards.solids.min || 0),
            (currentStandards.solids.max || 100)
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

    // --- 7. Commercial Analysis Data ---
    const commercialData = useMemo(() => {
        const PIECE_FAMILIES = ["Bases aromatizante ambiental", "Bases limpiadores liquidos multiusos", "Bases Aromatizantes"]

        // --- 1. By Sucursal ---
        const bySucursal = filteredRecords.reduce((acc, r) => {
            const suc = r.sucursal || "Sin Sucursal"
            if (!acc[suc]) acc[suc] = { name: suc, litros: 0, piezas: 0 }

            const rAny = r as any // Escape strict typing for dynamic/missing fields
            const isPiece = PIECE_FAMILIES.includes((r.familia_producto || rAny.categoria_producto || '') as string)
            if (isPiece) {
                acc[suc].piezas += (r.tamano_lote || 0)
            } else {
                acc[suc].litros += (r.tamano_lote || 0)
            }
            return acc
        }, {} as Record<string, { name: string, litros: number, piezas: number }>)

        const sucursalData = Object.values(bySucursal).sort((a, b) => b.litros - a.litros)
        const top3Sucursales = sucursalData.slice(0, 3)

        // --- 2. By Category (Global) ---
        const byCategory = filteredRecords.reduce((acc, r) => {
            const rAny = r as any
            // Use grouping logic: Category is specific (e.g. "Detergente Ropa"), Family is broad (e.g. "Lavanderia")
            // If categoria_producto is not available, fallback to name or family
            const cat = (rAny.categoria_producto || r.familia_producto || "Otros") as string
            if (!acc[cat]) acc[cat] = { name: cat, value: 0, type: 'litros' }

            const isPiece = PIECE_FAMILIES.includes((r.familia_producto || rAny.categoria_producto || '') as string)
            acc[cat].type = isPiece ? 'piezas' : 'litros'
            acc[cat].value += (r.tamano_lote || 0)
            return acc
        }, {} as Record<string, { name: string, value: number, type: 'litros' | 'piezas' }>)

        const categoryData = Object.values(byCategory).sort((a, b) => b.value - a.value)
        const top3Categories = categoryData.slice(0, 3)


        // --- 3. By Family -> Category Breakdown (For Donut Charts) ---
        // Create lookup maps for fast access
        const categoryToFamilyMap: Record<string, string> = {}
        const categoryIdToNameMap: Record<string, string> = {}

        // Map Category IDs to Family Titles
        PRODUCT_GROUPS.forEach(group => {
            group.ids.forEach(catId => {
                const catObj = PRODUCT_CATEGORIES.find(c => c.id === catId)
                if (catObj) {
                    categoryToFamilyMap[catObj.name] = group.title
                    categoryIdToNameMap[catId] = catObj.name
                }
            })
        })

        // Initialize with ALL families from constants
        const initialFamilyBreakdown = PRODUCT_GROUPS.reduce((acc, group) => {
            acc[group.title] = { name: group.title, total: 0, categories: {} as Record<string, number> }
            return acc
        }, {} as Record<string, { name: string, total: number, categories: Record<string, number> }>)

        // Add "Otros" just in case
        initialFamilyBreakdown["Otros"] = { name: "Otros", total: 0, categories: {} }

        const byFamilyBreakdown = filteredRecords.reduce((acc, r) => {
            const rAny = r as any
            // Logic to find Family:
            // 1. Get Category Name from Record (e.g. "Detergente líquido para ropa")
            const catName = (rAny.categoria_producto || r.familia_producto || "Otros") as string

            // 2. Lookup Family in our Map
            let famName = categoryToFamilyMap[catName]

            // 3. Fallback: Check if the category name itself is a family name (sometimes data entry is mixed)
            if (!famName) {
                const group = PRODUCT_GROUPS.find(g => g.title === catName)
                if (group) famName = group.title
            }

            // 4. Final Fallback
            if (!famName) famName = "Otros"

            // Ensure bucket exists (should always exist if initialized, but "Otros" needs care)
            if (!acc[famName]) {
                acc[famName] = { name: famName, total: 0, categories: {} }
            }

            const val = (r.tamano_lote || 0)

            acc[famName].total += val
            const cleanCatName = catName
            if (!acc[famName].categories[cleanCatName]) acc[famName].categories[cleanCatName] = 0
            acc[famName].categories[cleanCatName] += val

            return acc
        }, initialFamilyBreakdown)

        const familyCharts = Object.values(byFamilyBreakdown)
            .sort((a, b) => {
                if (a.name === "Otros") return 1
                if (b.name === "Otros") return -1
                return b.total - a.total
            })
            .map(f => {
                // Special handling for Automotriz and Antibacterial: show products instead of categories
                if (f.name === "Línea Automotriz" || f.name === "Línea Antibacterial") {
                    // Get all products from this family
                    const productsInFamily = filteredRecords
                        .filter(r => {
                            const rAny = r as any
                            const catName = (rAny.categoria_producto || r.familia_producto || "Otros") as string
                            let famName = categoryToFamilyMap[catName]
                            if (!famName) {
                                const group = PRODUCT_GROUPS.find(g => g.title === catName)
                                if (group) famName = group.title
                            }
                            if (!famName) famName = "Otros"
                            return famName === f.name
                        })
                        .reduce((acc, r) => {
                            const prod = r.codigo_producto
                            if (!acc[prod]) acc[prod] = 0
                            acc[prod] += (r.tamano_lote || 0)
                            return acc
                        }, {} as Record<string, number>)

                    const chartData = Object.entries(productsInFamily)
                        .map(([name, value]) => ({ name, value }))
                        .sort((a, b) => b.value - a.value)

                    return { ...f, chartData }
                } else {
                    // Normal category breakdown for other families
                    const chartData = Object.entries(f.categories)
                        .map(([name, value]) => ({ name, value }))
                        .sort((a, b) => b.value - a.value)
                    return { ...f, chartData }
                }
            })


        // --- 4. Top Products (Specific SKU/Code) ---
        const byProduct = filteredRecords.reduce((acc, r) => {
            const prod = r.codigo_producto
            const rAny = r as any
            // Determine Category for Filter - use categoria_producto or familia_producto
            let catName = (rAny.categoria_producto || r.familia_producto || "Otros") as string

            if (!acc[prod]) acc[prod] = { name: prod, value: 0, type: 'litros', category: catName }

            const isPiece = PIECE_FAMILIES.includes((r.familia_producto || rAny.categoria_producto || '') as string)
            acc[prod].type = isPiece ? 'piezas' : 'litros'
            acc[prod].value += (r.tamano_lote || 0)

            // Update category if we found a better one (e.g. not "Otros")
            if (acc[prod].category === "Otros" && catName !== "Otros") {
                acc[prod].category = catName
            }

            return acc
        }, {} as Record<string, { name: string, value: number, type: 'litros' | 'piezas', category: string }>)

        // Return ALL products sorted
        const topProducts = Object.values(byProduct).sort((a, b) => b.value - a.value)
        const maxProductVal = topProducts.length > 0 ? topProducts[0].value : 0

        // Get unique categories from actual data for filter dropdown
        const uniqueCategories = Array.from(new Set(topProducts.map(p => p.category))).filter(c => c !== "Otros").sort()
        uniqueCategories.push("Otros") // Add "Otros" at the end

        // --- 5. Category Breakdown for Drill-Down (Cuidado del Hogar, Lavandería, Cuidado Personal) ---
        const getCategoryProductBreakdown = (familyName: string) => {
            // Get all categories in this family
            const familyGroup = PRODUCT_GROUPS.find(g => g.title === familyName)
            if (!familyGroup) return []

            const categoryBreakdowns: Array<{ categoryName: string, products: Array<{ name: string, value: number }>, total: number }> = []

            familyGroup.ids.forEach(catId => {
                const catObj = PRODUCT_CATEGORIES.find(c => c.id === catId)
                if (!catObj) return

                // Get all products in this category
                const productsInCategory = filteredRecords
                    .filter(r => {
                        const rAny = r as any
                        const catName = (rAny.categoria_producto || r.familia_producto || "") as string
                        return catName === catObj.name
                    })
                    .reduce((acc, r) => {
                        const prod = r.codigo_producto
                        if (!acc[prod]) acc[prod] = 0
                        acc[prod] += (r.tamano_lote || 0)
                        return acc
                    }, {} as Record<string, number>)

                const products = Object.entries(productsInCategory)
                    .map(([name, value]) => ({ name, value }))
                    .sort((a, b) => b.value - a.value)

                const total = products.reduce((sum, p) => sum + p.value, 0)

                if (total > 0) {
                    categoryBreakdowns.push({
                        categoryName: catObj.name,
                        products,
                        total
                    })
                }
            })

            return categoryBreakdowns.sort((a, b) => b.total - a.total)
        }

        const categoryBreakdowns = {
            "Cuidado del Hogar": getCategoryProductBreakdown("Cuidado del Hogar"),
            "Lavandería": getCategoryProductBreakdown("Lavandería"),
            "Cuidado Personal": getCategoryProductBreakdown("Cuidado Personal")
        }

        // --- 6. Product Variants Data (All Products Aggregated) ---
        const productVariantsData = Object.values(byProduct)
            .sort((a, b) => b.value - a.value)
            .map(p => ({ name: p.name, value: p.value, type: p.type }))

        return {
            sucursalData,
            top3Sucursales,
            categoryData,
            top3Categories,
            familyCharts,
            topProducts,
            maxProductVal,
            uniqueCategories,
            categoryBreakdowns,
            productVariantsData
        }
    }, [filteredRecords])

    // Corporate GINEZ colors - Red and Blue from logo
    const COLORS = ['#C1272D', '#0000A0', '#E63946', '#1E3A8A', '#DC2626', '#1E40AF', '#B91C1C', '#1D4ED8'];

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

                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Todas las categorías" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todas las categorías</SelectItem>
                            {PRODUCT_CATEGORIES.map((cat) => (
                                <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
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

                    <Select value={selectedDateRange} onValueChange={setSelectedDateRange}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Período" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todo el tiempo</SelectItem>
                            <SelectItem value="7d">Últimos 7 días</SelectItem>
                            <SelectItem value="30d">Últimos 30 días</SelectItem>
                            <SelectItem value="3m">Últimos 3 meses</SelectItem>
                            <SelectItem value="6m">Últimos 6 meses</SelectItem>
                            <SelectItem value="1y">Último año</SelectItem>
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
                <Tabs defaultValue="calidad" className="space-y-6">
                    <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
                        <TabsTrigger value="calidad">Calidad y Control</TabsTrigger>
                        <TabsTrigger value="comercial">Análisis Comercial</TabsTrigger>
                    </TabsList>

                    <TabsContent value="calidad" className="space-y-6">
                        {/* KPI Section */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {/* KPI 1: Total Registros + Volumen Total (Merged) - Enhanced */}
                            <Card className="border-none shadow-md bg-gradient-to-br from-blue-900 to-blue-950 text-white dark:from-blue-950 dark:to-slate-900 rounded-[2rem]">
                                <CardContent className="p-8 relative overflow-hidden">
                                    <div className="relative z-10">
                                        {/* Total Registros - Top Section */}
                                        <div className="mb-8">
                                            <p className="text-blue-200 font-semibold mb-3 flex items-center gap-2 text-base">
                                                <Activity className="h-6 w-6" />
                                                Total Registros
                                            </p>
                                            <div className="text-7xl font-extrabold tracking-tight leading-none">
                                                {kpis.total}
                                                <span className="text-3xl font-semibold opacity-80 ml-3">lotes</span>
                                            </div>
                                            <p className="text-base text-blue-200 mt-3 opacity-80 font-medium">
                                                Registros de calidad
                                            </p>
                                        </div>

                                        {/* Divider */}
                                        <div className="border-t border-blue-700 opacity-30 my-6"></div>

                                        {/* Volumen Total - Bottom Section */}
                                        <div>
                                            <p className="text-blue-300 text-sm font-semibold mb-2 flex items-center gap-1.5">
                                                <Factory className="h-4 w-4" />
                                                Volumen Total Producido
                                            </p>
                                            <div className="text-3xl font-extrabold">
                                                {kpis.totalVolume.toLocaleString()}
                                                <span className="text-lg font-semibold opacity-70 ml-2">L</span>
                                            </div>
                                        </div>
                                    </div>
                                    <Activity className="absolute -right-8 -bottom-8 h-48 w-48 text-white opacity-10 rotate-12" />
                                </CardContent>
                            </Card>

                            {/* KPI 2: Total Conformes - Enhanced */}
                            <Card className="border-none shadow-lg dark:bg-slate-900 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-slate-900 dark:to-slate-800 relative overflow-visible rounded-[2rem]">
                                <CardContent className="p-6 h-full flex flex-col justify-between">
                                    <div>
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex-1 pr-12">
                                                <h3 className="text-base font-extrabold text-green-700 dark:text-green-400 tracking-wide mb-2">TOTAL CONFORMES</h3>
                                                <div className="text-5xl font-extrabold text-slate-900 dark:text-white mt-1 leading-none">
                                                    {kpis.conformes}
                                                </div>
                                                <p className="text-sm text-green-700 dark:text-green-400 font-medium mt-2">registros</p>
                                                <div className="flex items-baseline gap-1.5 mt-3">
                                                    <span className="text-3xl font-extrabold text-green-700 dark:text-green-400">
                                                        {kpis.percentConformidad}%
                                                    </span>
                                                    <span className="text-base font-bold text-green-700/70 dark:text-green-400/70">del total</span>
                                                </div>
                                            </div>
                                            <div className="absolute -top-3 -right-3 p-4 bg-green-100 dark:bg-green-900/50 rounded-2xl shadow-lg border-4 border-white dark:border-slate-800">
                                                <TrendingUp className="h-10 w-10 text-green-700 dark:text-green-400" />
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* KPI 3: Semi-Conformes - Enhanced */}
                            <Card className="border-none shadow-lg dark:bg-slate-900 bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-slate-900 dark:to-slate-800 relative overflow-visible rounded-[2rem]">
                                <CardContent className="p-6 h-full flex flex-col justify-between">
                                    <div>
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex-1 pr-12">
                                                <h3 className="text-base font-extrabold text-yellow-700 dark:text-yellow-400 tracking-wide mb-2">SEMI-CONFORMES</h3>
                                                <div className="text-5xl font-extrabold text-slate-900 dark:text-white mt-1 leading-none">
                                                    {kpis.semiConformes}
                                                </div>
                                                <p className="text-sm text-yellow-700 dark:text-yellow-400 font-medium mt-2">registros</p>
                                                <div className="flex items-baseline gap-1.5 mt-3">
                                                    <span className="text-3xl font-extrabold text-yellow-700 dark:text-yellow-400">
                                                        {kpis.percentSemiConformidad}%
                                                    </span>
                                                    <span className="text-base font-bold text-yellow-700/70 dark:text-yellow-400/70">del total</span>
                                                </div>
                                            </div>
                                            <div className="absolute -top-3 -right-3 p-4 bg-yellow-100 dark:bg-yellow-900/50 rounded-2xl shadow-lg border-4 border-white dark:border-slate-800">
                                                <AlertCircle className="h-10 w-10 text-yellow-700 dark:text-yellow-400" />
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* KPI 4: Total No Conformes - Enhanced */}
                            <Card className="border-none shadow-lg dark:bg-slate-900 bg-gradient-to-br from-red-50 to-red-100 dark:from-slate-900 dark:to-slate-800 relative overflow-visible rounded-[2rem]">
                                <CardContent className="p-6 h-full flex flex-col justify-between">
                                    <div>
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex-1 pr-12">
                                                <h3 className="text-base font-extrabold text-red-700 dark:text-red-400 tracking-wide mb-2">NO CONFORMES</h3>
                                                <div className="text-5xl font-extrabold text-slate-900 dark:text-white mt-1 leading-none">
                                                    {kpis.noConformes}
                                                </div>
                                                <p className="text-sm text-red-700 dark:text-red-400 font-medium mt-2">registros</p>
                                                <div className="flex items-baseline gap-1.5 mt-3">
                                                    <span className="text-3xl font-extrabold text-red-700 dark:text-red-400">
                                                        {kpis.percentNoConformidad}%
                                                    </span>
                                                    <span className="text-base font-bold text-red-700/70 dark:text-red-400/70">del total</span>
                                                </div>
                                            </div>
                                            <div className="absolute -top-3 -right-3 p-4 bg-red-100 dark:bg-red-900/50 rounded-2xl shadow-lg border-4 border-white dark:border-slate-800">
                                                <Activity className="h-10 w-10 text-red-700 dark:text-red-400" />
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Charts Section - Full Width Stacked */}
                        <div className="grid grid-cols-1 gap-6">
                            {/* Conformidad por Sucursal - Full Width */}
                            <Card className="border-none shadow-sm dark:bg-slate-900 rounded-[2rem]">
                                <CardHeader>
                                    <CardTitle className="text-lg font-bold">Conformidad por Sucursal</CardTitle>
                                    <CardDescription>Volumen de producción conforme vs no conforme</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="h-[400px] w-full">
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
                                                <Bar dataKey="conformes" name="Conformes" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} />
                                                <Bar dataKey="semiConformes" name="Semi-Conformes" stackId="a" fill="#eab308" radius={[0, 0, 0, 0]} />
                                                <Bar dataKey="noConformes" name="No Conformes" stackId="a" fill="#C1272D" radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Pareto de Defectos - Full Width */}
                            <Card className="border-none shadow-sm dark:bg-slate-900 rounded-[2rem]">
                                <CardHeader>
                                    <CardTitle className="text-lg font-bold">Pareto de Defectos</CardTitle>
                                    <CardDescription>Frecuencia de fallos por parámetro de calidad</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="h-[400px] w-full">
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
                                                <Bar yAxisId="left" dataKey="count" name="Cantidad Fallos" fill="#C1272D" barSize={40} radius={[4, 4, 0, 0]} />
                                                <Line yAxisId="right" type="monotone" dataKey="accumulatedPercent" name="% Acumulado" stroke="#0000A0" strokeWidth={2} dot={{ r: 4 }} />
                                            </ComposedChart>
                                        </ResponsiveContainer>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Secondary Filters - Compact Design for Control Charts */}
                        <Card className="border-none shadow-sm bg-gradient-to-r from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-950/30 rounded-[2rem]">
                            <CardContent className="p-4">
                                <div className="flex flex-wrap items-center gap-3">
                                    <div className="flex items-center gap-2">
                                        <Filter className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Filtros Rápidos:</span>
                                    </div>

                                    {/* Sucursal Filter */}
                                    <div className="flex flex-col gap-0.5">
                                        <Select value={selectedSucursal} onValueChange={setSelectedSucursal}>
                                            <SelectTrigger className="h-9 w-[160px] bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700">
                                                <SelectValue placeholder="Sucursal" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Todas</SelectItem>
                                                {SUCURSALES.map((suc: string) => (
                                                    <SelectItem key={suc} value={suc}>{suc}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <span className="text-[10px] text-slate-400 dark:text-slate-500 px-1">Ubicación</span>
                                    </div>

                                    {/* Category Filter */}
                                    <div className="flex flex-col gap-0.5">
                                        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                                            <SelectTrigger className="h-9 w-[160px] bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700">
                                                <SelectValue placeholder="Categoría" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Todas</SelectItem>
                                                {PRODUCT_CATEGORIES.map((cat) => (
                                                    <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <span className="text-[10px] text-slate-400 dark:text-slate-500 px-1">Familia</span>
                                    </div>

                                    {/* Product Filter */}
                                    <div className="flex flex-col gap-0.5">
                                        <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                                            <SelectTrigger className="h-9 w-[160px] bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700">
                                                <SelectValue placeholder="Producto" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Todos</SelectItem>
                                                {uniqueProducts.map((p) => (
                                                    <SelectItem key={p} value={p}>{p}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <span className="text-[10px] text-slate-400 dark:text-slate-500 px-1">Código</span>
                                    </div>

                                    {/* Date Filter */}
                                    <div className="flex flex-col gap-0.5">
                                        <Select value={selectedDateRange} onValueChange={setSelectedDateRange}>
                                            <SelectTrigger className="h-9 w-[160px] bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700">
                                                <SelectValue placeholder="Fecha" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Todo</SelectItem>
                                                <SelectItem value="7d">7 días</SelectItem>
                                                <SelectItem value="30d">30 días</SelectItem>
                                                <SelectItem value="3m">3 meses</SelectItem>
                                                <SelectItem value="6m">6 meses</SelectItem>
                                                <SelectItem value="1y">1 año</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <span className="text-[10px] text-slate-400 dark:text-slate-500 px-1">Período</span>
                                    </div>

                                    <div className="ml-auto flex items-center gap-2">
                                        <span className="text-xs text-slate-500 dark:text-slate-400">
                                            {filteredRecords.length} registros
                                        </span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Row 2: Control Charts (Solids & pH) */}
                        <div className="grid grid-cols-1 gap-6">
                            {/* 1. Gráfico de Sólidos (Primero) */}
                            <Card className="border-none shadow-sm dark:bg-slate-900 rounded-[2rem]">
                                <CardHeader>
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <CardTitle className="text-lg font-bold">Gráfico de Control: % Sólidos</CardTitle>
                                            <CardDescription>Historial de mediciones de Sólidos de todos los lotes</CardDescription>
                                        </div>
                                        {selectedProduct !== "all" && currentStandards?.solids && (
                                            <div className="text-xs text-slate-500 text-right">
                                                Std: <span className="font-mono font-bold">{(currentStandards.solids.min || 0)}% - {(currentStandards.solids.max || 0)}%</span>
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
                                                        <ReferenceLine y={(currentStandards.solids.max || 0) * 1.05} label={{ value: 'TLS (+5%)', position: 'insideTopRight', fill: '#eab308', fontSize: 10 }} stroke="#eab308" strokeDasharray="5 5" strokeWidth={2} />
                                                        <ReferenceLine y={(currentStandards.solids.min || 0) * 0.95} label={{ value: 'TLI (-5%)', position: 'insideBottomRight', fill: '#eab308', fontSize: 10 }} stroke="#eab308" strokeDasharray="5 5" strokeWidth={2} />

                                                        {/* Standard Limits (Rango Estándar) - RED */}
                                                        <ReferenceLine y={(currentStandards.solids.max || 0)} label={{ value: 'LCS', position: 'insideTopRight', fill: '#C1272D', fontSize: 10, dy: 10 }} stroke="#C1272D" strokeWidth={2} />
                                                        <ReferenceLine y={(currentStandards.solids.min || 0)} label={{ value: 'LCI', position: 'insideBottomRight', fill: '#C1272D', fontSize: 10, dy: -10 }} stroke="#C1272D" strokeWidth={2} />
                                                    </>
                                                )}

                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* 2. Gráfico de pH (Segundo) */}
                            <Card className="border-none shadow-sm dark:bg-slate-900 rounded-[2rem]">
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
                                                <Line type="monotone" dataKey="ph" name="Valor pH" stroke="#0000A0" strokeWidth={2} dot={{ r: 3, fill: '#0000A0' }} activeDot={{ r: 6 }} />

                                                {/* Reference Lines for pH */}
                                                {selectedProduct !== "all" && currentStandards?.ph && (
                                                    <>
                                                        <ReferenceLine y={currentStandards.ph.max} label={{ value: 'LCS', position: 'insideTopRight', fill: '#C1272D', fontSize: 10 }} stroke="#C1272D" strokeWidth={2} />
                                                        <ReferenceLine y={currentStandards.ph.min} label={{ value: 'LCI', position: 'insideBottomRight', fill: '#C1272D', fontSize: 10 }} stroke="#C1272D" strokeWidth={2} />
                                                    </>
                                                )}
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    <TabsContent value="comercial" className="space-y-6 animate-in fade-in-50 duration-500">
                        {/* Commercial KPIs */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {/* KPI 1: Volumen Total + Unidades (Merged) - Enhanced */}
                            <Card className="border-none shadow-md bg-gradient-to-br from-blue-900 to-blue-950 text-white dark:from-blue-950 dark:to-slate-900 md:col-span-2 rounded-[2rem]">
                                <CardContent className="p-6 relative overflow-hidden">
                                    <div className="relative z-10">
                                        {/* Volumen Total - Top Section */}
                                        <div className="mb-6">
                                            <p className="text-blue-200 font-medium mb-2 flex items-center gap-2">
                                                <Factory className="h-5 w-5" />
                                                Volumen Total
                                            </p>
                                            <div className="text-5xl font-extrabold tracking-tight">
                                                {kpis.totalVolume.toLocaleString()}
                                                <span className="text-2xl font-normal opacity-80 ml-2">L/Kg</span>
                                            </div>
                                            <p className="text-sm text-blue-200 mt-2 opacity-80">
                                                Producción acumulada
                                            </p>
                                        </div>

                                        {/* Divider */}
                                        <div className="border-t border-blue-700 opacity-30 my-4"></div>

                                        {/* Unidades (Bases) - Bottom Section */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-blue-300 text-sm font-semibold mb-2 flex items-center gap-1.5">
                                                    <Package className="h-4 w-4" />
                                                    Piezas (Bases)
                                                </p>
                                                <div className="text-3xl font-bold">
                                                    {kpis.totalPieces.toLocaleString()}
                                                    <span className="text-base font-normal opacity-70 ml-1">pzas</span>
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-blue-300 text-sm font-semibold mb-2 flex items-center gap-1.5">
                                                    <Activity className="h-4 w-4" />
                                                    Rendimiento PT
                                                </p>
                                                <div className="text-3xl font-bold">
                                                    {(kpis.totalPieces * 20).toLocaleString()}
                                                    <span className="text-base font-normal opacity-70 ml-1">L</span>
                                                </div>
                                                <p className="text-xs text-blue-300 opacity-60 mt-1">
                                                    (20L por pieza)
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <Factory className="absolute -right-8 -bottom-8 h-40 w-40 text-white opacity-10 rotate-12" />
                                </CardContent>
                            </Card>

                            {/* KPI 3: Categoría Leader + Top 3 - Enhanced */}
                            <Card className="border-none shadow-lg dark:bg-slate-900 bg-gradient-to-br from-red-50 to-red-100 dark:from-slate-900 dark:to-slate-800 relative overflow-visible rounded-[2rem]">
                                <CardContent className="p-8 h-full flex flex-col justify-between">
                                    <div>
                                        <div className="flex justify-between items-start mb-6">
                                            <div className="flex-1 pr-12">
                                                <h3 className="text-xs font-semibold text-red-700 dark:text-red-400 uppercase tracking-wider mb-2">Categoría Más Producida</h3>
                                                <div className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1 leading-tight">
                                                    {commercialData.top3Categories.length > 0 ? commercialData.top3Categories[0].name : '-'}
                                                </div>
                                                <p className="text-lg text-red-700 dark:text-red-400 font-bold mt-3">
                                                    {commercialData.top3Categories.length > 0 ? `${commercialData.top3Categories[0].value.toLocaleString()} ${commercialData.top3Categories[0].type}` : ''}
                                                </p>
                                            </div>
                                            <div className="absolute -top-3 -right-3 p-4 bg-red-100 dark:bg-red-900/50 rounded-2xl shadow-lg border-4 border-white dark:border-slate-800">
                                                <TrendingUp className="h-10 w-10 text-red-700 dark:text-red-400" />
                                            </div>
                                        </div>

                                        {/* Top 3 Small List */}
                                        <div className="space-y-3 pt-4 border-t-2 border-red-200 dark:border-slate-700">
                                            {commercialData.top3Categories.slice(1).map((cat, i) => (
                                                <div key={i} className="flex justify-between items-center">
                                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate max-w-[140px]">{cat.name}</span>
                                                    <span className="text-sm font-bold font-mono text-red-700 dark:text-red-400">{cat.value.toLocaleString()}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* KPI 4: Sucursal Leader + Top 3 - Enhanced */}
                            <Card className="border-none shadow-lg dark:bg-slate-900 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-900 dark:to-slate-800 relative overflow-visible rounded-[2rem]">
                                <CardContent className="p-8 h-full flex flex-col justify-between">
                                    <div>
                                        <div className="flex justify-between items-start mb-6">
                                            <div className="flex-1 pr-12">
                                                <h3 className="text-xs font-semibold text-blue-900 dark:text-blue-400 uppercase tracking-wider mb-2">Sucursal Líder</h3>
                                                <div className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1 leading-tight">
                                                    {commercialData.top3Sucursales.length > 0 ? commercialData.top3Sucursales[0].name : '-'}
                                                </div>
                                                <p className="text-lg text-blue-900 dark:text-blue-400 font-bold mt-3">
                                                    {commercialData.top3Sucursales.length > 0 ? `${commercialData.top3Sucursales[0].litros.toLocaleString()} L` : ''}
                                                </p>
                                            </div>
                                            <div className="absolute -top-3 -right-3 p-4 bg-blue-100 dark:bg-blue-900/50 rounded-2xl shadow-lg border-4 border-white dark:border-slate-800">
                                                <Trophy className="h-10 w-10 text-blue-900 dark:text-blue-400" />
                                            </div>
                                        </div>

                                        {/* Top 3 Small List */}
                                        <div className="space-y-3 pt-4 border-t-2 border-blue-200 dark:border-slate-700">
                                            {commercialData.top3Sucursales.slice(1).map((suc, i) => (
                                                <div key={i} className="flex justify-between items-center">
                                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate max-w-[140px]">{suc.name}</span>
                                                    <span className="text-sm font-bold font-mono text-blue-900 dark:text-blue-400">{suc.litros.toLocaleString()} L</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Chart 1: Production by Sucursal (Full Width) */}
                        <Card className="border-none shadow-sm dark:bg-slate-900 rounded-[2rem]">
                            <CardHeader>
                                <CardTitle className="text-lg font-bold">Producción Total por Sucursal (Litros)</CardTitle>
                                <CardDescription>Comparativa de volumen de producción entre todas las sucursales</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[350px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={commercialData.sucursalData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                            <XAxis dataKey="name" fontSize={11} angle={-45} textAnchor="end" interval={0} tick={{ fill: '#64748b' }} />
                                            <YAxis fontSize={12} tickLine={false} axisLine={false} />
                                            <Tooltip
                                                cursor={{ fill: '#F1F5F9' }}
                                                contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            />
                                            <Bar dataKey="litros" name="Litros" fill="#C1272D" radius={[4, 4, 0, 0]}>
                                                {commercialData.sucursalData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={index === 0 ? '#C1272D' : '#E63946'} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Product Variants Donut Chart */}
                        <Card className="border-none shadow-sm dark:bg-slate-900 rounded-[2rem]">
                            <CardHeader>
                                <CardTitle className="text-lg font-bold">Distribución de Productos por Variante</CardTitle>
                                <CardDescription>Proporción de todos los productos por SKU/Código</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[400px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={commercialData.productVariantsData.slice(0, 20)}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={80}
                                                outerRadius={140}
                                                paddingAngle={2}
                                                dataKey="value"
                                                stroke="none"
                                                label={(entry) => {
                                                    const total = commercialData.productVariantsData.slice(0, 20).reduce((sum, p) => sum + p.value, 0)
                                                    const percent = ((entry.value / total) * 100).toFixed(1)
                                                    return parseFloat(percent) > 3 ? `${entry.name}` : ''
                                                }}
                                                labelLine={true}
                                            >
                                                {commercialData.productVariantsData.slice(0, 20).map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                formatter={(value: any, name: any, props: any) => {
                                                    const total = commercialData.productVariantsData.slice(0, 20).reduce((sum, p) => sum + p.value, 0)
                                                    const percent = ((value / total) * 100).toFixed(1)
                                                    const type = props.payload.type === 'litros' ? 'L' : 'Pzas'
                                                    return [`${value.toLocaleString()} ${type} (${percent}%)`, name]
                                                }}
                                            />
                                            <Legend
                                                layout="vertical"
                                                align="right"
                                                verticalAlign="middle"
                                                iconType="circle"
                                                formatter={(value, entry: any) => {
                                                    const total = commercialData.productVariantsData.slice(0, 20).reduce((sum, p) => sum + p.value, 0)
                                                    const percent = ((entry.payload.value / total) * 100).toFixed(1)
                                                    return `${value}: ${percent}%`
                                                }}
                                                wrapperStyle={{ fontSize: '11px', maxHeight: '380px', overflowY: 'auto' }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="mt-4 text-center text-xs text-slate-500">
                                    Mostrando los top 20 productos más producidos
                                </div>
                            </CardContent>
                        </Card>

                        {/* Top Products & Family Distribution Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                            <Card className="border-none shadow-sm dark:bg-slate-900 col-span-1 lg:col-span-1 flex flex-col rounded-[2rem]">
                                <CardHeader className="flex flex-row items-center justify-between pb-2">
                                    <div className="space-y-1">
                                        <CardTitle className="text-lg font-bold">Ranking de Productos</CardTitle>
                                        <CardDescription>Los más producidos globalmente</CardDescription>
                                    </div>
                                </CardHeader>
                                <div className="px-6 pb-2">
                                    <Select value={rankingCategoryFilter} onValueChange={setRankingCategoryFilter}>
                                        <SelectTrigger className="w-full text-xs h-8">
                                            <SelectValue placeholder="Filtrar por categoría" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Todas las categorías</SelectItem>
                                            {PRODUCT_CATEGORIES.map(cat => (
                                                <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <CardContent className="flex-1 overflow-auto max-h-[800px] pt-2">
                                    <div className="space-y-5">
                                        {commercialData.topProducts
                                            .filter(p => rankingCategoryFilter === "all" || p.category === rankingCategoryFilter)
                                            .slice(0, showAllProducts ? undefined : 5)
                                            .map((prod, i) => (
                                                <div key={prod.name} className="relative">
                                                    <div className="flex justify-between items-end mb-1 z-10 relative">
                                                        <div>
                                                            <span className="text-xs font-bold text-slate-400 mr-2">#{i + 1}</span>
                                                            <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">{prod.name}</span>
                                                        </div>
                                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                                            {prod.value.toLocaleString()} <span className="text-[10px] font-normal text-slate-500">{prod.type === 'litros' ? 'L' : 'Pzas'}</span>
                                                        </span>
                                                    </div>
                                                    {/* Progress Bar Background */}
                                                    <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-blue-500 rounded-full"
                                                            style={{ width: `${(prod.value / commercialData.maxProductVal) * 100}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        {commercialData.topProducts.filter(p => rankingCategoryFilter === "all" || p.category === rankingCategoryFilter).length === 0 && (
                                            <div className="text-center py-8 text-slate-500 text-sm">
                                                No hay productos en esta categoría
                                            </div>
                                        )}
                                    </div>
                                    <div className="mt-6 text-center">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setShowAllProducts(!showAllProducts)}
                                            className="w-full text-xs"
                                        >
                                            {showAllProducts ? "Ver Menos" : `Ver Todos`}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Right Column: Family Breakdowns (Donut Charts Grid) */}
                            <div className="col-span-1 lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                                {commercialData.familyCharts.map((family, idx) => (
                                    <Card key={family.name} className="border-none shadow-sm dark:bg-slate-900 rounded-[2rem]">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-base font-bold truncate" title={family.name}>
                                                {family.name}
                                            </CardTitle>
                                            <CardDescription className="text-xs">
                                                Total: {family.total.toLocaleString()}
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="h-[200px] w-full relative">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <PieChart>
                                                        <Pie
                                                            data={family.chartData}
                                                            cx="50%"
                                                            cy="50%"
                                                            innerRadius={45}
                                                            outerRadius={70}
                                                            paddingAngle={2}
                                                            dataKey="value"
                                                            stroke="none"
                                                            label={(entry) => {
                                                                const percent = ((entry.value / family.total) * 100).toFixed(1)
                                                                return `${percent}%`
                                                            }}
                                                            labelLine={false}
                                                        >
                                                            {family.chartData.map((entry, index) => (
                                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                            ))}
                                                        </Pie>
                                                        <Tooltip
                                                            formatter={(value: any, name: any) => {
                                                                const percent = ((value / family.total) * 100).toFixed(1)
                                                                return [`${value.toLocaleString()} (${percent}%)`, name]
                                                            }}
                                                        />
                                                    </PieChart>
                                                </ResponsiveContainer>
                                                {/* Center Label for Top Category in Family */}
                                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                    <div className="text-center">
                                                        <span className="block text-xs text-slate-500">Top</span>
                                                        <span className="block text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[80px]">
                                                            {family.chartData.length > 0 ? family.chartData[0].name.split(" ")[0] : '-'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            {/* Legend */}
                                            <div className="mt-2 flex flex-wrap gap-2 justify-center">
                                                {family.chartData.slice(0, 3).map((item, i) => {
                                                    const percent = ((item.value / family.total) * 100).toFixed(1)
                                                    return (
                                                        <div key={i} className="flex items-center text-[10px] text-slate-500">
                                                            <span className="w-2 h-2 rounded-full mr-1" style={{ backgroundColor: COLORS[i % COLORS.length] }}></span>
                                                            <span className="truncate max-w-[80px]">{item.name}: {percent}%</span>
                                                        </div>
                                                    )
                                                })}
                                            </div>

                                            {/* Ver Categorías Button (Only for specific families) */}
                                            {(family.name === "Cuidado del Hogar" || family.name === "Lavandería" || family.name === "Cuidado Personal") && (
                                                <div className="mt-4">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => setDrillDownFamily(family.name)}
                                                        className="w-full text-xs flex items-center justify-center gap-1"
                                                    >
                                                        Ver Categorías <ChevronRight className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            )}

            {/* Drill-Down Modal for Category Breakdowns */}
            <Dialog open={drillDownFamily !== null} onOpenChange={(open) => !open && setDrillDownFamily(null)}>
                <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold">{drillDownFamily} - Desglose por Categorías</DialogTitle>
                        <DialogDescription>
                            Productos individuales dentro de cada categoría de {drillDownFamily}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                        {drillDownFamily && commercialData.categoryBreakdowns[drillDownFamily as keyof typeof commercialData.categoryBreakdowns]?.map((category, idx) => (
                            <Card key={category.categoryName} className="border-none shadow-sm dark:bg-slate-900 rounded-[2rem]">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base font-bold">{category.categoryName}</CardTitle>
                                    <CardDescription className="text-xs">
                                        Total: {category.total.toLocaleString()}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="h-[250px] w-full relative">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={category.products}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={50}
                                                    outerRadius={80}
                                                    paddingAngle={2}
                                                    dataKey="value"
                                                    stroke="none"
                                                    label={(entry) => {
                                                        const percent = ((entry.value / category.total) * 100).toFixed(1)
                                                        return parseFloat(percent) > 5 ? `${percent}%` : ''
                                                    }}
                                                    labelLine={false}
                                                >
                                                    {category.products.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip
                                                    formatter={(value: any, name: any) => {
                                                        const percent = ((value / category.total) * 100).toFixed(1)
                                                        return [`${value.toLocaleString()} (${percent}%)`, name]
                                                    }}
                                                />
                                            </PieChart>
                                        </ResponsiveContainer>
                                        {/* Center Label for Top Product */}
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                            <div className="text-center">
                                                <span className="block text-xs text-slate-500">Top</span>
                                                <span className="block text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[80px]">
                                                    {category.products.length > 0 ? category.products[0].name : '-'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    {/* Legend */}
                                    <div className="mt-3 space-y-1">
                                        {category.products.slice(0, 5).map((item, i) => {
                                            const percent = ((item.value / category.total) * 100).toFixed(1)
                                            return (
                                                <div key={i} className="flex items-center justify-between text-xs">
                                                    <div className="flex items-center gap-2">
                                                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }}></span>
                                                        <span className="text-slate-700 dark:text-slate-300 truncate">{item.name}</span>
                                                    </div>
                                                    <span className="font-semibold text-slate-800 dark:text-slate-200">{percent}%</span>
                                                </div>
                                            )
                                        })}
                                        {category.products.length > 5 && (
                                            <div className="text-xs text-slate-500 text-center pt-2">
                                                +{category.products.length - 5} productos más
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {drillDownFamily && commercialData.categoryBreakdowns[drillDownFamily as keyof typeof commercialData.categoryBreakdowns]?.length === 0 && (
                        <div className="text-center py-12 text-slate-500">
                            No hay datos disponibles para esta familia
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}

