"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/components/AuthProvider"
import { Breadcrumbs } from "@/components/Breadcrumbs"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { supabase } from "@/lib/supabase"
import {
    Search,
    Filter,
    CheckCircle2,
    AlertCircle,
    XCircle,
    Loader2,
    Calendar,
    ArrowUpDown,
    Trash2,
    Edit2,
    RotateCcw,
    X,
    ClipboardList,
    Package,
    AlertTriangle
} from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog"
import { Label as UILabel } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import {
    PRODUCT_STANDARDS,
    PH_STANDARDS,
    APPEARANCE_STANDARDS,
    SUCURSALES
} from "@/lib/production-constants"
import { cn } from "@/lib/utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSearchParams } from "next/navigation"
import { NCRManager } from "@/app/calidad/components/NCRManager"

interface BitacoraRecord {
    id: number
    created_at: string
    lote_producto: string
    codigo_producto: string
    sucursal: string
    fecha_fabricacion: string
    ph: number | null
    solidos_medicion_1: number | null
    solidos_medicion_2: number | null
    apariencia: string
    color: string
    aroma: string
    nombre_preparador: string
}

export default function CalidadPage() {
    const { user, profile } = useAuth()
    const searchParams = useSearchParams()
    const defaultTab = searchParams.get('tab') === 'history' ? 'history' : 'ncr'
    const [records, setRecords] = useState<BitacoraRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")
    const [sucursalFilter, setSucursalFilter] = useState("all")
    const [statusFilter, setStatusFilter] = useState("all")
    const [timeRangeFilter, setTimeRangeFilter] = useState("all")
    const [editingRecord, setEditingRecord] = useState<BitacoraRecord | null>(null)
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
    const [isUpdating, setIsUpdating] = useState(false)

    // NCR State
    const [isNcrDialogOpen, setIsNcrDialogOpen] = useState(false)
    const [ncrRecord, setNcrRecord] = useState<BitacoraRecord | null>(null)
    const [ncrParam, setNcrParam] = useState('')
    const [ncrSeverity, setNcrSeverity] = useState('')
    const [ncrDetail, setNcrDetail] = useState('')
    const [ncrLiters, setNcrLiters] = useState('')
    const [isCreatingNcr, setIsCreatingNcr] = useState(false)

    // Lifted State for NCR View Mode & Tabs
    const [activeTab, setActiveTab] = useState(defaultTab)

    useEffect(() => {
        if (user) {
            fetchRecords()
        }
    }, [user?.id, profile?.is_admin, profile?.role])

    const fetchRecords = async () => {
        if (!user) return
        try {
            setLoading(true)

            let query = supabase
                .from('bitacora_produccion_calidad')
                .select('*')

            // Filter by user if role is preparador
            const role = profile?.role?.toLowerCase()
            if (role === 'preparador') {
                query = query.eq('user_id', user.id)
            } else if ((role === 'gerente_sucursal' || role === 'gerente') && profile?.sucursal) {
                // Filter by sucursal if role is branch manager
                query = query.eq('sucursal', profile.sucursal)
            }

            const { data, error } = await query
                .order('created_at', { ascending: false })
                .limit(100)

            if (error) throw error

            setRecords(data || [])
        } catch (error: any) {
            toast.error("Error al cargar los registros. Intenta de nuevo.")
        } finally {
            setLoading(false)
        }
    }

    const performDelete = async (id: number) => {
        try {
            // DB constraints now handle cascade delete for NCRs -> Comments/Disposition
            const { error } = await supabase
                .from('bitacora_produccion_calidad')
                .delete()
                .eq('id', id)

            if (error) throw error

            toast.success("Registro eliminado permanentemente")
            fetchRecords()
        } catch (error: any) {
            console.error("Delete error:", error)
            toast.error("Error al eliminar el registro. Intenta de nuevo.")
        }
    }

    const requestDelete = (id: number, lote: string) => {
        toast("¿Estás seguro?", {
            description: `Se eliminará el lote ${lote} de forma permanente.`,
            action: {
                label: "Confirmar",
                onClick: () => performDelete(id),
            },
            cancel: {
                label: "Cancelar",
                onClick: () => { },
            },
            duration: 5000,
        })
    }

    const handleEditSave = async () => {
        if (!editingRecord) return
        try {
            setIsUpdating(true)

            const { error } = await supabase
                .from('bitacora_produccion_calidad')
                .update({
                    ph: editingRecord.ph,
                    solidos_medicion_1: editingRecord.solidos_medicion_1,
                    solidos_medicion_2: editingRecord.solidos_medicion_2,
                    apariencia: editingRecord.apariencia,
                    color: editingRecord.color,
                    aroma: editingRecord.aroma
                })
                .eq('id', editingRecord.id)

            if (error) throw error

            toast.success("Registro actualizado")
            setIsEditDialogOpen(false)
            fetchRecords()
        } catch (error: any) {
            toast.error("Error al actualizar el registro. Intenta de nuevo.")
        } finally {
            setIsUpdating(false)
        }
    }

    const handleCreateNCR = async () => {
        if (!ncrRecord || !ncrParam || !ncrSeverity || !profile) {
            toast.error('Por favor complete todos los campos obligatorios')
            return
        }

        setIsCreatingNcr(true)
        try {
            // 1. Create NCR
            const { data: ncrData, error: ncrError } = await supabase
                .from('quality_ncr')
                .insert({
                    measurement_id: ncrRecord.id,
                    batch_code: ncrRecord.lote_producto,
                    sucursal: ncrRecord.sucursal,
                    product_id: ncrRecord.codigo_producto,
                    preparer_user_id: null, // To be assigned later or if we link preparer user but we dont have that link yet
                    preparer_name: ncrRecord.nombre_preparador, // Store name at least
                    defect_parameter: ncrParam,
                    severity: ncrSeverity,
                    defect_detail: ncrDetail,
                    liters_involved: parseFloat(ncrLiters) || 0,
                    status: 'ABIERTO',
                    author_user_id: profile.id
                })
                .select()
                .single()

            if (ncrError) throw ncrError

            toast.success('Reporte NCR creado exitosamente')
            setIsNcrDialogOpen(false)

            // Optional: Redirect to NCR detail
            // router.push(`/calidad/ncr/${ncrData.id}`)
        } catch (error) {
            console.error('Error creating NCR:', error)
            toast.error('Error al crear el reporte NCR')
        } finally {
            setIsCreatingNcr(false)
        }
    }

    const getStatusInfo = (record: BitacoraRecord) => {
        let status: 'success' | 'warning' | 'error' = 'success'

        // ========== CONTROL CHART LOGIC FOR SÓLIDOS ==========
        // Red lines (specification limits): min and max from PRODUCT_STANDARDS
        // Yellow lines (tolerance limits): min*0.95 and max*1.05 (5% relative error)
        const standardSolids = PRODUCT_STANDARDS[record.codigo_producto]
        if (standardSolids && record.solidos_medicion_1 !== null && record.solidos_medicion_2 !== null) {
            const avg = (record.solidos_medicion_1 + record.solidos_medicion_2) / 2
            const specMin = standardSolids.min || 0  // Red line (lower)
            const specMax = standardSolids.max || 0  // Red line (upper)
            const warnMin = specMin * 0.95           // Yellow line (lower) - 5% tolerance
            const warnMax = specMax * 1.05           // Yellow line (upper) - 5% tolerance

            if (avg >= specMin && avg <= specMax) {
                // Between red lines = CONFORME (success)
                status = 'success'
            } else if ((avg >= warnMin && avg < specMin) || (avg > specMax && avg <= warnMax)) {
                // Between red and yellow lines = SEMI-CONFORME (warning)
                status = 'warning'
            } else {
                // Outside yellow lines = NO CONFORME (error)
                status = 'error'
            }
        } else if (!standardSolids) {
            // If no standard exists, we can't judge conformity based on solids
            // Defaulting to success to avoid red errors on everything
            status = 'success'
        }

        return status
    }


    const filteredRecords = records.filter(r => {
        const matchesSearch =
            r.lote_producto?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.codigo_producto?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.sucursal?.toLowerCase().includes(searchTerm.toLowerCase())

        const matchesSucursal = sucursalFilter === "all" || r.sucursal === sucursalFilter
        const matchesStatus = statusFilter === "all" || getStatusInfo(r) === statusFilter

        // Time range filter - using fecha_fabricacion for production date
        let matchesTimeRange = true
        if (timeRangeFilter !== "all") {
            // Use fecha_fabricacion if available, otherwise fall back to created_at
            const dateToUse = r.fecha_fabricacion || r.created_at
            if (dateToUse) {
                const recordDate = new Date(dateToUse)
                const now = new Date()
                const daysAgo = parseInt(timeRangeFilter)
                const cutoffDate = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000))

                // Set cutoff to start of day for better comparison
                cutoffDate.setHours(0, 0, 0, 0)

                matchesTimeRange = recordDate >= cutoffDate
            }
        }

        return matchesSearch && matchesSucursal && matchesStatus && matchesTimeRange
    })

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-12">
            <Breadcrumbs items={[{ label: "Control de Calidad" }]} />

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
                    Control de Calidad
                </h1>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-end gap-4">
                    <TabsList className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                        <TabsTrigger value="ncr" className="rounded-lg px-4 py-2">Gestión de NCRs</TabsTrigger>
                        <TabsTrigger value="history" className="rounded-lg px-4 py-2">Historial de Mediciones</TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="history" className="space-y-6">
                    <div className="flex flex-col gap-6">
                        <div className="flex justify-end">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={fetchRecords}
                                className="gap-2"
                                disabled={loading}
                            >
                                <RotateCcw className={cn("h-4 w-4", loading && "animate-spin")} />
                                Actualizar
                            </Button>
                        </div>

                        {/* Filtros */}
                        <Card className="border-primary/5 bg-muted/20 rounded-[2rem]">
                            <CardContent className="p-4 flex flex-col md:flex-row gap-4">
                                <div className="flex-1 relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Buscar por lote o producto..."
                                        className="pl-10 h-10"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>

                                <div className="w-full md:w-52">
                                    <Select value={timeRangeFilter} onValueChange={setTimeRangeFilter}>
                                        <SelectTrigger className="h-10">
                                            <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
                                            <SelectValue placeholder="Período" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Todo el historial</SelectItem>
                                            <SelectItem value="7">Últimos 7 días</SelectItem>
                                            <SelectItem value="30">Últimos 30 días</SelectItem>
                                            <SelectItem value="90">Últimos 90 días</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {profile?.is_admin && (
                                    <div className="w-full md:w-56">
                                        <Select value={sucursalFilter} onValueChange={setSucursalFilter}>
                                            <SelectTrigger className="h-10">
                                                <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
                                                <SelectValue placeholder="Sucursal" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Todas las sucursales</SelectItem>
                                                {SUCURSALES.map((suc) => (
                                                    <SelectItem key={suc} value={suc}>{suc}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                <div className="w-full md:w-48">
                                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                                        <SelectTrigger className="h-10">
                                            <SelectValue placeholder="Estado" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Todos los estados</SelectItem>
                                            <SelectItem value="success">Conforme</SelectItem>
                                            <SelectItem value="warning">Semi-Conforme</SelectItem>
                                            <SelectItem value="error">No Conforme</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {/* 1. Total Analizado */}
                        <Card className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/20 dark:to-blue-900/10 border-blue-200 dark:border-blue-900/30">
                            <div className="absolute top-0 right-0 p-6 opacity-10">
                                <ClipboardList className="w-32 h-32 text-blue-600" />
                            </div>
                            <CardHeader className="pb-3 relative z-10">
                                <CardTitle className="text-base font-bold text-blue-700 dark:text-blue-400 uppercase tracking-widest flex items-center gap-2">
                                    <div className="h-2.5 w-2.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                                    Total
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="relative z-10">
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-6xl font-extrabold text-blue-700 dark:text-blue-400 tracking-tight">
                                            {filteredRecords.length}
                                        </span>
                                        <span className="text-base font-medium text-blue-600/80 dark:text-blue-400/80">muestras</span>
                                    </div>
                                    <span className="text-sm font-semibold text-blue-700/70 dark:text-blue-300/70">
                                        Total filtrado
                                    </span>
                                </div>
                            </CardContent>
                        </Card>

                        {/* 2. Lotes Conformes */}
                        <Card className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/20 dark:to-green-900/10 border-green-200 dark:border-green-900/30">
                            <div className="absolute top-0 right-0 p-6 opacity-10">
                                <CheckCircle2 className="w-32 h-32 text-green-600" />
                            </div>
                            <CardHeader className="pb-4 pt-6 px-6 relative z-10">
                                <CardTitle className="text-lg font-extrabold text-green-700 dark:text-green-400 tracking-wide flex items-center gap-2">
                                    <div className="h-2.5 w-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                                    Total Conformes
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="relative z-10 px-6 pb-6">
                                <div className="flex flex-col gap-3">
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-6xl font-extrabold text-green-700 dark:text-green-400 tracking-tight">
                                            {filteredRecords.filter(r => getStatusInfo(r) === 'success').length}
                                        </span>
                                        <span className="text-base font-medium text-green-600/80 dark:text-green-400/80">registros</span>
                                    </div>
                                    <div className="flex items-baseline gap-1.5">
                                        <span className="text-2xl font-bold text-green-700 dark:text-green-400">
                                            {filteredRecords.length > 0
                                                ? ((filteredRecords.filter(r => getStatusInfo(r) === 'success').length / filteredRecords.length) * 100).toFixed(1)
                                                : "0.0"}%
                                        </span>
                                        <span className="text-sm font-semibold text-green-700/70 dark:text-green-300/70">del total</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-yellow-50 to-yellow-100/50 dark:from-yellow-950/20 dark:to-yellow-900/10 border-yellow-200 dark:border-yellow-900/30">
                            <div className="absolute top-0 right-0 p-6 opacity-10">
                                <AlertCircle className="w-32 h-32 text-yellow-600" />
                            </div>
                            <CardHeader className="pb-4 pt-6 px-6 relative z-10">
                                <CardTitle className="text-lg font-extrabold text-yellow-700 dark:text-yellow-400 tracking-wide flex items-center gap-2">
                                    <div className="h-2.5 w-2.5 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)]" />
                                    Semi-Conformes
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="relative z-10 px-6 pb-6">
                                <div className="flex flex-col gap-3">
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-6xl font-extrabold text-yellow-700 dark:text-yellow-400 tracking-tight">
                                            {filteredRecords.filter(r => getStatusInfo(r) === 'warning').length}
                                        </span>
                                        <span className="text-base font-medium text-yellow-600/80 dark:text-yellow-400/80">registros</span>
                                    </div>
                                    <div className="flex items-baseline gap-1.5">
                                        <span className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">
                                            {filteredRecords.length > 0
                                                ? ((filteredRecords.filter(r => getStatusInfo(r) === 'warning').length / filteredRecords.length) * 100).toFixed(1)
                                                : "0.0"}%
                                        </span>
                                        <span className="text-sm font-semibold text-yellow-700/70 dark:text-yellow-300/70">del total</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-950/20 dark:to-red-900/10 border-[#C1272D]/20 dark:border-[#C1272D]/30">
                            <div className="absolute top-0 right-0 p-6 opacity-10">
                                <XCircle className="w-32 h-32 text-[#C1272D]" />
                            </div>
                            <CardHeader className="pb-4 pt-6 px-6 relative z-10">
                                <CardTitle className="text-lg font-extrabold text-[#C1272D] dark:text-red-400 tracking-wide flex items-center gap-2">
                                    <div className="h-2.5 w-2.5 rounded-full bg-[#C1272D] shadow-[0_0_8px_rgba(193,39,45,0.6)]" />
                                    No Conformes
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="relative z-10 px-6 pb-6">
                                <div className="flex flex-col gap-3">
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-6xl font-extrabold text-[#C1272D] dark:text-red-400 tracking-tight">
                                            {filteredRecords.filter(r => getStatusInfo(r) === 'error').length}
                                        </span>
                                        <span className="text-base font-medium text-[#C1272D]/80 dark:text-red-400/80">registros</span>
                                    </div>
                                    <div className="flex items-baseline gap-1.5">
                                        <span className="text-2xl font-bold text-[#C1272D] dark:text-red-400">
                                            {filteredRecords.length > 0
                                                ? ((filteredRecords.filter(r => getStatusInfo(r) === 'error').length / filteredRecords.length) * 100).toFixed(1)
                                                : "0.0"}%
                                        </span>
                                        <span className="text-sm font-semibold text-[#C1272D]/70 dark:text-red-300/70">del total</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="border-none shadow-lg dark:bg-slate-900 rounded-[2rem] overflow-hidden">
                        <CardHeader className="border-none">
                            <CardTitle className="text-xl font-bold text-slate-900 dark:text-slate-100">Historial de Mediciones</CardTitle>
                            <CardDescription className="text-slate-600 dark:text-slate-400">Últimos 50 registros comparados con límites de control.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                    <p className="text-muted-foreground">Cargando registros de calidad...</p>
                                </div>
                            ) : (
                                <>
                                    {/* Desktop Table View */}
                                    <div className="hidden md:block rounded-2xl overflow-hidden border-none shadow-sm">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-gradient-to-r from-[#0e0c9b] to-[#2a28b5] hover:from-[#0e0c9b] hover:to-[#2a28b5] border-none h-12">
                                                    <TableHead className="w-[150px] text-white font-bold text-sm rounded-l-2xl pl-6">Lote</TableHead>
                                                    <TableHead className="text-white font-bold text-sm">Producto/Sucursal</TableHead>
                                                    <TableHead className="text-center text-white font-bold text-sm">pH</TableHead>
                                                    <TableHead className="text-center text-white font-bold text-sm">% Sólidos (Avg)</TableHead>
                                                    <TableHead className="text-white font-bold text-sm">Estado</TableHead>
                                                    <TableHead className="text-center text-white font-bold text-sm">Apariencia</TableHead>
                                                    {profile?.is_admin ? (
                                                        <>
                                                            <TableHead className="text-right text-white font-bold text-sm">Fecha</TableHead>
                                                            <TableHead className="text-white font-bold text-sm">Preparador</TableHead>
                                                            <TableHead className="text-right text-white font-bold text-sm rounded-r-2xl pr-6">Acciones</TableHead>
                                                        </>
                                                    ) : (
                                                        <TableHead className="text-right text-white font-bold text-sm rounded-r-2xl pr-6">Fecha</TableHead>
                                                    )}
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {filteredRecords.length > 0 ? (
                                                    filteredRecords.map((record) => {
                                                        const status = getStatusInfo(record)
                                                        const avgSolids = (record.solidos_medicion_1 !== null && record.solidos_medicion_2 !== null)
                                                            ? (record.solidos_medicion_1 + record.solidos_medicion_2) / 2
                                                            : null

                                                        const stdSolids = PRODUCT_STANDARDS[record.codigo_producto]
                                                        const stdPH = PH_STANDARDS[record.codigo_producto]
                                                        const stdApp = APPEARANCE_STANDARDS[record.codigo_producto]

                                                        return (
                                                            <TableRow key={record.id} className="hover:bg-muted/30 transition-colors">
                                                                <TableCell className="font-mono font-bold text-sm text-slate-700 dark:text-slate-200">
                                                                    {record.lote_producto}
                                                                </TableCell>
                                                                <TableCell>
                                                                    <div className="flex flex-col">
                                                                        <span className="font-bold text-base text-slate-800 dark:text-slate-100">{record.codigo_producto}</span>
                                                                        <span className="text-xs text-muted-foreground dark:text-slate-400 uppercase tracking-wide">{record.sucursal}</span>
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="text-center">
                                                                    <div className="flex flex-col items-center">
                                                                        <span className={record.ph !== null ? "font-bold text-sm dark:text-slate-200" : "text-muted-foreground text-xs"}>
                                                                            {record.ph ?? "N/A"}
                                                                        </span>
                                                                        {stdPH && (
                                                                            <span className="text-[10px] text-muted-foreground dark:text-slate-400">
                                                                                Ref: {stdPH.min}-{stdPH.max}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="text-center">
                                                                    <div className="flex flex-col items-center">
                                                                        <span className={avgSolids !== null ? "font-bold text-base dark:text-slate-100" : "text-muted-foreground text-xs"}>
                                                                            {avgSolids !== null ? avgSolids.toFixed(2) + "%" : "N/A"}
                                                                        </span>
                                                                        {stdSolids && (
                                                                            <div className="flex flex-col items-center gap-0.5 mt-1">
                                                                                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                                                                    Std: {stdSolids.min}-{stdSolids.max}
                                                                                </span>
                                                                                <span className="text-[10px] text-muted-foreground/80 dark:text-slate-400">
                                                                                    Tol: {(stdSolids.min! * 0.95).toFixed(2)}-{(stdSolids.max! * 1.05).toFixed(2)}
                                                                                </span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Badge
                                                                        className={cn(
                                                                            "gap-1.5 shadow-sm px-3 py-1 text-xs font-semibold uppercase tracking-wider rounded-full border-none",
                                                                            status === 'success' && "bg-green-600 text-white hover:bg-green-700",
                                                                            status === 'warning' && "bg-yellow-500 text-white hover:bg-yellow-600",
                                                                            status === 'error' && "bg-[#C1272D] text-white hover:bg-[#A01F25]"
                                                                        )}
                                                                    >
                                                                        {status === 'success' && <CheckCircle2 className="h-3 w-3" />}
                                                                        {status === 'warning' && <AlertCircle className="h-3 w-3" />}
                                                                        {status === 'error' && <XCircle className="h-3 w-3" />}
                                                                        {status === 'success' ? 'CONFORME' : status === 'warning' ? 'SEMI-CONFORME' : 'NO CONFORME'}
                                                                    </Badge>
                                                                </TableCell>
                                                                <TableCell className="text-center">
                                                                    <div className="flex flex-col items-center">
                                                                        <span className="text-sm font-semibold dark:text-slate-200">{record.apariencia || "N/A"}</span>
                                                                        {stdApp && (
                                                                            <span className="text-[10px] text-muted-foreground dark:text-slate-400">
                                                                                Esp: {stdApp}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="text-right text-sm text-muted-foreground dark:text-slate-400">
                                                                    {new Date(record.fecha_fabricacion).toLocaleDateString()}
                                                                </TableCell>
                                                                {profile?.is_admin && (
                                                                    <TableCell className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                                                        {record.nombre_preparador || "N/A"}
                                                                    </TableCell>
                                                                )}
                                                                {profile?.is_admin && (
                                                                    <TableCell className="text-right">
                                                                        <div className="flex justify-end gap-2">
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 cursor-pointer pointer-events-auto"
                                                                                title="Editar registro"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation()
                                                                                    setEditingRecord(record)
                                                                                    setIsEditDialogOpen(true)
                                                                                }}
                                                                            >
                                                                                <Edit2 className="h-4 w-4" />
                                                                            </Button>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50 cursor-pointer pointer-events-auto"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation()
                                                                                    requestDelete(record.id, record.lote_producto)
                                                                                }}
                                                                                title="Eliminar registro"
                                                                            >
                                                                                <Trash2 className="h-4 w-4" />
                                                                            </Button>
                                                                        </div>
                                                                    </TableCell>
                                                                )}
                                                            </TableRow>
                                                        )
                                                    })
                                                ) : (
                                                    <TableRow>
                                                        <TableCell colSpan={profile?.is_admin ? 9 : 8} className="h-24 text-center text-muted-foreground">
                                                            No se encontraron registros.
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>

                                    {/* Mobile Card View */}
                                    <div className="md:hidden space-y-4">
                                        {filteredRecords.length > 0 ? (
                                            filteredRecords.map((record) => {
                                                const status = getStatusInfo(record)
                                                const avgSolids = (record.solidos_medicion_1 !== null && record.solidos_medicion_2 !== null)
                                                    ? (record.solidos_medicion_1 + record.solidos_medicion_2) / 2
                                                    : null

                                                const stdSolids = PRODUCT_STANDARDS[record.codigo_producto]
                                                const stdPH = PH_STANDARDS[record.codigo_producto]

                                                return (
                                                    <div key={record.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                                                        <div className="p-4 space-y-4">
                                                            <div className="flex items-start justify-between">
                                                                <div className="space-y-1">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">Lote</span>
                                                                        <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{record.lote_producto}</span>
                                                                    </div>
                                                                    <div className="flex flex-col">
                                                                        <span className="font-bold text-base leading-tight text-slate-800 dark:text-slate-100">{record.codigo_producto}</span>
                                                                        <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{record.sucursal} • {new Date(record.fecha_fabricacion).toLocaleDateString()}</span>
                                                                    </div>
                                                                </div>
                                                                <div className="flex flex-col items-end gap-2">
                                                                    <Badge
                                                                        className={cn(
                                                                            "px-2 py-0.5 text-[10px] font-bold rounded-full border-none",
                                                                            status === 'success' && "bg-green-600 text-white",
                                                                            status === 'warning' && "bg-yellow-500 text-white",
                                                                            status === 'error' && "bg-[#C1272D] text-white"
                                                                        )}
                                                                    >
                                                                        {status === 'success' ? 'CONFORME' : status === 'warning' ? 'SEMI' : 'NO CONF.'}
                                                                    </Badge>
                                                                    {profile?.is_admin && (
                                                                        <div className="flex gap-1 mt-1">
                                                                            <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={() => { setEditingRecord(record); setIsEditDialogOpen(true); }}>
                                                                                <Edit2 className="h-3.5 w-3.5 text-blue-600" />
                                                                            </Button>
                                                                            <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={() => requestDelete(record.id, record.lote_producto)}>
                                                                                <Trash2 className="h-3.5 w-3.5 text-red-600" />
                                                                            </Button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-50 dark:border-slate-800">
                                                                <div className="bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl flex flex-col items-center">
                                                                    <span className="text-[9px] font-bold text-slate-400 uppercase mb-1">pH</span>
                                                                    <span className="font-bold text-sm">{record.ph ?? "N/A"}</span>
                                                                    {stdPH && <span className="text-[8px] text-muted-foreground">Ref: {stdPH.min}-{stdPH.max}</span>}
                                                                </div>
                                                                <div className="bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl flex flex-col items-center">
                                                                    <span className="text-[9px] font-bold text-slate-400 uppercase mb-1">% Sólidos</span>
                                                                    <span className="font-bold text-sm">{avgSolids !== null ? avgSolids.toFixed(2) + "%" : "N/A"}</span>
                                                                    {stdSolids && <span className="text-[8px] text-muted-foreground text-center">Std: {stdSolids.min}-{stdSolids.max}</span>}
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center justify-between text-[11px] pt-1">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-bold text-slate-400 uppercase text-[9px]">Apariencia:</span>
                                                                    <span className="font-medium text-slate-700 dark:text-slate-300">{record.apariencia || "N/A"}</span>
                                                                </div>
                                                                {profile?.is_admin && (
                                                                    <div className="flex items-center gap-1">
                                                                        <span className="font-bold text-slate-400 uppercase text-[9px]">Prep:</span>
                                                                        <span className="font-medium text-slate-700 dark:text-slate-300">{record.nombre_preparador?.split(' ')[0] || "N/A"}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            })
                                        ) : (
                                            <div className="p-8 text-center text-muted-foreground bg-slate-50 dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                                                No se encontraron registros.
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="ncr">
                    <NCRManager />
                </TabsContent>
            </Tabs>

            {/* Modal de Edición */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="sm:max-w-[425px] sm:rounded-[2rem]">
                    <DialogHeader>
                        <DialogTitle>Editar Registro de Calidad</DialogTitle>
                        <DialogDescription>
                            Modifica los parámetros físico-químicos del lote {editingRecord?.lote_producto}.
                        </DialogDescription>
                    </DialogHeader>
                    {editingRecord && (
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <UILabel htmlFor="ph" className="text-right text-xs">pH</UILabel>
                                <Input
                                    id="ph"
                                    type="number"
                                    step="0.1"
                                    value={editingRecord.ph || ""}
                                    onChange={(e) => setEditingRecord({ ...editingRecord, ph: parseFloat(e.target.value) || null })}
                                    className="col-span-3"
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <UILabel htmlFor="s1" className="text-right text-xs">Sólidos M1</UILabel>
                                <Input
                                    id="s1"
                                    type="number"
                                    step="0.01"
                                    value={editingRecord.solidos_medicion_1 || ""}
                                    onChange={(e) => setEditingRecord({ ...editingRecord, solidos_medicion_1: parseFloat(e.target.value) || null })}
                                    className="col-span-3"
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <UILabel htmlFor="s2" className="text-right text-xs">Sólidos M2</UILabel>
                                <Input
                                    id="s2"
                                    type="number"
                                    step="0.01"
                                    value={editingRecord.solidos_medicion_2 || ""}
                                    onChange={(e) => setEditingRecord({ ...editingRecord, solidos_medicion_2: parseFloat(e.target.value) || null })}
                                    className="col-span-3"
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <UILabel htmlFor="apariencia" className="text-right text-xs">Apariencia</UILabel>
                                <Input
                                    id="apariencia"
                                    value={editingRecord.apariencia || ""}
                                    onChange={(e) => setEditingRecord({ ...editingRecord, apariencia: e.target.value })}
                                    className="col-span-3"
                                />
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button type="submit" onClick={handleEditSave} disabled={isUpdating}>
                            {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Guardar Cambios
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>


            {/* Dialogo CREAR NCR */}
            <Dialog open={isNcrDialogOpen} onOpenChange={setIsNcrDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                            <AlertTriangle className="h-5 w-5" />
                            Crear Reporte de No Conformidad (NCR)
                        </DialogTitle>
                        <DialogDescription>
                            Registrar incidente de calidad para el lote <strong>{ncrRecord?.lote_producto}</strong>.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <UILabel className="text-right">Parámetro</UILabel>
                            <Select onValueChange={setNcrParam} value={ncrParam}>
                                <SelectTrigger className="col-span-3">
                                    <SelectValue placeholder="Seleccionar defecto" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="PH">pH Fuera de Rango</SelectItem>
                                    <SelectItem value="SOLIDOS">Sólidos Fuera de Rango</SelectItem>
                                    <SelectItem value="APARIENCIA">Apariencia / Color Incorrecto</SelectItem>
                                    <SelectItem value="AROMA">Aroma Incorrecto</SelectItem>
                                    <SelectItem value="OTRO">Otro</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <UILabel className="text-right">Gravedad</UILabel>
                            <Select onValueChange={setNcrSeverity} value={ncrSeverity}>
                                <SelectTrigger className="col-span-3">
                                    <SelectValue placeholder="Nivel de severidad" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="CRITICA">Crítica (Detiene Producción)</SelectItem>
                                    <SelectItem value="MAYOR">Mayor (Requiere Reproceso)</SelectItem>
                                    <SelectItem value="MENOR">Menor (Aceptable con Desviación)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-4 items-start gap-4">
                            <UILabel className="text-right mt-2">Detalle</UILabel>
                            <textarea
                                className="col-span-3 flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                placeholder="Describa el problema detalladamente..."
                                value={ncrDetail}
                                onChange={(e) => setNcrDetail(e.target.value)}
                            />
                        </div>
                        <div className="grid grid-cols-4 items-start gap-4">
                            <UILabel className="text-right mt-2">Litros</UILabel>
                            <Input
                                type="number"
                                placeholder="Volumen afectado"
                                className="col-span-3"
                                value={ncrLiters}
                                onChange={(e) => setNcrLiters(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsNcrDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleCreateNCR} disabled={isCreatingNcr} className="bg-red-600 hover:bg-red-700 text-white">
                            {isCreatingNcr ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Crear Reporte
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
