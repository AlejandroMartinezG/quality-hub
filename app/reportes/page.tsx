"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/AuthProvider"
import { supabase } from "@/lib/supabase"
import { analyzeRecord, EnrichedRecord } from "@/lib/analysis-utils"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Loader2, RefreshCcw, Filter, Download, Factory, Trophy, TrendingUp, Package, Activity, AlertCircle, ChevronRight, Printer, Box, Search } from "lucide-react"
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
import { Input } from "@/components/ui/input"
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
import SPYReportPage from "./spy/SPYReportPage"

// --- Helper functions ---

function getHeatColor(ratio: number): string {
    // 0 = corporate blue, 1 = corporate red (via purple)
    const hue = Math.round((232 + ratio * 130) % 360)
    const light = Math.round(42 - ratio * 8)
    return `hsl(${hue},72%,${light}%)`
}

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
    const [selectedProduct, setSelectedProduct] = useState<string>("all")
    const [selectedCategory, setSelectedCategory] = useState<string>("all")
    const [selectedPreparer, setSelectedPreparer] = useState<string>("all")
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

    // Production analysis state
    const [prodDateFrom, setProdDateFrom] = useState(() => {
        const d = new Date(); d.setFullYear(d.getFullYear() - 1); return d.toISOString().split('T')[0]
    })
    const [prodDateTo, setProdDateTo] = useState(() => new Date().toISOString().split('T')[0])
    const [sucursalHeatmapTab, setSucursalHeatmapTab] = useState<'total' | 'productos' | 'bases'>('total')
    const [sucursalHeatmapSearch, setSucursalHeatmapSearch] = useState('')
    const [codeSearch, setCodeSearch] = useState('')
    const [showHeatColors, setShowHeatColors] = useState(true)
    const [heatmapSortKey, setHeatmapSortKey] = useState<string | null>(null)
    const [heatmapSortDir, setHeatmapSortDir] = useState<'asc' | 'desc'>('desc')
    const [familySortKey, setFamilySortKey] = useState<string | null>(null)
    const [familySortDir, setFamilySortDir] = useState<'asc' | 'desc'>('desc')
    const [categoriaSortKey, setCategoriaSortKey] = useState<string | null>(null)
    const [categoriaSortDir, setCategoriaSortDir] = useState<'asc' | 'desc'>('desc')
    const [codigoSortKey, setCodigoSortKey] = useState<string | null>(null)
    const [codigoSortDir, setCodigoSortDir] = useState<'asc' | 'desc'>('desc')

    // Permissions check
    useEffect(() => {
        if (!authLoading && profile) {
            const allowedRoles = ['admin', 'gerente_calidad', 'coordinador', 'director_operaciones', 'director_compras', 'preparador']
            const isAllowed = profile.is_admin || allowedRoles.includes(role)
            if (!isAllowed) {
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
                query = query.eq('user_id', user?.id)
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

        const totalLitrosUnificado = totalVolume + totalPieces * 20

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
            totalLitrosUnificado,
            conformesPH,
            noConformesPH,
            percentConformidadPH,
            percentNoConformidadPH
        }
    }, [filteredRecords])

    // Production analysis records (only date-filtered, ignores conformity/product filters)
    const prodAnalysisRecords = useMemo(() => {
        return records.filter(r => {
            const raw = r as any
            const d = new Date(r.fecha_fabricacion || raw.created_at)
            if (prodDateFrom && d < new Date(prodDateFrom)) return false
            if (prodDateTo && d > new Date(prodDateTo + 'T23:59:59')) return false
            return true
        })
    }, [records, prodDateFrom, prodDateTo])

    // Aggregated production data for analysis charts
    const productionAnalysisData = useMemo(() => {
        const PIECE_FAM = ["Bases aromatizante ambiental", "Bases limpiadores liquidos multiusos", "Bases Aromatizantes"]

        // Build category → group mapping
        const catToGroup: Record<string, string> = {}
        for (const g of PRODUCT_GROUPS) {
            for (const id of g.ids) {
                const cat = PRODUCT_CATEGORIES.find(c => c.id === id)
                if (cat) catToGroup[cat.name] = g.title
            }
        }

        const byMonth: Record<string, { label: string, productos: number, bases: number }> = {}
        const bySucursalMonth: Record<string, Record<string, { productos: number, bases: number }>> = {}
        const byFamily: Record<string, number> = {}
        const familyMonthMap: Record<string, Record<string, number>> = {}
        const byGroup: Record<string, number> = {}
        const groupMonthMap: Record<string, Record<string, number>> = {}
        const byCode: Record<string, number> = {}
        const codeMonthMap: Record<string, Record<string, number>> = {}

        for (const r of prodAnalysisRecords) {
            const raw = r as any
            const dateStr = raw.fecha_fabricacion || raw.created_at
            const date = new Date(dateStr)
            const year = date.getFullYear()
            const monthNum = date.getMonth() + 1
            const monthKey = `${year}-${String(monthNum).padStart(2, '0')}`
            const monthLabel = date.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' }).replace('. ', ' \'')
            const suc = (raw.sucursal || 'Sin Sucursal') as string
            const fam = (raw.familia_producto || 'Otros') as string
            const isBase = PIECE_FAM.includes(fam)
            const val = raw.tamano_lote ? parseFloat(raw.tamano_lote) : 0
            const litros = isBase ? val * 20 : val

            if (!byMonth[monthKey]) byMonth[monthKey] = { label: monthLabel, productos: 0, bases: 0 }
            if (isBase) byMonth[monthKey].bases += litros
            else byMonth[monthKey].productos += litros

            if (!bySucursalMonth[suc]) bySucursalMonth[suc] = {}
            if (!bySucursalMonth[suc][monthKey]) bySucursalMonth[suc][monthKey] = { productos: 0, bases: 0 }
            if (isBase) bySucursalMonth[suc][monthKey].bases += litros
            else bySucursalMonth[suc][monthKey].productos += litros

            if (!byFamily[fam]) byFamily[fam] = 0
            byFamily[fam] += litros
            if (!familyMonthMap[fam]) familyMonthMap[fam] = {}
            if (!familyMonthMap[fam][monthKey]) familyMonthMap[fam][monthKey] = 0
            familyMonthMap[fam][monthKey] += litros

            const groupName = catToGroup[fam] || 'Otros'
            if (!byGroup[groupName]) byGroup[groupName] = 0
            byGroup[groupName] += litros
            if (!groupMonthMap[groupName]) groupMonthMap[groupName] = {}
            if (!groupMonthMap[groupName][monthKey]) groupMonthMap[groupName][monthKey] = 0
            groupMonthMap[groupName][monthKey] += litros

            const code = (raw.codigo_producto || 'Sin código') as string
            if (!byCode[code]) byCode[code] = 0
            byCode[code] += litros
            if (!codeMonthMap[code]) codeMonthMap[code] = {}
            if (!codeMonthMap[code][monthKey]) codeMonthMap[code][monthKey] = 0
            codeMonthMap[code][monthKey] += litros
        }

        const months = Object.keys(byMonth).sort()
        const monthlyData = months.map(k => ({ key: k, ...byMonth[k], total: byMonth[k].productos + byMonth[k].bases }))

        const sucursalRows = Object.entries(bySucursalMonth).map(([name, mData]) => {
            const totProd = Object.values(mData).reduce((s, m) => s + m.productos, 0)
            const totBase = Object.values(mData).reduce((s, m) => s + m.bases, 0)
            return { name, mData, totProd, totBase, total: totProd + totBase }
        }).sort((a, b) => b.total - a.total)

        const familyData = Object.entries(byFamily)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
        const familyTableData = familyData.map(f => ({
            name: f.name, total: f.value, byMonth: familyMonthMap[f.name] || {}
        }))

        const groupData = Object.entries(byGroup)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
        const groupTableData = groupData.map(g => ({
            name: g.name, total: g.value, byMonth: groupMonthMap[g.name] || {}
        }))

        const codeData = Object.entries(byCode)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
        const codeTableData = codeData.map(c => ({
            name: c.name, total: c.value, byMonth: codeMonthMap[c.name] || {}
        }))

        return { months, monthlyData, sucursalRows, familyData, familyTableData, groupData, groupTableData, codeData, codeTableData }
    }, [prodAnalysisRecords])

    // --- 3. Commercial Analysis Data ---
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
    const COLORS = ['#0b109f', '#e2211c', '#2a35b8', '#c02820', '#4352cc', '#a02019', '#5d6fd9', '#d43630'];

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
                    <TabsList className={`grid w-full ${
                        (isPreparador || isGerente) ? 'grid-cols-1 max-w-[260px]'
                        : 'grid-cols-2 max-w-[640px]'
                    }`}>
                        {(!isPreparador && !isGerente) && <TabsTrigger value="comercial">Análisis de Operación</TabsTrigger>}
                        <TabsTrigger value="calidad">Calidad y Rendimiento (FTQ / SPY)</TabsTrigger>
                    </TabsList>

                    <TabsContent value="calidad" className="space-y-6">
                        <SPYReportPage records={records} profile={profile} />
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
                            <div className="space-y-4">
                                {/* Row 1: Volume KPIs */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {/* KPI: Total Unificado */}
                                    <Card className="border-none shadow-md bg-gradient-to-br from-[#0d1490] to-[#090e72] text-white rounded-[2rem]">
                                        <CardContent className="p-6 relative overflow-hidden">
                                            <div className="relative z-10">
                                                <p className="text-[#a0a8e8] font-medium mb-3 flex items-center gap-2 text-sm uppercase tracking-wide">
                                                    <Activity className="h-4 w-4" />
                                                    Total Unificado
                                                </p>
                                                <div className="text-4xl font-extrabold tracking-tight">
                                                    {kpis.totalLitrosUnificado.toLocaleString()}
                                                    <span className="text-xl font-normal opacity-80 ml-2">L</span>
                                                </div>
                                                <p className="text-xs text-[#a0a8e8] mt-2 opacity-80">
                                                    Terminados + Bases ×20
                                                </p>
                                            </div>
                                            <Factory className="absolute -right-6 -bottom-6 h-28 w-28 text-white opacity-10 rotate-12" />
                                        </CardContent>
                                    </Card>

                                    {/* KPI: Productos Terminados */}
                                    <Card className="border-none shadow-md bg-gradient-to-br from-[#1e2dbf] to-[#1622a8] text-white rounded-[2rem]">
                                        <CardContent className="p-6 relative overflow-hidden">
                                            <div className="relative z-10">
                                                <p className="text-[#b0baf5] font-medium mb-3 flex items-center gap-2 text-sm uppercase tracking-wide">
                                                    <Package className="h-4 w-4" />
                                                    Productos Terminados
                                                </p>
                                                <div className="text-4xl font-extrabold tracking-tight">
                                                    {kpis.totalVolume.toLocaleString()}
                                                    <span className="text-xl font-normal opacity-80 ml-2">L</span>
                                                </div>
                                                <p className="text-xs text-[#b0baf5] mt-2 opacity-80">
                                                    Volumen producido en litros
                                                </p>
                                            </div>
                                            <Package className="absolute -right-6 -bottom-6 h-28 w-28 text-white opacity-10 rotate-12" />
                                        </CardContent>
                                    </Card>

                                    {/* KPI: Bases */}
                                    <Card className="border-none shadow-md bg-gradient-to-br from-[#b82820] to-[#9c2019] text-white rounded-[2rem]">
                                        <CardContent className="p-6 relative overflow-hidden">
                                            <div className="relative z-10">
                                                <p className="text-[#f0b0ae] font-medium mb-3 flex items-center gap-2 text-sm uppercase tracking-wide">
                                                    <Box className="h-4 w-4" />
                                                    Bases
                                                </p>
                                                <div className="text-4xl font-extrabold tracking-tight">
                                                    {kpis.totalPieces.toLocaleString()}
                                                    <span className="text-xl font-normal opacity-80 ml-2">pzs</span>
                                                </div>
                                                <p className="text-xs text-[#f0b0ae] mt-2 opacity-80">
                                                    {(kpis.totalPieces * 20).toLocaleString()} L equiv. (×20)
                                                </p>
                                            </div>
                                            <Box className="absolute -right-6 -bottom-6 h-28 w-28 text-white opacity-10 rotate-12" />
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* Row 2: Leader KPIs */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* KPI 3: Categoría Leader + Top 3 - Enhanced */}
                                <Card className="border-none shadow-lg dark:bg-slate-900 bg-gradient-to-br from-[#fdf2f1] to-[#fae7e6] dark:from-slate-900 dark:to-slate-800 relative overflow-visible rounded-[2rem]">
                                    <CardContent className="p-8 h-full flex flex-col justify-between">
                                        <div>
                                            <div className="flex justify-between items-start mb-6">
                                                <div className="flex-1 pr-12">
                                                    <h3 className="text-xs font-semibold text-[#b82820] dark:text-red-400 uppercase tracking-wider mb-2">Categoría Más Producida</h3>
                                                    <div className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1 leading-tight">
                                                        {commercialData.top3Categories.length > 0 ? commercialData.top3Categories[0].name : '-'}
                                                    </div>
                                                    <p className="text-lg text-[#b82820] dark:text-red-400 font-bold mt-3">
                                                        {commercialData.top3Categories.length > 0 ? `${commercialData.top3Categories[0].value.toLocaleString()} ${commercialData.top3Categories[0].type}` : ''}
                                                    </p>
                                                </div>
                                                <div className="absolute -top-3 -right-3 p-4 bg-[#fae7e6] dark:bg-red-900/50 rounded-2xl shadow-lg border-4 border-white dark:border-slate-800">
                                                    <TrendingUp className="h-10 w-10 text-[#b82820] dark:text-red-400" />
                                                </div>
                                            </div>

                                            {/* Top 3 Small List */}
                                            <div className="space-y-3 pt-4 border-t-2 border-[#f0c8c6] dark:border-slate-700">
                                                {commercialData.top3Categories.slice(1).map((cat, i) => (
                                                    <div key={i} className="flex justify-between items-center">
                                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate max-w-[140px]">{cat.name}</span>
                                                        <span className="text-sm font-bold font-mono text-[#b82820] dark:text-red-400">{cat.value.toLocaleString()}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* KPI 4: Sucursal Leader + Top 3 - Enhanced */}
                                <Card className="border-none shadow-lg dark:bg-slate-900 bg-gradient-to-br from-[#f0f2fd] to-[#e6e8fb] dark:from-slate-900 dark:to-slate-800 relative overflow-visible rounded-[2rem]">
                                    <CardContent className="p-8 h-full flex flex-col justify-between">
                                        <div>
                                            <div className="flex justify-between items-start mb-6">
                                                <div className="flex-1 pr-12">
                                                    <h3 className="text-xs font-semibold text-[#1828a8] dark:text-blue-400 uppercase tracking-wider mb-2">Sucursal Líder</h3>
                                                    <div className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1 leading-tight">
                                                        {commercialData.top3Sucursales.length > 0 ? commercialData.top3Sucursales[0].name : '-'}
                                                    </div>
                                                    <p className="text-lg text-[#1828a8] dark:text-blue-400 font-bold mt-3">
                                                        {commercialData.top3Sucursales.length > 0 ? `${commercialData.top3Sucursales[0].litros.toLocaleString()} L` : ''}
                                                    </p>
                                                </div>
                                                <div className="absolute -top-3 -right-3 p-4 bg-[#e6e8fb] dark:bg-blue-900/50 rounded-2xl shadow-lg border-4 border-white dark:border-slate-800">
                                                    <Trophy className="h-10 w-10 text-[#1828a8] dark:text-blue-400" />
                                                </div>
                                            </div>

                                            {/* Top 3 Small List */}
                                            <div className="space-y-3 pt-4 border-t-2 border-[#c8ccf5] dark:border-slate-700">
                                                {commercialData.top3Sucursales.slice(1).map((suc, i) => (
                                                    <div key={i} className="flex justify-between items-center">
                                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate max-w-[140px]">{suc.name}</span>
                                                        <span className="text-sm font-bold font-mono text-[#1828a8] dark:text-blue-400">{suc.litros.toLocaleString()} L</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                                </div>
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

                            {/* ── Production Analysis ─────────────────── */}
                            {/* Date Range Filter */}
                            <Card className="border-none shadow-sm dark:bg-slate-900 rounded-[2rem]">
                                <CardContent className="p-4">
                                    <div className="flex flex-wrap items-center gap-3">
                                        <span className="text-sm font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                                            <Filter className="h-4 w-4" />
                                            Período de análisis
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <Input type="date" value={prodDateFrom} onChange={e => setProdDateFrom(e.target.value)}
                                                className="h-8 text-xs w-36 rounded-lg" />
                                            <span className="text-xs text-muted-foreground">—</span>
                                            <Input type="date" value={prodDateTo} onChange={e => setProdDateTo(e.target.value)}
                                                className="h-8 text-xs w-36 rounded-lg" />
                                        </div>
                                        <div className="flex gap-1 flex-wrap">
                                            {[
                                                { label: '3M', months: 3 }, { label: '6M', months: 6 },
                                                { label: '1A', months: 12 }, { label: 'Todo', months: 0 },
                                            ].map(opt => (
                                                <Button key={opt.label} variant="outline" size="sm"
                                                    className="h-7 px-2 text-xs rounded-lg"
                                                    onClick={() => {
                                                        const to = new Date()
                                                        setProdDateTo(to.toISOString().split('T')[0])
                                                        if (opt.months === 0) { setProdDateFrom('') }
                                                        else {
                                                            const from = new Date(to)
                                                            from.setMonth(from.getMonth() - opt.months)
                                                            setProdDateFrom(from.toISOString().split('T')[0])
                                                        }
                                                    }}>
                                                    {opt.label}
                                                </Button>
                                            ))}
                                        </div>
                                        <span className="text-xs text-muted-foreground ml-auto">
                                            {productionAnalysisData.monthlyData.length} meses · {prodAnalysisRecords.length} lotes
                                        </span>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Producción Mensual */}
                            <Card className="border-none shadow-sm dark:bg-slate-900 rounded-[2rem]">
                                <CardHeader>
                                    <CardTitle className="text-lg font-bold">Producción Mensual</CardTitle>
                                    <CardDescription>Volumen mensual separado entre Productos terminados y Bases (×20)</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex flex-col lg:flex-row gap-6">
                                        {/* Chart */}
                                        <div className="flex-1 min-w-0 h-[320px]">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={productionAnalysisData.monthlyData}
                                                    margin={{ top: 10, right: 20, left: 10, bottom: 50 }}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                                    <XAxis dataKey="label" fontSize={10} angle={-45} textAnchor="end"
                                                        height={60} interval={0} tick={{ fill: '#64748b' }} />
                                                    <YAxis fontSize={11} tickLine={false} axisLine={false}
                                                        tickFormatter={v => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)} />
                                                    <Tooltip
                                                        contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0/0.1)' }}
                                                        formatter={(value) => [`${Number(value).toLocaleString()} L`]}
                                                    />
                                                    <Legend wrapperStyle={{ paddingTop: '12px' }} />
                                                    <Bar dataKey="productos" name="Productos" stackId="a" fill="#c02820" radius={[0, 0, 0, 0]} />
                                                    <Bar dataKey="bases" name="Bases" stackId="a" fill="#2a35b8" radius={[3, 3, 0, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                        {/* Table */}
                                        <div className="lg:w-64 shrink-0">
                                            <div className="max-h-[320px] overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700">
                                                <table className="w-full text-xs">
                                                    <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800">
                                                        <tr>
                                                            <th className="text-left px-3 py-2 font-semibold text-slate-600 dark:text-slate-300">Mes</th>
                                                            <th className="text-right px-2 py-2 font-semibold text-[#C1272D]">Prod.</th>
                                                            <th className="text-right px-3 py-2 font-semibold text-cyan-600">Bases</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                        {productionAnalysisData.monthlyData.map(m => (
                                                            <tr key={m.key} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                                <td className="px-3 py-1.5 font-medium text-slate-700 dark:text-slate-300 capitalize">{m.label}</td>
                                                                <td className="px-2 py-1.5 text-right font-mono text-slate-600 dark:text-slate-400">{m.productos.toLocaleString()}</td>
                                                                <td className="px-3 py-1.5 text-right font-mono text-slate-600 dark:text-slate-400">{m.bases.toLocaleString()}</td>
                                                            </tr>
                                                        ))}
                                                        {productionAnalysisData.monthlyData.length === 0 && (
                                                            <tr><td colSpan={3} className="px-3 py-8 text-center text-muted-foreground">Sin datos</td></tr>
                                                        )}
                                                    </tbody>
                                                    <tfoot className="sticky bottom-0 bg-slate-100 dark:bg-slate-700">
                                                        <tr>
                                                            <td className="px-3 py-2 font-bold text-slate-700 dark:text-slate-200">Total</td>
                                                            <td className="px-2 py-2 text-right font-bold font-mono text-slate-700 dark:text-slate-200">
                                                                {productionAnalysisData.monthlyData.reduce((s, m) => s + m.productos, 0).toLocaleString()}
                                                            </td>
                                                            <td className="px-3 py-2 text-right font-bold font-mono text-slate-700 dark:text-slate-200">
                                                                {productionAnalysisData.monthlyData.reduce((s, m) => s + m.bases, 0).toLocaleString()}
                                                            </td>
                                                        </tr>
                                                    </tfoot>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Familia de Producto (Línea) */}
                            <Card className="border-none shadow-sm dark:bg-slate-900 rounded-[2rem]">
                                <CardHeader>
                                    <CardTitle className="text-lg font-bold">Familia de Producto</CardTitle>
                                    <CardDescription>Distribución de volumen producido por línea de producto</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex flex-col lg:flex-row gap-6">
                                        <div className="lg:w-[340px] shrink-0 h-[320px]">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie data={productionAnalysisData.groupData}
                                                        cx="50%" cy="50%" innerRadius="45%" outerRadius="68%"
                                                        paddingAngle={2} dataKey="value" nameKey="name">
                                                        {productionAnalysisData.groupData.map((_, i) => {
                                                            const colors = ['#0b109f','#e2211c','#2a35b8','#c02820','#4352cc','#a02019','#5d6fd9','#d43630','#7585e2','#b84540','#8e9dee','#cc5550']
                                                            return <Cell key={i} fill={colors[i % colors.length]} />
                                                        })}
                                                    </Pie>
                                                    <Tooltip formatter={(value) => [`${Number(value).toLocaleString()} L`]} />
                                                    <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: '11px' }} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="max-h-[320px] overflow-auto rounded-xl border border-slate-200 dark:border-slate-700">
                                                <table className="w-full text-xs min-w-[500px]">
                                                    <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 z-10">
                                                        <tr>
                                                            <th className="sticky left-0 bg-slate-50 dark:bg-slate-800 text-left px-3 py-2 font-semibold text-slate-600 dark:text-slate-300 min-w-[180px]">Familia</th>
                                                            {productionAnalysisData.months.map(mk => (
                                                                <th key={mk} onClick={() => { if (familySortKey === mk) setFamilySortDir(d => d === 'desc' ? 'asc' : 'desc'); else { setFamilySortKey(mk); setFamilySortDir('desc') } }}
                                                                    className="text-right px-2 py-2 font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap cursor-pointer hover:text-[#0b109f] select-none">
                                                                    {productionAnalysisData.monthlyData.find(m => m.key === mk)?.label ?? mk}{familySortKey === mk ? (familySortDir === 'desc' ? ' ↓' : ' ↑') : ' ↕'}
                                                                </th>
                                                            ))}
                                                            <th onClick={() => { if (familySortKey === 'total') setFamilySortDir(d => d === 'desc' ? 'asc' : 'desc'); else { setFamilySortKey('total'); setFamilySortDir('desc') } }}
                                                                className="text-right px-3 py-2 font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 whitespace-nowrap cursor-pointer hover:text-[#0b109f] select-none">
                                                                Total L{familySortKey === 'total' ? (familySortDir === 'desc' ? ' ↓' : ' ↑') : ' ↕'}
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                        {[...productionAnalysisData.groupTableData].sort((a, b) => {
                                                            if (!familySortKey) return 0
                                                            const av = familySortKey === 'total' ? a.total : (a.byMonth[familySortKey] ?? 0)
                                                            const bv = familySortKey === 'total' ? b.total : (b.byMonth[familySortKey] ?? 0)
                                                            return familySortDir === 'desc' ? bv - av : av - bv
                                                        }).map(g => (
                                                            <tr key={g.name} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                                <td className="sticky left-0 bg-white dark:bg-slate-900 px-3 py-1.5 font-medium text-slate-700 dark:text-slate-300 truncate max-w-[180px]">{g.name}</td>
                                                                {productionAnalysisData.months.map(mk => (
                                                                    <td key={mk} className="px-2 py-1.5 text-right font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                                                        {g.byMonth[mk] ? g.byMonth[mk].toLocaleString() : '—'}
                                                                    </td>
                                                                ))}
                                                                <td className="px-3 py-1.5 text-right font-bold font-mono text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 whitespace-nowrap">{g.total.toLocaleString()}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Categoría de Productos */}
                            <Card className="border-none shadow-sm dark:bg-slate-900 rounded-[2rem]">
                                <CardHeader>
                                    <CardTitle className="text-lg font-bold">Categoría de Productos</CardTitle>
                                    <CardDescription>Distribución de volumen producido por categoría</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex flex-col lg:flex-row gap-6">
                                        <div className="lg:w-[340px] shrink-0 h-[320px]">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie data={productionAnalysisData.familyData.slice(0, 15)}
                                                        cx="50%" cy="50%" innerRadius="45%" outerRadius="68%"
                                                        paddingAngle={2} dataKey="value" nameKey="name">
                                                        {productionAnalysisData.familyData.slice(0, 15).map((_, i) => {
                                                            const colors = ['#0b109f','#e2211c','#2a35b8','#c02820','#4352cc','#a02019','#5d6fd9','#d43630','#7585e2','#b84540','#8e9dee','#cc5550','#a6b3f5','#d96a65','#becaf8']
                                                            return <Cell key={i} fill={colors[i % colors.length]} />
                                                        })}
                                                    </Pie>
                                                    <Tooltip formatter={(value) => [`${Number(value).toLocaleString()} L`]} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="max-h-[320px] overflow-auto rounded-xl border border-slate-200 dark:border-slate-700">
                                                <table className="w-full text-xs min-w-[500px]">
                                                    <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 z-10">
                                                        <tr>
                                                            <th className="sticky left-0 bg-slate-50 dark:bg-slate-800 text-left px-3 py-2 font-semibold text-slate-600 dark:text-slate-300 min-w-[160px]">Categoría</th>
                                                            {productionAnalysisData.months.map(mk => {
                                                                const label = productionAnalysisData.monthlyData.find(m => m.key === mk)?.label ?? mk
                                                                return (
                                                                    <th key={mk} onClick={() => { if (categoriaSortKey === mk) setCategoriaSortDir(d => d === 'desc' ? 'asc' : 'desc'); else { setCategoriaSortKey(mk); setCategoriaSortDir('desc') } }}
                                                                        className="text-right px-2 py-2 font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap cursor-pointer hover:text-[#0b109f] select-none">
                                                                        {label}{categoriaSortKey === mk ? (categoriaSortDir === 'desc' ? ' ↓' : ' ↑') : ' ↕'}
                                                                    </th>
                                                                )
                                                            })}
                                                            <th onClick={() => { if (categoriaSortKey === 'total') setCategoriaSortDir(d => d === 'desc' ? 'asc' : 'desc'); else { setCategoriaSortKey('total'); setCategoriaSortDir('desc') } }}
                                                                className="text-right px-3 py-2 font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 whitespace-nowrap cursor-pointer hover:text-[#0b109f] select-none">
                                                                Total L{categoriaSortKey === 'total' ? (categoriaSortDir === 'desc' ? ' ↓' : ' ↑') : ' ↕'}
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                        {[...productionAnalysisData.familyTableData].sort((a, b) => {
                                                            if (!categoriaSortKey) return 0
                                                            const av = categoriaSortKey === 'total' ? a.total : (a.byMonth[categoriaSortKey] ?? 0)
                                                            const bv = categoriaSortKey === 'total' ? b.total : (b.byMonth[categoriaSortKey] ?? 0)
                                                            return categoriaSortDir === 'desc' ? bv - av : av - bv
                                                        }).map(f => (
                                                            <tr key={f.name} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                                <td className="sticky left-0 bg-white dark:bg-slate-900 px-3 py-1.5 font-medium text-slate-700 dark:text-slate-300 truncate max-w-[160px]">{f.name}</td>
                                                                {productionAnalysisData.months.map(mk => (
                                                                    <td key={mk} className="px-2 py-1.5 text-right font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                                                        {f.byMonth[mk] ? f.byMonth[mk].toLocaleString() : '—'}
                                                                    </td>
                                                                ))}
                                                                <td className="px-3 py-1.5 text-right font-bold font-mono text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 whitespace-nowrap">{f.total.toLocaleString()}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Por Código de Producto */}
                            <Card className="border-none shadow-sm dark:bg-slate-900 rounded-[2rem]">
                                <CardHeader>
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <CardTitle className="text-lg font-bold">Por Código de Producto</CardTitle>
                                            <CardDescription>Volumen producido por código de producto ({productionAnalysisData.codeData.length} códigos)</CardDescription>
                                        </div>
                                        <div className="relative">
                                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                                            <Input placeholder="Buscar código..." value={codeSearch}
                                                onChange={e => setCodeSearch(e.target.value)}
                                                className="pl-8 h-8 text-xs w-40 rounded-lg" />
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex flex-col lg:flex-row gap-6">
                                        <div className="lg:w-[340px] shrink-0 h-[320px]">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie data={productionAnalysisData.codeData.slice(0, 12)}
                                                        cx="50%" cy="50%" innerRadius="45%" outerRadius="68%"
                                                        paddingAngle={2} dataKey="value" nameKey="name">
                                                        {productionAnalysisData.codeData.slice(0, 12).map((_, i) => {
                                                            const colors = ['#0b109f','#e2211c','#2a35b8','#c02820','#4352cc','#a02019','#5d6fd9','#d43630','#7585e2','#b84540','#8e9dee','#cc5550']
                                                            return <Cell key={i} fill={colors[i % colors.length]} />
                                                        })}
                                                    </Pie>
                                                    <Tooltip formatter={(value) => [`${Number(value).toLocaleString()} L`]} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="max-h-[320px] overflow-auto rounded-xl border border-slate-200 dark:border-slate-700">
                                                <table className="w-full text-xs min-w-[500px]">
                                                    <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 z-10">
                                                        <tr>
                                                            <th className="sticky left-0 bg-slate-50 dark:bg-slate-800 text-left px-3 py-2 font-semibold text-slate-600 dark:text-slate-300 min-w-[140px]">Código</th>
                                                            {productionAnalysisData.months.map(mk => {
                                                                const label = productionAnalysisData.monthlyData.find(m => m.key === mk)?.label ?? mk
                                                                return (
                                                                    <th key={mk} onClick={() => { if (codigoSortKey === mk) setCodigoSortDir(d => d === 'desc' ? 'asc' : 'desc'); else { setCodigoSortKey(mk); setCodigoSortDir('desc') } }}
                                                                        className="text-right px-2 py-2 font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap cursor-pointer hover:text-[#0b109f] select-none">
                                                                        {label}{codigoSortKey === mk ? (codigoSortDir === 'desc' ? ' ↓' : ' ↑') : ' ↕'}
                                                                    </th>
                                                                )
                                                            })}
                                                            <th onClick={() => { if (codigoSortKey === 'total') setCodigoSortDir(d => d === 'desc' ? 'asc' : 'desc'); else { setCodigoSortKey('total'); setCodigoSortDir('desc') } }}
                                                                className="text-right px-3 py-2 font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 whitespace-nowrap cursor-pointer hover:text-[#0b109f] select-none">
                                                                Total L{codigoSortKey === 'total' ? (codigoSortDir === 'desc' ? ' ↓' : ' ↑') : ' ↕'}
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                        {[...productionAnalysisData.codeTableData]
                                                            .filter(c => !codeSearch || c.name.toLowerCase().includes(codeSearch.toLowerCase()))
                                                            .sort((a, b) => {
                                                                if (!codigoSortKey) return 0
                                                                const av = codigoSortKey === 'total' ? a.total : (a.byMonth[codigoSortKey] ?? 0)
                                                                const bv = codigoSortKey === 'total' ? b.total : (b.byMonth[codigoSortKey] ?? 0)
                                                                return codigoSortDir === 'desc' ? bv - av : av - bv
                                                            })
                                                            .map(c => (
                                                            <tr key={c.name} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                                <td className="sticky left-0 bg-white dark:bg-slate-900 px-3 py-1.5 font-mono font-semibold text-slate-700 dark:text-slate-300">{c.name}</td>
                                                                {productionAnalysisData.months.map(mk => (
                                                                    <td key={mk} className="px-2 py-1.5 text-right font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                                                        {c.byMonth[mk] ? c.byMonth[mk].toLocaleString() : '—'}
                                                                    </td>
                                                                ))}
                                                                <td className="px-3 py-1.5 text-right font-bold font-mono text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 whitespace-nowrap">{c.total.toLocaleString()}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Producción por Sucursal — Heatmap */}
                            <Card className="border-none shadow-sm dark:bg-slate-900 rounded-[2rem]">
                                <CardHeader>
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <CardTitle className="text-lg font-bold">Producción por Sucursal</CardTitle>
                                            <CardDescription>Volumen mensual por sucursal con escala de calor</CardDescription>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setShowHeatColors(v => !v)}
                                                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors border ${showHeatColors ? 'bg-slate-700 text-white border-slate-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
                                                Mapa de calor
                                            </button>
                                            <div className="relative">
                                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                                                <Input placeholder="Buscar sucursal..." value={sucursalHeatmapSearch}
                                                    onChange={e => setSucursalHeatmapSearch(e.target.value)}
                                                    className="pl-8 h-8 text-xs w-44 rounded-lg" />
                                            </div>
                                        </div>
                                    </div>
                                    {/* Tabs + leyenda fija */}
                                    <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
                                        <div className="flex gap-1">
                                            {(['total', 'productos', 'bases'] as const).map(t => (
                                                <button key={t} onClick={() => setSucursalHeatmapTab(t)}
                                                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${sucursalHeatmapTab === t ? 'bg-[#C1272D] text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
                                                    {t === 'total' ? 'Producción Total' : t === 'productos' ? 'Productos' : 'Bases (L)'}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Menor</span>
                                            <div className="h-3.5 w-36 rounded-full" style={{
                                                background: `linear-gradient(to right, ${[0, 0.2, 0.4, 0.6, 0.8, 1].map(r => getHeatColor(r)).join(', ')})`
                                            }} />
                                            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Mayor</span>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {(() => {
                                        const rows = productionAnalysisData.sucursalRows
                                            .filter(r => !sucursalHeatmapSearch || r.name.toLowerCase().includes(sucursalHeatmapSearch.toLowerCase()))
                                        const months = productionAnalysisData.months
                                        const getVal = (row: typeof rows[0], mk: string) => {
                                            const m = row.mData[mk]
                                            if (!m) return 0
                                            return sucursalHeatmapTab === 'total' ? m.productos + m.bases
                                                : sucursalHeatmapTab === 'productos' ? m.productos : m.bases
                                        }
                                        const getTotal = (row: typeof rows[0]) =>
                                            sucursalHeatmapTab === 'total' ? row.total
                                                : sucursalHeatmapTab === 'productos' ? row.totProd : row.totBase
                                        const colMaxes = months.map(mk => Math.max(...rows.map(r => getVal(r, mk)), 1))
                                        const yearGroups: Record<number, string[]> = {}
                                        months.forEach(mk => {
                                            const yr = parseInt(mk.split('-')[0])
                                            if (!yearGroups[yr]) yearGroups[yr] = []
                                            yearGroups[yr].push(mk)
                                        })
                                        const years = Object.keys(yearGroups).map(Number).sort()

                                        const handleSort = (key: string) => {
                                            if (heatmapSortKey === key) setHeatmapSortDir(d => d === 'desc' ? 'asc' : 'desc')
                                            else { setHeatmapSortKey(key); setHeatmapSortDir('desc') }
                                        }
                                        const sortedRows = heatmapSortKey
                                            ? [...rows].sort((a, b) => {
                                                let aVal = 0, bVal = 0
                                                if (heatmapSortKey.startsWith('year-')) {
                                                    const yr = parseInt(heatmapSortKey.replace('year-', ''))
                                                    aVal = yearGroups[yr]?.reduce((s, mk) => s + getVal(a, mk), 0) ?? 0
                                                    bVal = yearGroups[yr]?.reduce((s, mk) => s + getVal(b, mk), 0) ?? 0
                                                } else {
                                                    aVal = getVal(a, heatmapSortKey)
                                                    bVal = getVal(b, heatmapSortKey)
                                                }
                                                return heatmapSortDir === 'desc' ? bVal - aVal : aVal - bVal
                                            })
                                            : rows
                                        const sortIcon = (key: string) => heatmapSortKey === key
                                            ? (heatmapSortDir === 'desc' ? ' ↓' : ' ↑')
                                            : ' ↕'

                                        return (
                                            <div className="overflow-auto max-h-[480px] rounded-xl border border-slate-200 dark:border-slate-700">
                                                <table className="w-full text-xs min-w-[700px] border-collapse">
                                                    <thead className="sticky top-0 z-10">
                                                        {/* Year header */}
                                                        <tr className="bg-slate-100 dark:bg-slate-800">
                                                            <th className="sticky left-0 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-left text-slate-500 font-semibold" rowSpan={2}>#</th>
                                                            <th className="sticky left-7 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-left text-slate-600 dark:text-slate-300 font-bold min-w-[130px]" rowSpan={2}>SUCURSAL</th>
                                                            {years.map(yr => (
                                                                <th key={yr} colSpan={yearGroups[yr].length + 1}
                                                                    className="px-2 py-1.5 text-center font-bold text-slate-700 dark:text-slate-200 border-l border-slate-300 dark:border-slate-600">
                                                                    {yr}
                                                                </th>
                                                            ))}
                                                        </tr>
                                                        {/* Month + Total header — clicables para ordenar */}
                                                        <tr className="bg-slate-50 dark:bg-slate-800/80">
                                                            {years.map(yr =>
                                                                [...yearGroups[yr].map(mk => (
                                                                    <th key={mk}
                                                                        onClick={() => handleSort(mk)}
                                                                        className={`px-2 py-1.5 text-right font-semibold whitespace-nowrap border-l border-slate-200 dark:border-slate-700 cursor-pointer select-none transition-colors hover:bg-slate-200 dark:hover:bg-slate-700 ${heatmapSortKey === mk ? 'text-[#C1272D]' : 'text-slate-500 dark:text-slate-400'}`}>
                                                                        {new Date(mk + '-15').toLocaleDateString('es-MX', { month: 'short' }).replace('.', '')}
                                                                        {String(yr).slice(2)}
                                                                        <span className="opacity-60">{sortIcon(mk)}</span>
                                                                    </th>
                                                                )),
                                                                <th key={`total-${yr}`}
                                                                    onClick={() => handleSort(`year-${yr}`)}
                                                                    className={`px-3 py-1.5 text-right font-bold whitespace-nowrap bg-slate-100 dark:bg-slate-700 border-l-2 border-slate-300 dark:border-slate-500 cursor-pointer select-none transition-colors hover:bg-slate-200 dark:hover:bg-slate-600 ${heatmapSortKey === `year-${yr}` ? 'text-[#C1272D]' : 'text-slate-600 dark:text-slate-300'}`}>
                                                                    Total {yr}
                                                                    <span className="opacity-60">{sortIcon(`year-${yr}`)}</span>
                                                                </th>]
                                                            )}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {sortedRows.map((row, ri) => (
                                                            <tr key={row.name} className="border-b border-slate-100 dark:border-slate-800 hover:brightness-110 transition-all">
                                                                <td className="sticky left-0 bg-white dark:bg-slate-900 px-3 py-2 text-slate-400 font-semibold text-center">{ri + 1}</td>
                                                                <td className="sticky left-7 bg-white dark:bg-slate-900 px-3 py-2 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">{row.name}</td>
                                                                {years.map(yr => [
                                                                    ...yearGroups[yr].map(mk => {
                                                                        const globalMkIdx = months.indexOf(mk)
                                                                        const val = getVal(row, mk)
                                                                        const ratio = val / colMaxes[globalMkIdx]
                                                                        const bg = val > 0 && showHeatColors ? getHeatColor(ratio) : 'transparent'
                                                                        return (
                                                                            <td key={mk} style={{ backgroundColor: bg, color: val > 0 && showHeatColors ? '#fff' : undefined }}
                                                                                className="px-2 py-2 text-right font-mono whitespace-nowrap border-l border-slate-200/30 dark:border-slate-700/30 text-slate-400 dark:text-slate-500">
                                                                                {val > 0 ? val.toLocaleString() : '—'}
                                                                            </td>
                                                                        )
                                                                    }),
                                                                    <td key={`yt-${row.name}-${yr}`}
                                                                        className="px-3 py-2 text-right font-bold font-mono whitespace-nowrap border-l-2 border-slate-300 dark:border-slate-500 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                                                                        {yearGroups[yr].reduce((s, mk) => s + getVal(row, mk), 0).toLocaleString()}
                                                                    </td>
                                                                ])}
                                                            </tr>
                                                        ))}
                                                        {rows.length === 0 && (
                                                            <tr><td colSpan={2 + months.length + years.length} className="px-3 py-10 text-center text-muted-foreground">Sin datos en el período seleccionado</td></tr>
                                                        )}
                                                    </tbody>
                                                    <tfoot className="sticky bottom-0 bg-slate-100 dark:bg-slate-800 font-bold">
                                                        <tr>
                                                            <td className="sticky left-0 bg-slate-100 dark:bg-slate-800 px-3 py-2"></td>
                                                            <td className="sticky left-7 bg-slate-100 dark:bg-slate-800 px-3 py-2 text-slate-700 dark:text-slate-200">TOTAL</td>
                                                            {years.map(yr => [
                                                                ...yearGroups[yr].map(mk => (
                                                                    <td key={mk} className="px-2 py-2 text-right font-mono border-l border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200">
                                                                        {rows.reduce((s, r) => s + getVal(r, mk), 0).toLocaleString()}
                                                                    </td>
                                                                )),
                                                                <td key={`ft-${yr}`} className="px-3 py-2 text-right font-mono border-l-2 border-slate-400 dark:border-slate-500 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100">
                                                                    {rows.reduce((s, r) => s + yearGroups[yr].reduce((ss, mk) => ss + getVal(r, mk), 0), 0).toLocaleString()}
                                                                </td>
                                                            ])}
                                                        </tr>
                                                    </tfoot>
                                                </table>
                                            </div>
                                        )
                                    })()}
                                </CardContent>
                            </Card>
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
                open={printModal === 'comercial'}
                onClose={() => setPrintModal(null)}
                onConfirm={handlePrintConfirm('comercial')}
                title="Reporte Análisis de Operación"
            />

            {/* Print Views */}
            {printView && printView.tab === 'comercial' && (() => {
                const pr = printFilteredRecords
                if (!pr || pr.length === 0) {
                    return (
                        <PrintReportWrapper
                            title="Reporte Análisis de Operación"
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
                    topBySuc[s].push({ name: (r as any).nombre_producto, value: r.tamano_lote })
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

                // Monthly breakdown aggregations for the three analysis tables
                const printCatToGroup: Record<string, string> = {}
                for (const g of PRODUCT_GROUPS) {
                    for (const id of g.ids) {
                        const cat = PRODUCT_CATEGORIES.find(c => c.id === id)
                        if (cat) printCatToGroup[cat.name] = g.title
                    }
                }
                const printGroupMonthMap: Record<string, Record<string, number>> = {}
                const printFamilyMonthMap: Record<string, Record<string, number>> = {}
                const printCodeMonthMap: Record<string, Record<string, number>> = {}
                const printByMonth: Record<string, { productos: number, bases: number }> = {}
                const printBySucursalMonth: Record<string, Record<string, { productos: number, bases: number }>> = {}
                const printAllMonths = new Set<string>()

                pr.forEach((r: any) => {
                    const dateStr = r.fecha_fabricacion || r.created_at
                    const date = new Date(dateStr)
                    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
                    printAllMonths.add(monthKey)
                    const fam = (r.familia_producto || 'Otros') as string
                    const isBase = PIECE_FAMILIES.includes(fam)
                    const val = r.tamano_lote ? parseFloat(r.tamano_lote) : 0
                    const litros = isBase ? val * 20 : val
                    const groupName = printCatToGroup[fam] || 'Otros'
                    if (!printGroupMonthMap[groupName]) printGroupMonthMap[groupName] = {}
                    printGroupMonthMap[groupName][monthKey] = (printGroupMonthMap[groupName][monthKey] || 0) + litros
                    if (!printFamilyMonthMap[fam]) printFamilyMonthMap[fam] = {}
                    printFamilyMonthMap[fam][monthKey] = (printFamilyMonthMap[fam][monthKey] || 0) + litros
                    const code = (r.codigo_producto || 'Sin código') as string
                    if (!printCodeMonthMap[code]) printCodeMonthMap[code] = {}
                    printCodeMonthMap[code][monthKey] = (printCodeMonthMap[code][monthKey] || 0) + litros
                    if (!printByMonth[monthKey]) printByMonth[monthKey] = { productos: 0, bases: 0 }
                    if (isBase) printByMonth[monthKey].bases += litros
                    else printByMonth[monthKey].productos += litros
                    const suc = (r.sucursal || 'Sin Sucursal') as string
                    if (!printBySucursalMonth[suc]) printBySucursalMonth[suc] = {}
                    if (!printBySucursalMonth[suc][monthKey]) printBySucursalMonth[suc][monthKey] = { productos: 0, bases: 0 }
                    if (isBase) printBySucursalMonth[suc][monthKey].bases += litros
                    else printBySucursalMonth[suc][monthKey].productos += litros
                })

                const printMonthsSorted = Array.from(printAllMonths).sort()
                const MAX_PRINT_COLS = 8
                const printMonthCols = printMonthsSorted.slice(-MAX_PRINT_COLS)
                const fmtPrintMonth = (key: string) => {
                    const [y, m] = key.split('-')
                    const d = new Date(parseInt(y), parseInt(m) - 1, 1)
                    return d.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' }).replace('. ', ' \'')
                }
                const printMonthlyData = printMonthsSorted.map(mk => ({
                    key: mk,
                    label: fmtPrintMonth(mk),
                    productos: printByMonth[mk]?.productos || 0,
                    bases: printByMonth[mk]?.bases || 0,
                    total: (printByMonth[mk]?.productos || 0) + (printByMonth[mk]?.bases || 0)
                }))
                const printSucursalRows = Object.entries(printBySucursalMonth).map(([name, mData]) => {
                    const totProd = Object.values(mData).reduce((s, m) => s + m.productos, 0)
                    const totBase = Object.values(mData).reduce((s, m) => s + m.bases, 0)
                    return { name, mData, totProd, totBase, total: totProd + totBase }
                }).sort((a, b) => b.total - a.total)
                const printGroupRows = Object.entries(printGroupMonthMap)
                    .map(([name, mData]) => ({ name, byMonth: mData, total: Object.values(mData).reduce((s, v) => s + v, 0) }))
                    .sort((a, b) => b.total - a.total)
                const printFamilyRows = Object.entries(printFamilyMonthMap)
                    .map(([name, mData]) => ({ name, byMonth: mData, total: Object.values(mData).reduce((s, v) => s + v, 0) }))
                    .sort((a, b) => b.total - a.total)
                const printCodeRows = Object.entries(printCodeMonthMap)
                    .map(([name, mData]) => ({ name, byMonth: mData, total: Object.values(mData).reduce((s, v) => s + v, 0) }))
                    .sort((a, b) => b.total - a.total)
                    .slice(0, 15)

                // ── CONCLUSIONES AUTOMÁTICAS ────────────────────────────────
                type OpInsight = { level: 'ok' | 'warn' | 'info'; text: string }
                const opInsights: OpInsight[] = []
                const totalLitros = totalVol + totalPcs * 20
                const basesPct = totalLitros > 0 ? (totalPcs * 20 / totalLitros) * 100 : 0

                // 1. Composición Productos vs Bases
                if (basesPct > 40) {
                    opInsights.push({ level: 'info', text: `Las bases representan el ${basesPct.toFixed(1)}% del volumen unificado del período. La operación tiene una carga significativa de fabricación de bases; considerar si la capacidad de conversión a producto terminado está alineada con esta demanda.` })
                } else if (basesPct < 5 && totalPcs > 0) {
                    opInsights.push({ level: 'info', text: `La producción de bases es marginal (${basesPct.toFixed(1)}% del total). La operación del período está enfocada principalmente en producto terminado.` })
                }

                // 2. Tendencia mensual
                if (printMonthlyData.length >= 3) {
                    const first = printMonthlyData[0]
                    const last = printMonthlyData[printMonthlyData.length - 1]
                    const trendPct = first.total > 0 ? ((last.total - first.total) / first.total) * 100 : 0
                    const peakMonth = printMonthlyData.reduce((mx, m) => m.total > mx.total ? m : mx, printMonthlyData[0])
                    if (trendPct > 15) {
                        opInsights.push({ level: 'ok', text: `La producción muestra una tendencia de crecimiento positiva del ${trendPct.toFixed(1)}% entre el primer y último mes del período. El mes de mayor volumen fue ${peakMonth.label} con ${peakMonth.total.toLocaleString()} L.` })
                    } else if (trendPct < -15) {
                        opInsights.push({ level: 'warn', text: `La producción presenta una caída del ${Math.abs(trendPct).toFixed(1)}% entre el inicio y fin del período. Se recomienda revisar los factores que incidieron en la desaceleración. El mes de mayor volumen fue ${peakMonth.label}.` })
                    } else {
                        opInsights.push({ level: 'ok', text: `La producción se mantuvo estable en el período (variación de ${trendPct > 0 ? '+' : ''}${trendPct.toFixed(1)}%). El mes de mayor volumen fue ${peakMonth.label} con ${peakMonth.total.toLocaleString()} L equiv.` })
                    }
                }

                // 3. Concentración geográfica
                if (sucursalBarData.length > 0) {
                    const top1Pct = totalVol > 0 ? (sucursalBarData[0].value / totalVol) * 100 : 0
                    const top3Vol = sucursalBarData.slice(0, 3).reduce((s, d) => s + d.value, 0)
                    const top3Pct = totalVol > 0 ? (top3Vol / totalVol) * 100 : 0
                    if (top1Pct > 40) {
                        opInsights.push({ level: 'warn', text: `La sucursal ${sucursalBarData[0].name} concentra el ${top1Pct.toFixed(1)}% del volumen de productos terminados. Existe alta dependencia de un solo punto de producción; evaluar distribución de carga entre sucursales.` })
                    } else {
                        opInsights.push({ level: 'ok', text: `El volumen está relativamente distribuido entre sucursales. ${sucursalBarData[0].name} es la líder con ${top1Pct.toFixed(1)}%, y las 3 principales concentran el ${top3Pct.toFixed(1)}% del total de ${sucursalBarData.length} sucursales activas.` })
                    }
                }

                // 4. Familia dominante
                if (printFamilyRows.length > 0) {
                    const topFam = printFamilyRows[0]
                    const famPct = totalLitros > 0 ? (topFam.total / totalLitros) * 100 : 0
                    opInsights.push({ level: famPct > 50 ? 'info' : 'ok', text: `La familia de productos con mayor volumen es "${topFam.name}" con ${topFam.total.toLocaleString()} L equiv. (${famPct.toFixed(1)}% del total). ${famPct > 50 ? 'Esta concentración sugiere especialización operativa en esta línea.' : `Le siguen ${printFamilyRows[1] ? `"${printFamilyRows[1].name}"` : '—'} y ${printFamilyRows[2] ? `"${printFamilyRows[2].name}"` : '—'}.`}` })
                }

                // 5. Concentración de SKUs
                if (topProds.length >= 3) {
                    const top3SkuVol = topProds.slice(0, 3).reduce((s, [, v]) => s + v, 0)
                    const top3SkuPct = totalVol > 0 ? (top3SkuVol / totalVol) * 100 : 0
                    if (top3SkuPct > 70) {
                        opInsights.push({ level: 'info', text: `Los 3 SKUs de mayor volumen (${topProds.slice(0, 3).map(([c]) => c).join(', ')}) representan el ${top3SkuPct.toFixed(1)}% de la producción de productos terminados. El portafolio activo está altamente concentrado en pocos códigos.` })
                    } else {
                        opInsights.push({ level: 'ok', text: `El portafolio muestra una distribución saludable: los 3 SKUs líderes representan el ${top3SkuPct.toFixed(1)}% del volumen entre ${topProds.length} referencias activas en el período.` })
                    }
                }

                return (
                    <PrintReportWrapper
                        title="Reporte Análisis de Operación"
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

                        {/* Producción Mensual — stacked bar + table */}
                        <div className="print-no-break" style={{ marginTop: '30px', paddingBottom: '20px', borderBottom: '1px solid #f1f5f9' }}>
                            <h3 style={{ fontSize: '14pt', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>Producción Mensual</h3>
                            <p className="text-[9pt] text-slate-500 mb-4">Volumen mensual separado entre Productos terminados y Bases (×20)</p>
                            <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
                                <div style={{ flex: 1 }}>
                                    <BarChart width={530} height={220} data={printMonthlyData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="label" fontSize={9} tick={{ fill: '#475569' }} />
                                        <YAxis fontSize={9} tick={{ fill: '#475569' }} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
                                        <Bar dataKey="productos" stackId="a" fill="#C1272D" name="Productos" radius={[0, 0, 0, 0]} />
                                        <Bar dataKey="bases" stackId="a" fill="#06b6d4" name="Bases" radius={[3, 3, 0, 0]} />
                                        <Legend iconSize={10} wrapperStyle={{ fontSize: '9pt' }} />
                                    </BarChart>
                                </div>
                                <div style={{ width: '200px', flexShrink: 0 }}>
                                    <table className="print-table" style={{ marginBottom: 0 }}>
                                        <thead>
                                            <tr>
                                                <th>Mes</th>
                                                <th style={{ textAlign: 'right', color: '#C1272D' }}>Prod.</th>
                                                <th style={{ textAlign: 'right', color: '#06b6d4' }}>Bases</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {printMonthlyData.map((m, i) => (
                                                <tr key={m.key} style={{ backgroundColor: i % 2 === 0 ? '#f8fafc' : 'white' }}>
                                                    <td style={{ fontWeight: 600 }}>{m.label}</td>
                                                    <td style={{ textAlign: 'right' }}>{m.productos.toLocaleString()}</td>
                                                    <td style={{ textAlign: 'right' }}>{m.bases > 0 ? m.bases.toLocaleString() : '—'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr style={{ borderTop: '2px solid #e2e8f0' }}>
                                                <td style={{ fontWeight: 900 }}>Total</td>
                                                <td style={{ textAlign: 'right', fontWeight: 900, color: '#C1272D' }}>
                                                    {printMonthlyData.reduce((s, m) => s + m.productos, 0).toLocaleString()}
                                                </td>
                                                <td style={{ textAlign: 'right', fontWeight: 900, color: '#06b6d4' }}>
                                                    {printMonthlyData.reduce((s, m) => s + m.bases, 0).toLocaleString()}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
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

                        {/* Producción por Sucursal — heatmap table */}
                        <div className="print-break print-no-break" style={{ marginTop: '30px', paddingBottom: '20px', borderBottom: '1px solid #f1f5f9' }}>
                            <h3 style={{ fontSize: '14pt', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>Producción por Sucursal — Desglose Mensual (L equiv.)</h3>
                            <p className="text-[9pt] text-slate-500 mb-4">Volumen total producido por sucursal por mes</p>
                            <table className="print-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '24px', textAlign: 'center' }}>#</th>
                                        <th>Sucursal</th>
                                        {printMonthCols.map(mk => <th key={mk} style={{ textAlign: 'right' }}>{fmtPrintMonth(mk)}</th>)}
                                        {printMonthsSorted.length > MAX_PRINT_COLS && <th style={{ textAlign: 'center', fontSize: '6pt' }}>+{printMonthsSorted.length - MAX_PRINT_COLS}m.</th>}
                                        <th style={{ textAlign: 'right' }}>Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {printSucursalRows.map((row, i) => {
                                        const colMax = printMonthCols.reduce((mx, mk) => {
                                            const v = (row.mData[mk]?.productos || 0) + (row.mData[mk]?.bases || 0)
                                            return v > mx ? v : mx
                                        }, 0)
                                        return (
                                            <tr key={row.name} style={{ backgroundColor: i % 2 === 0 ? '#f8fafc' : 'white' }}>
                                                <td style={{ textAlign: 'center', fontWeight: 700, color: '#94a3b8' }}>{i + 1}</td>
                                                <td style={{ fontWeight: 700, color: '#0f172a' }}>{row.name}</td>
                                                {printMonthCols.map(mk => {
                                                    const v = (row.mData[mk]?.productos || 0) + (row.mData[mk]?.bases || 0)
                                                    const colTotal = printSucursalRows.reduce((s, r2) => s + ((r2.mData[mk]?.productos || 0) + (r2.mData[mk]?.bases || 0)), 0)
                                                    const ratio = colTotal > 0 ? v / colTotal : 0
                                                    const bg = v > 0 ? getHeatColor(ratio) : 'transparent'
                                                    return (
                                                        <td key={mk} style={{ textAlign: 'right', backgroundColor: bg, color: ratio > 0.5 ? 'white' : '#0f172a', fontWeight: v > 0 ? 700 : 400 }}>
                                                            {v > 0 ? v.toLocaleString() : '—'}
                                                        </td>
                                                    )
                                                })}
                                                {printMonthsSorted.length > MAX_PRINT_COLS && <td />}
                                                <td style={{ textAlign: 'right', fontWeight: 900, color: '#0e0c9b' }}>
                                                    {row.total.toLocaleString()}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr style={{ borderTop: '2px solid #cbd5e1' }}>
                                        <td colSpan={2} style={{ fontWeight: 900 }}>TOTAL</td>
                                        {printMonthCols.map(mk => {
                                            const colTotal = printSucursalRows.reduce((s, r2) => s + ((r2.mData[mk]?.productos || 0) + (r2.mData[mk]?.bases || 0)), 0)
                                            return <td key={mk} style={{ textAlign: 'right', fontWeight: 900 }}>{colTotal > 0 ? colTotal.toLocaleString() : '—'}</td>
                                        })}
                                        {printMonthsSorted.length > MAX_PRINT_COLS && <td />}
                                        <td style={{ textAlign: 'right', fontWeight: 900, color: '#0e0c9b' }}>
                                            {printSucursalRows.reduce((s, r2) => s + r2.total, 0).toLocaleString()}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
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

                        {/* Familia de Producto — monthly breakdown */}
                        <div className="print-break print-no-break" style={{ marginTop: '30px', paddingBottom: '10px', borderBottom: '1px solid #f1f5f9' }}>
                            <h3 style={{ fontSize: '14pt', fontWeight: 900, color: '#0e0c9b', borderLeft: '4px solid #0e0c9b', paddingLeft: '12px', marginBottom: '12px' }}>
                                Producción por Familia de Producto (L equiv.)
                            </h3>
                            {printGroupRows.length === 0 ? (
                                <p style={{ fontSize: '9pt', color: '#94a3b8' }}>Sin datos disponibles para el periodo seleccionado.</p>
                            ) : (
                                <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
                                    <div style={{ flex: '0 0 auto' }}>
                                        <PieChart width={200} height={180}>
                                            <Pie data={printGroupRows} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="total" stroke="none">
                                                {printGroupRows.map((_e, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                                            </Pie>
                                            <Tooltip formatter={(v: any) => `${Number(v).toLocaleString()} L`} />
                                        </PieChart>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <table className="print-table" style={{ marginBottom: 0 }}>
                                            <thead>
                                                <tr>
                                                    <th>Familia</th>
                                                    {printMonthCols.map(mk => <th key={mk} style={{ textAlign: 'right' }}>{fmtPrintMonth(mk)}</th>)}
                                                    {printMonthsSorted.length > MAX_PRINT_COLS && <th style={{ textAlign: 'center', fontSize: '6pt', color: '#94a3b8' }}>+{printMonthsSorted.length - MAX_PRINT_COLS} m.</th>}
                                                    <th style={{ textAlign: 'right' }}>Total L</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {printGroupRows.map((row, i) => (
                                                    <tr key={row.name} style={{ backgroundColor: i % 2 === 0 ? '#f8fafc' : 'white' }}>
                                                        <td style={{ fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: COLORS[i % COLORS.length], flexShrink: 0 }} />
                                                            {row.name}
                                                        </td>
                                                        {printMonthCols.map(mk => (
                                                            <td key={mk} style={{ textAlign: 'right' }}>
                                                                {row.byMonth[mk] ? row.byMonth[mk].toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}
                                                            </td>
                                                        ))}
                                                        {printMonthsSorted.length > MAX_PRINT_COLS && <td />}
                                                        <td style={{ textAlign: 'right', fontWeight: 900, color: '#0e0c9b' }}>
                                                            {row.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Categoría de Productos — monthly breakdown */}
                        <div className="print-break print-no-break" style={{ marginTop: '30px', paddingBottom: '10px', borderBottom: '1px solid #f1f5f9' }}>
                            <h3 style={{ fontSize: '14pt', fontWeight: 900, color: '#0e0c9b', borderLeft: '4px solid #0e0c9b', paddingLeft: '12px', marginBottom: '12px' }}>
                                Producción por Categoría de Productos (L equiv.)
                            </h3>
                            {printFamilyRows.length === 0 ? (
                                <p style={{ fontSize: '9pt', color: '#94a3b8' }}>Sin datos disponibles para el periodo seleccionado.</p>
                            ) : (
                                <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
                                    <div style={{ flex: '0 0 auto' }}>
                                        <PieChart width={200} height={200}>
                                            <Pie data={printFamilyRows} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={2} dataKey="total" stroke="none">
                                                {printFamilyRows.map((_e, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                                            </Pie>
                                            <Tooltip formatter={(v: any) => `${Number(v).toLocaleString()} L`} />
                                        </PieChart>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <table className="print-table" style={{ marginBottom: 0 }}>
                                            <thead>
                                                <tr>
                                                    <th>Categoría</th>
                                                    {printMonthCols.map(mk => <th key={mk} style={{ textAlign: 'right' }}>{fmtPrintMonth(mk)}</th>)}
                                                    {printMonthsSorted.length > MAX_PRINT_COLS && <th style={{ textAlign: 'center', fontSize: '6pt', color: '#94a3b8' }}>+{printMonthsSorted.length - MAX_PRINT_COLS} m.</th>}
                                                    <th style={{ textAlign: 'right' }}>Total L</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {printFamilyRows.map((row, i) => (
                                                    <tr key={row.name} style={{ backgroundColor: i % 2 === 0 ? '#f8fafc' : 'white' }}>
                                                        <td style={{ fontWeight: 600, color: '#334155' }}>{row.name}</td>
                                                        {printMonthCols.map(mk => (
                                                            <td key={mk} style={{ textAlign: 'right' }}>
                                                                {row.byMonth[mk] ? row.byMonth[mk].toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}
                                                            </td>
                                                        ))}
                                                        {printMonthsSorted.length > MAX_PRINT_COLS && <td />}
                                                        <td style={{ textAlign: 'right', fontWeight: 900, color: '#0e0c9b' }}>
                                                            {row.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Código de Producto — top 15 monthly breakdown */}
                        <div className="print-break print-no-break" style={{ marginTop: '30px', paddingBottom: '10px', borderBottom: '1px solid #f1f5f9' }}>
                            <h3 style={{ fontSize: '14pt', fontWeight: 900, color: '#0e0c9b', borderLeft: '4px solid #0e0c9b', paddingLeft: '12px', marginBottom: '12px' }}>
                                Producción por Código de Producto — Top 15 (L equiv.)
                            </h3>
                            {printCodeRows.length === 0 ? (
                                <p style={{ fontSize: '9pt', color: '#94a3b8' }}>Sin datos disponibles para el periodo seleccionado.</p>
                            ) : (
                                <table className="print-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: '28px', textAlign: 'center' }}>#</th>
                                            <th>Código</th>
                                            {printMonthCols.map(mk => <th key={mk} style={{ textAlign: 'right' }}>{fmtPrintMonth(mk)}</th>)}
                                            {printMonthsSorted.length > MAX_PRINT_COLS && <th style={{ textAlign: 'center', fontSize: '6pt', color: '#94a3b8' }}>+{printMonthsSorted.length - MAX_PRINT_COLS} m.</th>}
                                            <th style={{ textAlign: 'right' }}>Total L</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {printCodeRows.map((row, i) => (
                                            <tr key={row.name} style={{ backgroundColor: i % 2 === 0 ? '#f8fafc' : 'white' }}>
                                                <td style={{ textAlign: 'center', fontWeight: 700, color: '#94a3b8' }}>{i + 1}</td>
                                                <td style={{ fontWeight: 700, color: '#0f172a' }}>{row.name}</td>
                                                {printMonthCols.map(mk => (
                                                    <td key={mk} style={{ textAlign: 'right' }}>
                                                        {row.byMonth[mk] ? row.byMonth[mk].toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}
                                                    </td>
                                                ))}
                                                {printMonthsSorted.length > MAX_PRINT_COLS && <td />}
                                                <td style={{ textAlign: 'right', fontWeight: 900, color: '#0e0c9b' }}>
                                                    {row.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
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
                                                    <div style={{ fontSize: '7pt', color: '#64748b' }}>{(prodInfo as any)?.nombre_producto}</div>
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
                                    <h4 className="text-[9pt] font-black text-slate-800 uppercase mb-2">Glosario y Lógica de Cálculo</h4>
                                    <ul className="space-y-2">
                                        <li className="text-[7.5pt] text-slate-600 leading-tight">• <strong>Volumen Líquidos:</strong> Suma total de litros producidos en familias de productos líquidos terminados.</li>
                                        <li className="text-[7.5pt] text-slate-600 leading-tight">• <strong>Bases / Piezas (Equivalencia):</strong> Las bases se contabilizan por pieza. La equivalencia en litros se calcula con factor de 20L por pieza.</li>
                                        <li className="text-[7.5pt] text-slate-600 leading-tight">• <strong>% Dist. (Distribución):</strong> Porcentaje de aportación de cada SKU o Sucursal sobre el volumen total del periodo.</li>
                                    </ul>
                                </div>
                            </div>

                            {/* ── CONCLUSIONES AUTOMÁTICAS ── */}
                            {opInsights.length > 0 && (
                                <div style={{ marginTop: '30px', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                                    <div style={{ background: 'linear-gradient(to right, #0e0c9b, #2a28b5)', padding: '10px 16px' }}>
                                        <h4 style={{ margin: 0, fontSize: '10pt', fontWeight: 900, color: 'white', letterSpacing: '0.02em' }}>Conclusiones Automáticas del Período</h4>
                                        <p style={{ margin: '2px 0 0 0', fontSize: '7pt', color: 'rgba(255,255,255,0.65)' }}>Generado a partir de los datos del reporte — complementa pero no sustituye el análisis operativo del equipo</p>
                                    </div>
                                    <div style={{ padding: '12px 16px', background: 'white' }}>
                                        {opInsights.map((ins, i) => (
                                            <div key={i} style={{
                                                display: 'flex', gap: '10px', alignItems: 'flex-start',
                                                padding: '7px 10px', marginBottom: i < opInsights.length - 1 ? '6px' : 0,
                                                borderRadius: '8px',
                                                background: ins.level === 'ok' ? '#f0fdf4' : ins.level === 'warn' ? '#fffbeb' : '#eff6ff',
                                                borderLeft: `3px solid ${ins.level === 'ok' ? '#16a34a' : ins.level === 'warn' ? '#d97706' : '#2563eb'}`
                                            }}>
                                                <span style={{ fontSize: '9pt', lineHeight: 1, marginTop: '1px', flexShrink: 0 }}>
                                                    {ins.level === 'ok' ? '✓' : ins.level === 'warn' ? '⚠' : 'ℹ'}
                                                </span>
                                                <p style={{ margin: 0, fontSize: '8pt', color: '#1e293b', lineHeight: '1.5' }}>{ins.text}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                    </PrintReportWrapper>
                )
            })()}
        </>
    )
}

