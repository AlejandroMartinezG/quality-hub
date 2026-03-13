"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/AuthProvider"
import { supabase } from "@/lib/supabase"
import { analyzeRecord, EnrichedRecord } from "@/lib/analysis-utils"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Loader2, RefreshCcw, Filter, Download, Factory, Trophy, TrendingUp, Package, Activity, AlertCircle, ChevronRight, Printer } from "lucide-react"
import { PrintReportWrapper } from "@/components/PrintReportWrapper"
import { DateRangeModal } from "@/components/DateRangeModal"
import { toast } from "sonner"
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
import SPYReportPage from "./spy/page"

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
    const { user, profile, loading: authLoading } = useAuth()
    const router = useRouter()
    const [records, setRecords] = useState<EnrichedRecord[]>([])
    const [loading, setLoading] = useState(true)

    const role = profile?.role?.toLowerCase() || ''
    const isPreparador = role === 'preparador'
    const isGerente = role === 'gerente_sucursal' || role === 'gerente'
    const isGlobalRole = role === 'admin' || role === 'gerente_calidad' || role === 'coordinador'

    // Filters
    const [selectedSucursal, setSelectedSucursal] = useState("all")
    const [selectedBranch, setSelectedBranch] = useState<string>("all")
    const [selectedProduct, setSelectedProduct] = useState<string>("all")
    const [selectedCategory, setSelectedCategory] = useState<string>("all") // NEW: Category filter
    const [selectedPreparer, setSelectedPreparer] = useState<string>("all") // NEW: Preparer filter
    const [dateRange, setDateRange] = useState<string>("all")
    const [showAllProducts, setShowAllProducts] = useState(false)
    const [rankingCategoryFilter, setRankingCategoryFilter] = useState<string>("all")
    const [selectedDateRange, setSelectedDateRange] = useState("all") // Date range filter

    // Drill-down modal state
    const [drillDownFamily, setDrillDownFamily] = useState<string | null>(null)

    // Print report state
    const [printModal, setPrintModal] = useState<'comercial' | 'calidad' | null>(null)
    const [printView, setPrintView] = useState<{ tab: string, dateFrom: string, dateTo: string } | null>(null)

    const handlePrintConfirm = (tab: string) => (dateFrom: string, dateTo: string) => {
        setPrintModal(null)
        setPrintView({ tab, dateFrom, dateTo })
    }


    // Permissions check
    useEffect(() => {
        if (!authLoading && profile) {
            const allowedRoles = ['admin', 'gerente_calidad', 'coordinador', 'gerente_sucursal', 'gerente', 'preparador']
            if (!allowedRoles.includes(role)) {
                toast.error("Acceso restringido", {
                    description: "No tienes permisos para acceder al módulo de Reportes."
                })
                router.push('/')
            }
        }
    }, [profile, authLoading, role, router])

    useEffect(() => {
        if (user && profile) {
            console.log("ReportesPage: User authenticated, fetching data...")
            fetchData()
        } else if (!authLoading) {
            console.log("ReportesPage: No user found and auth finished.")
            setLoading(false)
        } else {
            console.log("ReportesPage: Waiting for auth...")
        }
    }, [user, profile?.role, authLoading])

    // Enforce sucursal filter for branch managers
    useEffect(() => {
        if (isGerente && profile?.sucursal) {
            setSelectedSucursal(profile.sucursal)
        }
    }, [isGerente, profile?.sucursal])

    const fetchData = async () => {
        setLoading(true)
        console.log("ReportesPage: fetchData started")
        try {
            let query = supabase
                .from('bitacora_produccion_calidad')
                .select('*')

            if (isPreparador) {
                query = query.eq('user_id', user.id)
            } else if (isGerente && profile?.sucursal) {
                query = query.eq('sucursal', profile.sucursal)
            }

            const { data, error } = await query
                .order('created_at', { ascending: true }) // Ascending for charts

            if (error) {
                console.error("ReportesPage: Supabase error", error)
                throw error
            }

            if (data) {
                console.log(`ReportesPage: Fetched ${data.length} records`)
                // Analyze all records
                const analyzed = data.map(analyzeRecord)
                setRecords(analyzed)
            } else {
                console.log("ReportesPage: No data returned")
            }
        } catch (error: any) {
            console.error("ReportesPage: Fetch error", error)
            toast.error("Error al cargar datos", {
                description: error.message || "Verifica tu conexión o contacta a soporte."
            })
        } finally {
            setLoading(false)
            console.log("ReportesPage: Loading set to false")
        }
    }

    // --- Data Processing for Charts ---

    // Get unique products for filter
    const uniqueProducts = useMemo(() => {
        const products = new Set(records.map(r => r.codigo_producto))
        return Array.from(products).sort()
    }, [records])

    // Get unique preparers for filter
    const uniquePreparers = useMemo(() => {
        const preparers = new Set(records.map(r => r.nombre_preparador).filter(Boolean))
        return Array.from(preparers).sort()
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

            // Filter by preparer
            if (selectedPreparer !== "all" && r.nombre_preparador !== selectedPreparer) return false

            // Filter by date range
            if (dateThreshold && r.fecha_fabricacion) {
                const recordDate = new Date(r.fecha_fabricacion)
                if (recordDate < dateThreshold) return false
            }

            return true
        })
    }, [records, selectedSucursal, selectedCategory, selectedProduct, selectedPreparer, selectedDateRange])

    // Filter records by print date range
    const printFilteredRecords = useMemo(() => {
        if (!printView) return [] as EnrichedRecord[]
        const from = new Date(printView.dateFrom + 'T00:00:00')
        const to = new Date(printView.dateTo + 'T23:59:59')
        return filteredRecords.filter(r => {
            if (!r.fecha_fabricacion) return false
            const d = new Date(r.fecha_fabricacion)
            return d >= from && d <= to
        })
    }, [printView, filteredRecords])

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

        // pH KPIs
        const conformesPH = filteredRecords.filter(r => r.analysis.phStatus === 'conforme').length
        const noConformesPH = filteredRecords.filter(r => r.analysis.phStatus === 'no-conforme').length

        const percentConformidadPH = total > 0 ? ((conformesPH / total) * 100).toFixed(1) : "0.0"
        const percentNoConformidadPH = total > 0 ? ((noConformesPH / total) * 100).toFixed(1) : "0.0"

        return {
            total,
            conformes,
            semiConformes,
            noConformes,
            percentConformidad,
            percentSemiConformidad,
            percentNoConformidad,
            totalVolume,
            totalPieces,
            conformesPH,
            noConformesPH,
            percentConformidadPH,
            percentNoConformidadPH
        }
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

    if (loading) {
        return (
            <div className="h-screen flex flex-col items-center justify-center space-y-4">
                <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
                <p className="text-slate-500">Cargando datos...</p>
            </div>
        )
    }

    if (!user) {
        return (
            <div className="h-screen flex flex-col items-center justify-center space-y-6">
                <AlertCircle className="h-16 w-16 text-yellow-500" />
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Sesión no iniciada</h2>
                <p className="text-slate-500 max-w-md text-center">
                    No se detectó una sesión activa. Por favor inicia sesión nuevamente para ver los reportes.
                </p>
                <Button onClick={() => window.location.href = '/login'}>
                    Ir al Login
                </Button>
            </div>
        )
    }

    return (
        <>
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
                    {!isPreparador && !isGerente && (
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
                    )}

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

                    {!isPreparador && (
                        <Select value={selectedPreparer} onValueChange={setSelectedPreparer}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Todos los preparadores" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos los preparadores</SelectItem>
                                {uniquePreparers.map((p) => (
                                    <SelectItem key={p} value={p}>{p}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}

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
                <Tabs defaultValue={(isPreparador || isGerente) ? "calidad" : "comercial"} className="space-y-6">
                    <TabsList className={`grid w-full ${(isPreparador || isGerente) ? 'grid-cols-2 max-w-[400px]' : 'grid-cols-3 max-w-[600px]'}`}>
                        {(!isPreparador && !isGerente) && <TabsTrigger value="comercial">Análisis Comercial</TabsTrigger>}
                        <TabsTrigger value="calidad">First Time Quality</TabsTrigger>
                        <TabsTrigger value="spy">SPY (Yield)</TabsTrigger>
                    </TabsList>

                    <TabsContent value="spy" className="space-y-6">
                        <SPYReportPage />
                    </TabsContent>

                    <TabsContent value="calidad" className="space-y-6">
                        {/* Print Button */}
                        <div className="flex justify-end">
                            <Button
                                variant="outline"
                                size="sm"
                                className="rounded-full gap-2 text-[#0e0c9b] border-[#0e0c9b]/30 hover:bg-[#0e0c9b]/5"
                                onClick={() => setPrintModal('calidad')}
                            >
                                <Printer className="h-4 w-4" />
                                Generar Reporte
                            </Button>
                        </div>
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

                            {/* Pareto de Defectos - Now in Top Row occupying 3 columns */}
                            <Card className="border-none shadow-sm dark:bg-slate-900 rounded-[2rem] md:col-span-1 lg:col-span-3">
                                <CardHeader>
                                    <CardTitle className="text-lg font-bold">Pareto de Defectos</CardTitle>
                                    <CardDescription>Frecuencia de fallos por parámetro de calidad</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="h-[320px] w-full">
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
                        </div>

                        {/* Titulo Conformidad Solidos */}
                        <div className="mb-2 mt-4">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Conformidad del % de sólidos</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Desglose de lotes según cumplimiento de especificaciones de sólidos.
                            </p>
                        </div>

                        {/* KPI Cards Row (Moved Down) */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

                        {/* Secondary Filters - Compact Design for Control Charts */}
                        <Card className="border-none shadow-sm bg-gradient-to-r from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-950/30 rounded-[2rem]">
                            <CardContent className="p-4">
                                <div className="flex flex-wrap items-center gap-3">
                                    <div className="flex items-center gap-2">
                                        <Filter className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Filtros Rápidos:</span>
                                    </div>

                                    {/* Sucursal Filter - Hidden for branch roles */}
                                    {!isGerente && !isPreparador && (
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
                                    )}

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

                            {/* Titulo Conformidad pH */}
                            <div className="mb-2 mt-8">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Conformidad de pH</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    Desglose de lotes según cumplimiento de especificaciones de pH.
                                </p>
                            </div>

                            {/* KPI Cards Row for pH */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                {/* KPI 1: pH Conformes */}
                                <Card className="border-none shadow-lg dark:bg-slate-900 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-slate-900 dark:to-slate-800 relative overflow-visible rounded-[2rem]">
                                    <CardContent className="p-6 h-full flex flex-col justify-between">
                                        <div>
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="flex-1 pr-12">
                                                    <h3 className="text-base font-extrabold text-green-700 dark:text-green-400 tracking-wide mb-2">TOTAL CONFORMES</h3>
                                                    <div className="text-5xl font-extrabold text-slate-900 dark:text-white mt-1 leading-none">
                                                        {kpis.conformesPH}
                                                    </div>
                                                    <p className="text-sm text-green-700 dark:text-green-400 font-medium mt-2">registros</p>
                                                    <div className="flex items-baseline gap-1.5 mt-3">
                                                        <span className="text-3xl font-extrabold text-green-700 dark:text-green-400">
                                                            {kpis.percentConformidadPH}%
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

                                {/* KPI 2: pH No Conformes */}
                                <Card className="border-none shadow-lg dark:bg-slate-900 bg-gradient-to-br from-red-50 to-red-100 dark:from-slate-900 dark:to-slate-800 relative overflow-visible rounded-[2rem]">
                                    <CardContent className="p-6 h-full flex flex-col justify-between">
                                        <div>
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="flex-1 pr-12">
                                                    <h3 className="text-base font-extrabold text-red-700 dark:text-red-400 tracking-wide mb-2">NO CONFORMES</h3>
                                                    <div className="text-5xl font-extrabold text-slate-900 dark:text-white mt-1 leading-none">
                                                        {kpis.noConformesPH}
                                                    </div>
                                                    <p className="text-sm text-red-700 dark:text-red-400 font-medium mt-2">registros</p>
                                                    <div className="flex items-baseline gap-1.5 mt-3">
                                                        <span className="text-3xl font-extrabold text-red-700 dark:text-red-400">
                                                            {kpis.percentNoConformidadPH}%
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

                    {(!isPreparador && !isGerente) && (
                        <TabsContent value="comercial" className="space-y-6 animate-in fade-in-50 duration-500">
                            {/* Print Button */}
                            <div className="flex justify-end">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="rounded-full gap-2 text-[#0e0c9b] border-[#0e0c9b]/30 hover:bg-[#0e0c9b]/5"
                                    onClick={() => setPrintModal('comercial')}
                                >
                                    <Printer className="h-4 w-4" />
                                    Generar Reporte
                                </Button>
                            </div>
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
                                                    <span className="text-2xl font-normal opacity-80 ml-2">L</span>
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
                                                {/* Labels in proper black */}
                                                <XAxis dataKey="name" fontSize={11} angle={-45} textAnchor="end" interval={0} tick={{ fill: '#000000', fontWeight: 600 }} />
                                                <YAxis fontSize={12} tickLine={false} axisLine={false} />
                                                <Tooltip
                                                    cursor={{ fill: '#F1F5F9' }}
                                                    contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                                />
                                                <Bar dataKey="litros" name="Litros" fill="#C1272D" radius={[4, 4, 0, 0]}>
                                                    {commercialData.sucursalData.map((entry, index) => {
                                                        // Red -> Blue Gradient
                                                        // Start: #C1272D (Red) -> RGB(193, 39, 45)
                                                        // End: #1E40AF (Blue 800) -> RGB(30, 64, 175)

                                                        const totalItems = commercialData.sucursalData.length
                                                        const startColor = [193, 39, 45]
                                                        const endColor = [30, 64, 175]
                                                        const ratio = index / (totalItems - 1) // 0 to 1

                                                        const r = Math.round(startColor[0] + (endColor[0] - startColor[0]) * ratio)
                                                        const g = Math.round(startColor[1] + (endColor[1] - startColor[1]) * ratio)
                                                        const b = Math.round(startColor[2] + (endColor[2] - startColor[2]) * ratio)

                                                        const fill = `rgb(${r}, ${g}, ${b})`

                                                        return <Cell key={`cell-${index}`} fill={fill} />
                                                    })}
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
                                            <BarChart
                                                layout="vertical"
                                                data={[...commercialData.productVariantsData].slice(0, 20)}
                                                margin={{ top: 20, right: 30, left: 10, bottom: 5 }}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                                                <XAxis type="number" fontSize={12} tickLine={false} axisLine={false} />
                                                <YAxis
                                                    type="category"
                                                    dataKey="name"
                                                    width={160}
                                                    tick={({ x, y, payload, index }) => {
                                                        // Dynamic font size: Largest for top items, smaller for bottom
                                                        // Range: 13px down to 9px for 20 items
                                                        const fontSize = Math.max(9, 13 - (index * 0.25))
                                                        const color = index < 3 ? '#1e293b' : '#64748b' // Darker for top 3
                                                        const fontWeight = index < 3 ? 700 : 400

                                                        return (
                                                            <g transform={`translate(${x},${y})`}>
                                                                <text
                                                                    x={0}
                                                                    y={0}
                                                                    dy={4}
                                                                    textAnchor="end"
                                                                    fill={color}
                                                                    fontSize={fontSize}
                                                                    fontWeight={fontWeight}
                                                                >
                                                                    {payload.value && payload.value.length > 25 ? payload.value.substring(0, 25) + '...' : payload.value}
                                                                </text>
                                                            </g>
                                                        )
                                                    }}
                                                    tickLine={false}
                                                    axisLine={false}
                                                    interval={0}
                                                />
                                                <Tooltip
                                                    cursor={{ fill: '#F1F5F9' }}
                                                    formatter={(value: any, name: any, props: any) => {
                                                        const total = commercialData.productVariantsData.slice(0, 20).reduce((sum, p) => sum + p.value, 0)
                                                        const percent = ((value / total) * 100).toFixed(1)
                                                        const type = props.payload.type === 'litros' ? 'L' : 'Pzas'
                                                        return [`${value.toLocaleString()} ${type} (${percent}%)`, name]
                                                    }}
                                                    contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                                />
                                                <Bar dataKey="value" name="Volumen" radius={[0, 4, 4, 0]} barSize={12}>
                                                    {commercialData.productVariantsData.slice(0, 20).map((entry, index) => {
                                                        // Red -> Blue Gradient
                                                        // Start: #C1272D (Red) -> RGB(193, 39, 45)
                                                        // End: #1E40AF (Blue 800) -> RGB(30, 64, 175)

                                                        const startColor = [193, 39, 45]
                                                        const endColor = [30, 64, 175]
                                                        const ratio = index / 19 // 0 to 1 over 20 items

                                                        const r = Math.round(startColor[0] + (endColor[0] - startColor[0]) * ratio)
                                                        const g = Math.round(startColor[1] + (endColor[1] - startColor[1]) * ratio)
                                                        const b = Math.round(startColor[2] + (endColor[2] - startColor[2]) * ratio)

                                                        const fill = `rgb(${r}, ${g}, ${b})`

                                                        return <Cell key={`cell-${index}`} fill={fill} />
                                                    })}
                                                </Bar>
                                            </BarChart>
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
                    )}
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

            {/* Print Modals */}
            <DateRangeModal
                open={printModal === 'calidad'}
                onClose={() => setPrintModal(null)}
                onConfirm={handlePrintConfirm('calidad')}
                title="Reporte First Time Quality"
            />
            <DateRangeModal
                open={printModal === 'comercial'}
                onClose={() => setPrintModal(null)}
                onConfirm={handlePrintConfirm('comercial')}
                title="Reporte Análisis Comercial"
            />

            {/* Print Views */}
            {printView && printView.tab === 'calidad' && (() => {
                const pr = printFilteredRecords
                if (!pr || pr.length === 0) {
                    return (
                        <PrintReportWrapper
                            title="Reporte First Time Quality"
                            dateFrom={printView.dateFrom}
                            dateTo={printView.dateTo}
                            userName={profile?.full_name}
                            onClose={() => setPrintView(null)}
                        >
                            <div className="p-8 text-center text-slate-500">
                                No hay datos disponibles para el periodo seleccionado.
                            </div>
                        </PrintReportWrapper>
                    )
                }

                const total = pr.length
                const conformes = pr.filter(r => r.analysis.overallStatus === 'conforme').length
                const semiConformes = pr.filter(r => r.analysis.overallStatus === 'semi-conforme').length
                const noConformes = pr.filter(r => r.analysis.overallStatus === 'no-conforme').length
                
                const PIECE_FAMILIES = ["Bases aromatizante ambiental", "Bases limpiadores liquidos multiusos", "Bases Aromatizantes"]
                const totalVol = pr.reduce((s, r) => !PIECE_FAMILIES.includes(r.familia_producto) ? s + (r.tamano_lote || 0) : s, 0)
                
                const conformesPH = pr.filter(r => r.analysis.phStatus === 'conforme').length
                const noConformesPH = pr.filter(r => r.analysis.phStatus === 'no-conforme').length

                // Defects summary
                const defects = { ph: 0, solidos: 0, apariencia: 0 }
                pr.forEach(r => {
                    if (!r.analysis.isConform) {
                        r.analysis.failedParams.forEach(p => {
                            if (p === 'ph' || p === 'solidos' || p === 'apariencia') {
                                defects[p]++
                            }
                        })
                    }
                })

                const paretoChartData = [
                    { name: 'pH', count: defects.ph },
                    { name: 'Sólidos', count: defects.solidos },
                    { name: 'Apariencia', count: defects.apariencia }
                ].sort((a, b) => b.count - a.count)

                const pieData = [
                    { name: 'Conforme', value: conformes, color: '#16a34a' },
                    { name: 'Semi-Conforme', value: semiConformes, color: '#ca8a04' },
                    { name: 'No Conforme', value: noConformes, color: '#dc2626' }
                ].filter(d => d.value > 0)

                // Sucursal summary
                const grouped: Record<string, { conformes: number, semi: number, noConf: number }> = {}
                pr.forEach(r => {
                    const s = r.sucursal || 'Sin Sucursal'
                    if (!grouped[s]) grouped[s] = { conformes: 0, semi: 0, noConf: 0 }
                    if (r.analysis.overallStatus === 'conforme') grouped[s].conformes++
                    else if (r.analysis.overallStatus === 'semi-conforme') grouped[s].semi++
                    else if (r.analysis.overallStatus === 'no-conforme') grouped[s].noConf++
                })

                // Product Family analysis
                const familyAnalysis: Record<string, { total: number, nc: number, vol: number }> = {}
                pr.forEach(r => {
                    const f = r.familia_producto || 'Otros'
                    if (!familyAnalysis[f]) familyAnalysis[f] = { total: 0, nc: 0, vol: 0 }
                    familyAnalysis[f].total++
                    familyAnalysis[f].vol += (r.tamano_lote || 0)
                    if (!r.analysis.isConform) familyAnalysis[f].nc++
                })
                const familyTable = Object.entries(familyAnalysis)
                    .map(([name, v]) => ({ name, ...v, ncRate: (v.nc / v.total * 100).toFixed(1) }))
                    .sort((a, b) => b.vol - a.vol)
                    .slice(0, 8)

                // Preparer Analysis
                const preparerRank: Record<string, { total: number, conform: number }> = {}
                pr.forEach(r => {
                    const p = r.preparador || 'N/A'
                    if (!preparerRank[p]) preparerRank[p] = { total: 0, conform: 0 }
                    preparerRank[p].total++
                    if (r.analysis.isConform) preparerRank[p].conform++
                })
                const preparerTable = Object.entries(preparerRank)
                    .map(([name, v]) => ({ name, ...v, rate: (v.conform / v.total * 100).toFixed(1) }))
                    .sort((a, b) => b.total - a.total)
                    .slice(0, 10)

                return (
                    <PrintReportWrapper
                        title="Reporte First Time Quality"
                        dateFrom={printView.dateFrom}
                        dateTo={printView.dateTo}
                        userName={profile?.full_name}
                        filters={selectedSucursal !== 'all' ? `Sucursal: ${selectedSucursal}` : 'Todas las sucursales'}
                        onClose={() => setPrintView(null)}
                    >
                        {/* KPIs */}
                        <div className="print-kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px' }}>
                            <div className="print-kpi-card">
                                <p className="text-[10pt] text-slate-500 font-bold uppercase mb-1">Total Registros</p>
                                <p className="text-3xl font-extrabold text-slate-900 leading-tight">{total}</p>
                                <p className="text-[8pt] text-slate-400 font-medium">Lotes analizados</p>
                            </div>
                            <div className="print-kpi-card" style={{ borderLeft: '4px solid #16a34a' }}>
                                <p className="text-[10pt] text-green-700 font-bold uppercase mb-1">Conformes</p>
                                <p className="text-3xl font-extrabold text-green-700 leading-tight">{conformes}</p>
                                <p className="text-[8pt] text-green-600/70 font-bold">{total > 0 ? ((conformes/total)*100).toFixed(1) : 0}% del total</p>
                            </div>
                            <div className="print-kpi-card" style={{ borderLeft: '4px solid #ca8a04' }}>
                                <p className="text-[10pt] text-yellow-700 font-bold uppercase mb-1">Semi</p>
                                <p className="text-3xl font-extrabold text-yellow-700 leading-tight">{semiConformes}</p>
                                <p className="text-[8pt] text-yellow-600/70 font-bold">{total > 0 ? ((semiConformes/total)*100).toFixed(1) : 0}%</p>
                            </div>
                            <div className="print-kpi-card" style={{ borderLeft: '4px solid #dc2626' }}>
                                <p className="text-[10pt] text-red-700 font-bold uppercase mb-1">No Conformes</p>
                                <p className="text-3xl font-extrabold text-red-700 leading-tight">{noConformes}</p>
                                <p className="text-[8pt] text-red-600/70 font-bold">{total > 0 ? ((noConformes/total)*100).toFixed(1) : 0}%</p>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
                            {/* Conformity Chart */}
                            <div className="print-no-break">
                                <h3 className="print-section-title">Resumen de Conformidad</h3>
                                <div style={{ height: '220px', width: '100%', display: 'flex', justifyContent: 'center' }}>
                                    <PieChart width={300} height={220}>
                                        <Pie
                                            data={pieData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {pieData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                        <Legend verticalAlign="bottom" height={36}/>
                                    </PieChart>
                                </div>
                            </div>

                            {/* Defects Chart */}
                            <div className="print-no-break">
                                <h3 className="print-section-title">Pareto de Defectos</h3>
                                <div style={{ height: '220px', width: '100%' }}>
                                    <BarChart width={350} height={220} data={paretoChartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="name" fontSize={10} interval={0} />
                                        <YAxis fontSize={10} />
                                        <Bar dataKey="count" name="Cantidad" fill="#0e0c9b" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </div>
                            </div>
                        </div>
                                              {/* Tables Section */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
                            <div className="print-no-break">
                                <h3 className="print-section-title">Análisis por Familia (Top 8)</h3>
                                <table className="print-table">
                                    <thead>
                                        <tr>
                                            <th>Familia</th>
                                            <th style={{ textAlign: 'center' }}>Volumen</th>
                                            <th style={{ textAlign: 'right' }}>% No Conf.</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {familyTable.map(f => (
                                            <tr key={f.name}>
                                                <td className="font-semibold">{f.name}</td>
                                                <td style={{ textAlign: 'center' }}>{f.vol.toLocaleString()}</td>
                                                <td style={{ textAlign: 'right', fontWeight: 'bold', color: Number(f.ncRate) > 10 ? '#dc2626' : '#64748b' }}>
                                                    {f.ncRate}%
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="print-no-break">
                                <h3 className="print-section-title">Efectividad por Preparador</h3>
                                <table className="print-table">
                                    <thead>
                                        <tr>
                                            <th>Nombre</th>
                                            <th style={{ textAlign: 'center' }}>Lotes</th>
                                            <th style={{ textAlign: 'right' }}>% Calidad</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {preparerTable.map(p => (
                                            <tr key={p.name}>
                                                <td className="font-semibold">{p.name}</td>
                                                <td style={{ textAlign: 'center' }}>{p.total}</td>
                                                <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#16a34a' }}>
                                                    {p.rate}%
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Conformity by Sucursal Table */}
                        <div className="print-no-break" style={{ marginTop: '20px' }}>
                            <h3 className="print-section-title">Desglose por Sucursal</h3>
                            <table className="print-table">
                                <thead>
                                    <tr>
                                        <th>Sucursal</th>
                                        <th style={{ textAlign: 'center' }}>Conformes</th>
                                        <th style={{ textAlign: 'center' }}>Semi</th>
                                        <th style={{ textAlign: 'center' }}>No Conformes</th>
                                        <th style={{ textAlign: 'center' }}>Total</th>
                                        <th style={{ textAlign: 'right' }}>% Calidad</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.entries(grouped).sort((a, b) => (b[1].conformes + b[1].semi + b[1].noConf) - (a[1].conformes + a[1].semi + a[1].noConf)).map(([suc, v]) => {
                                        const t = v.conformes + v.semi + v.noConf
                                        const qualityScore = t > 0 ? ((v.conformes / t) * 100).toFixed(1) : 0
                                        return (
                                            <tr key={suc}>
                                                <td className="font-semibold">{suc}</td>
                                                <td style={{ textAlign: 'center', color: '#16a34a' }}>{v.conformes}</td>
                                                <td style={{ textAlign: 'center', color: '#ca8a04' }}>{v.semi}</td>
                                                <td style={{ textAlign: 'center', color: '#dc2626' }}>{v.noConf}</td>
                                                <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{t}</td>
                                                <td style={{ textAlign: 'right', fontWeight: 'bold', color: Number(qualityScore) > 90 ? '#16a34a' : '#0e0c9b' }}>{qualityScore}%</td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </PrintReportWrapper>
                )
            })()}

            {printView && printView.tab === 'comercial' && (() => {
                const pr = printFilteredRecords
                if (!pr || pr.length === 0) {
                    return (
                        <PrintReportWrapper
                            title="Reporte Análisis Comercial"
                            dateFrom={printView.dateFrom}
                            dateTo={printView.dateTo}
                            userName={profile?.full_name}
                            onClose={() => setPrintView(null)}
                        >
                            <div className="p-8 text-center text-slate-500">
                                No hay datos disponibles para el periodo seleccionado.
                            </div>
                        </PrintReportWrapper>
                    )
                }

                const PIECE_FAMILIES = ["Bases aromatizante ambiental", "Bases limpiadores liquidos multiusos", "Bases Aromatizantes"]
                const totalVol = pr.reduce((sum, r) => !PIECE_FAMILIES.includes(r.familia_producto) ? sum + (r.tamano_lote || 0) : sum, 0)
                const totalPcs = pr.reduce((sum, r) => PIECE_FAMILIES.includes(r.familia_producto) ? sum + (r.tamano_lote || 0) : sum, 0)

                // By sucursal
                const bySuc: Record<string, number> = {}
                pr.forEach(r => {
                    const s = r.sucursal || 'Sin Sucursal'
                    if (!PIECE_FAMILIES.includes(r.familia_producto)) {
                        bySuc[s] = (bySuc[s] || 0) + (r.tamano_lote || 0)
                    }
                })
                const sucursalBarData = Object.entries(bySuc).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value)
                
                // Color gradient from red to blue
                const getGradientColor = (index: number, total: number) => {
                    const r = Math.round(193 - (index / total) * (193 - 14)) // From #C1272D to #0E0C9B
                    const g = Math.round(39 - (index / total) * (39 - 12))
                    const b = Math.round(45 - (index / total) * (45 - 155))
                    return `rgb(${r}, ${g}, ${b})`
                }
                const sucursalChartData = sucursalBarData.map((d, i) => ({ ...d, color: getGradientColor(i, sucursalBarData.length) }))

                // By category
                const byCat: Record<string, number> = {}
                pr.forEach(r => {
                    const cat = (r as any).categoria_producto || r.familia_producto || 'Otros'
                    byCat[cat] = (byCat[cat] || 0) + (r.tamano_lote || 0)
                })
                const categoryPieData = Object.entries(byCat).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value)

                // High level groups for Image 3
                const groupMapping: Record<string, string> = {
                    'Detergente líquido para ropa': 'Lavandería',
                    'Suavizante de telas': 'Lavandería',
                    'Línea de especialidades': 'Lavandería',
                    'Limpiador liquido multiusos': 'Cuidado del Hogar',
                    'Detergente liquido para trastes': 'Cuidado del Hogar',
                    'Desengrasante': 'Cuidado del Hogar',
                    'Jabón liquido para manos': 'Cuidado Personal',
                    'Shampoo': 'Cuidado Personal',
                    'Corporal': 'Cuidado Personal',
                    'Antibacteriales': 'Línea Antibacterial',
                    'Gel Antibacterial': 'Línea Antibacterial'
                }
                const groupedData: Record<string, { total: number, sub: Record<string, number> }> = {}
                pr.forEach(r => {
                    const fam = r.familia_producto || 'Otros'
                    const group = groupMapping[fam] || 'Otros'
                    if (!groupedData[group]) groupedData[group] = { total: 0, sub: {} }
                    groupedData[group].total += (r.tamano_lote || 0)
                    groupedData[group].sub[fam] = (groupedData[group].sub[fam] || 0) + (r.tamano_lote || 0)
                })

                // Top Products by Sucursal
                const topBySuc: Record<string, any[]> = {}
                pr.forEach(r => {
                    const s = r.sucursal || 'Sin Sucursal'
                    if (!topBySuc[s]) topBySuc[s] = []
                    topBySuc[s].push({ name: r.nombre_producto, value: r.tamano_lote })
                })
                const topProductsSucursal = Object.entries(topBySuc).map(([suc, items]) => {
                    const sorted = items.reduce((acc, curr) => {
                        const existing = acc.find((i: any) => i.name === curr.name)
                        if (existing) existing.value += curr.value
                        else acc.push({ ...curr })
                        return acc
                    }, []).sort((a: any, b: any) => b.value - a.value).slice(0, 3)
                    return { suc, products: sorted }
                }).sort((a, b) => b.products.reduce((s: number, i: any) => s + i.value, 0) - a.products.reduce((s: number, i: any) => s + i.value, 0))

                // By product variant (codigo)
                const byProdCode: Record<string, number> = {}
                pr.forEach(r => {
                    const code = r.codigo_producto || 'N/A'
                    byProdCode[code] = (byProdCode[code] || 0) + (r.tamano_lote || 0)
                })
                const variantChartData = Object.entries(byProdCode)
                    .map(([name, value], i) => ({ name, value }))
                    .sort((a, b) => b.value - a.value)
                    .slice(0, 20)
                    .map((d, i) => ({ ...d, color: getGradientColor(i, 20) }))

                const topProds = Object.entries(byProdCode).sort((a, b) => b[1] - a[1]).slice(0, 10)

                return (
                    <PrintReportWrapper
                        title="Reporte Análisis Comercial"
                        dateFrom={printView.dateFrom}
                        dateTo={printView.dateTo}
                        userName={profile?.full_name}
                        filters={selectedSucursal !== 'all' ? `Sucursal: ${selectedSucursal}` : 'Todas las sucursales'}
                        onClose={() => setPrintView(null)}
                    >
                        {/* KPIs */}
                        <div className="print-kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
                            <div className="print-kpi-card" style={{ borderTop: '4px solid #0e0c9b' }}>
                                <p className="text-[10pt] text-slate-500 font-bold uppercase mb-1">Volumen Líquidos</p>
                                <p className="text-3xl font-extrabold text-[#0e0c9b] tracking-tight">{totalVol.toLocaleString()} L</p>
                                <p className="text-[8pt] text-slate-400 font-medium">Producción acumulada</p>
                            </div>
                            <div className="print-kpi-card" style={{ borderTop: '4px solid #c1272d' }}>
                                <p className="text-[10pt] text-slate-500 font-bold uppercase mb-1">Bases / Piezas</p>
                                <p className="text-3xl font-extrabold text-[#c1272d] tracking-tight">{totalPcs.toLocaleString()} pzas</p>
                                <p className="text-[8pt] text-slate-400 font-medium">{ (totalPcs * 20).toLocaleString() } L equiv.</p>
                            </div>
                            <div className="print-kpi-card" style={{ borderTop: '4px solid #64748b' }}>
                                <p className="text-[10pt] text-slate-500 font-bold uppercase mb-1">Total Registros</p>
                                <p className="text-3xl font-extrabold text-slate-900 tracking-tight">{pr.length}</p>
                                <p className="text-[8pt] text-slate-400 font-medium">Lotes registrados</p>
                            </div>
                        </div>

                        {/* Image 1: Production by Branch (Vertical Bars) */}
                        <div className="print-no-break" style={{ marginTop: '30px', paddingBottom: '20px', borderBottom: '1px solid #f1f5f9' }}>
                            <h3 style={{ fontSize: '14pt', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>Producción Total por Sucursal (Litros)</h3>
                            <p className="text-[9pt] text-slate-500 mb-6">Comparativa de volumen de producción entre todas las sucursales</p>
                            <div style={{ height: '320px', width: '100%' }}>
                                <BarChart width={750} height={300} data={sucursalChartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis 
                                        dataKey="name" 
                                        interval={0} 
                                        angle={-45} 
                                        textAnchor="end" 
                                        fontSize={9} 
                                        fontWeight={700}
                                        tick={{ fill: '#475569' }}
                                    />
                                    <YAxis fontSize={10} tick={{ fill: '#475569' }} />
                                    <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={35}>
                                        {sucursalChartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </div>
                        </div>

                        {/* Image 2: Distribution by Variant (Horizontal Bars) */}
                        <div className="print-break print-no-break" style={{ marginTop: '30px', paddingBottom: '20px', borderBottom: '1px solid #f1f5f9' }}>
                            <h3 style={{ fontSize: '14pt', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>Distribución de Productos por Variante</h3>
                            <p className="text-[9pt] text-slate-500 mb-6">Proporción de todos los productos por SKU/Código (Top 20)</p>
                            <div style={{ height: '550px', width: '100%' }}>
                                <BarChart 
                                    width={750} 
                                    height={520} 
                                    data={variantChartData} 
                                    layout="vertical" 
                                    margin={{ top: 5, right: 50, left: 80, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                                    <XAxis type="number" fontSize={10} hide />
                                    <YAxis 
                                        dataKey="name" 
                                        type="category" 
                                        fontSize={10} 
                                        width={70} 
                                        fontWeight={800} 
                                        tick={{ fill: '#334155' }}
                                    />
                                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={18}>
                                        {variantChartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </div>
                        </div>

                        {/* Image 3: Ranking and Category Donut Charts */}
                        <div className="print-break" style={{ marginTop: '30px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '30px' }}>
                                {/* Global Ranking */}
                                <div className="print-no-break bg-slate-50/50 p-6 rounded-xl border border-slate-100">
                                    <h3 style={{ fontSize: '13pt', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>Ranking de Productos</h3>
                                    <p className="text-[8pt] text-slate-500 mb-6">Los más producidos globalmente</p>
                                    <div className="space-y-5">
                                        {topProds.map(([code, val], i) => (
                                            <div key={code}>
                                                <div className="flex justify-between items-end mb-1">
                                                    <span className="text-[9pt] font-bold text-slate-700">
                                                        <span className="text-slate-400 mr-2">#{i + 1}</span>
                                                        {code}
                                                    </span>
                                                    <span className="text-[9pt] font-extrabold text-[#0e0c9b]">{val.toLocaleString()} <span className="text-[7pt] text-slate-400">L</span></span>
                                                </div>
                                                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                                                    <div 
                                                        className="h-full bg-[#0e0c9b]" 
                                                        style={{ width: `${(val / Number(topProds[0][1])) * 100}%` }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Category Donuts - Dynamic for all groups */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                    {Object.entries(groupedData)
                                        .sort((a,b) => b[1].total - a[1].total)
                                        .map(([group, data]) => {
                                            const subData = Object.entries(data.sub).map(([name, value], i) => ({ 
                                                name, 
                                                value,
                                                color: COLORS[i % COLORS.length]
                                            })).sort((a,b) => b.value - a.value)

                                            return (
                                                <div key={group} className="print-no-break bg-white p-4 rounded-xl border border-slate-100 shadow-sm relative overflow-hidden">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div>
                                                            <h4 className="text-[10pt] font-black text-[#0f172a]">{group}</h4>
                                                            <p className="text-[7pt] text-slate-500 uppercase font-bold tracking-wider">Total: {data.total.toLocaleString()} L</p>
                                                        </div>
                                                    </div>
                                                    <div style={{ height: '160px', width: '100%', position: 'relative' }}>
                                                        <PieChart width={200} height={160}>
                                                            <Pie
                                                                data={subData}
                                                                cx="50%"
                                                                cy="50%"
                                                                innerRadius={40}
                                                                outerRadius={55}
                                                                paddingAngle={4}
                                                                dataKey="value"
                                                                stroke="none"
                                                            >
                                                                {subData.map((entry, index) => (
                                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                                ))}
                                                            </Pie>
                                                            <Tooltip />
                                                        </PieChart>
                                                        <div style={{ 
                                                            position: 'absolute', 
                                                            top: '50%', 
                                                            left: '50%', 
                                                            transform: 'translate(-50%, -50%)',
                                                            textAlign: 'center',
                                                            pointerEvents: 'none'
                                                        }}>
                                                            <p className="text-[6pt] font-bold text-slate-400 uppercase leading-none">Líder</p>
                                                            <p className="text-[7pt] font-black text-[#0f172a] max-w-[60px] truncate leading-tight mt-1">{subData[0]?.name.split(' ')[0]}</p>
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1">
                                                        {subData.slice(0, 3).map(d => (
                                                            <div key={d.name} className="flex items-center gap-1.5 overflow-hidden">
                                                                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                                                                <span className="text-[6.5pt] text-slate-500 truncate">{d.name}</span>
                                                                <span className="text-[6.5pt] font-black text-slate-800 ml-auto">{((d.value / data.total) * 100).toFixed(0)}%</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                </div>
                            </div>
                        </div>

                        {/* Improved Bottom Info - Performance Summary instead of repeats */}
                        <div className="print-break print-no-break" style={{ marginTop: '40px' }}>
                            <h3 style={{ fontSize: '14pt', fontWeight: 900, color: '#0e0c9b', borderLeft: '4px solid #0e0c9b', paddingLeft: '12px', marginBottom: '20px' }}>Resumen de Rendimiento Comercial Detallado</h3>
                            
                            <table className="print-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '40px', textAlign: 'center' }}>Pos</th>
                                        <th>Producto / Referencia</th>
                                        <th style={{ textAlign: 'center' }}>Categoría</th>
                                        <th style={{ textAlign: 'right' }}>Volumen Total</th>
                                        <th style={{ textAlign: 'right' }}>% Dist.</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.entries(byProdCode).sort((a,b) => b[1] - a[1]).slice(0, 15).map(([code, vol], i) => {
                                        const prodInfo = pr.find(r => r.codigo_producto === code)
                                        return (
                                            <tr key={code}>
                                                <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#64748b' }}>{i + 1}</td>
                                                <td>
                                                    <div style={{ fontWeight: 800, color: '#0f172a' }}>{code}</div>
                                                    <div style={{ fontSize: '7pt', color: '#64748b' }}>{prodInfo?.nombre_producto}</div>
                                                </td>
                                                <td style={{ textAlign: 'center', fontSize: '7pt' }}>{prodInfo?.familia_producto}</td>
                                                <td style={{ textAlign: 'right', fontWeight: 900, color: '#0e0c9b' }}>{vol.toLocaleString()} <span className="text-[6pt] font-normal">L</span></td>
                                                <td style={{ textAlign: 'right', fontWeight: 700 }}>{((vol / totalVol) * 100).toFixed(1)}%</td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '30px' }}>
                                <div className="p-4 rounded-xl border-2 border-slate-100 bg-slate-50">
                                    <h4 className="text-[9pt] font-black text-slate-800 uppercase mb-2">Análisis de Distribución Geográfica</h4>
                                    <p className="text-[8pt] text-slate-600 leading-relaxed">
                                        La sucursal <strong className="text-[#0e0c9b]">{sucursalBarData[0]?.name}</strong> lidera el volumen con un <strong>{((sucursalBarData[0]?.value / totalVol) * 100).toFixed(1)}%</strong> de la producción total, seguida por {sucursalBarData[1]?.name}. La diversidad de variantes activas asciende a {variantChartData.length} SKUs principales.
                                    </p>
                                </div>
                                <div className="p-4 rounded-xl border-2 border-slate-100 bg-slate-50">
                                    <h4 className="text-[9pt] font-black text-slate-800 uppercase mb-2">Glosario y Notas Técnicas</h4>
                                    <ul className="space-y-1">
                                        <li className="text-[7pt] text-slate-500">• <strong>Volumen L:</strong> Medición en litros para productos líquidos.</li>
                                        <li className="text-[7pt] text-slate-500">• <strong>L equiv:</strong> Conversión estimada de bases a producto final.</li>
                                        <li className="text-[7pt] text-slate-500">• <strong>Pos:</strong> Posición en el ranking de producción global.</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </PrintReportWrapper>
                )
            })()}
        </>
    )
}

