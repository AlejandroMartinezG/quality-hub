'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
    AlertTriangle,
    Search,
    Filter,
    RefreshCcw,
    Eye,
    Beaker,
    Archive,
    Trash2
} from 'lucide-react'
import { toast } from "sonner"
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useAuth } from '@/components/AuthProvider'
import { DeleteConfirmationDialog } from '@/components/DeleteConfirmationDialog'

interface NCR {
    id: string
    batch_code: string
    sucursal: string
    product_id: string
    family: string
    defect_parameter: string
    status: string
    created_at: string
    preparer_name: string
    liters_involved: number
    liters_recovered: number
    message_count: number
    disposition_type?: string
}

// viewMode logic removed, will rely on profile.role directly
export function NCRManager() {
    const { profile } = useAuth()
    const [ncrs, setNcrs] = useState<NCR[]>([])
    const [loading, setLoading] = useState(true)
    // viewMode is now a prop


    // Delete State
    const [itemToDelete, setItemToDelete] = useState<string | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)

    // Filters
    const [statusFilter, setStatusFilter] = useState<string>('ALL')
    const [searchQuery, setSearchQuery] = useState('')

    // Admin Filters State
    const [sucursalFilter, setSucursalFilter] = useState<string>('ALL')
    const [productFilter, setProductFilter] = useState<string>('ALL')
    const [sucursalOptions, setSucursalOptions] = useState<string[]>([])
    const [productOptions, setProductOptions] = useState<string[]>([])

    // Default view logic moved to parent
    // Fetch filter options if Admin/Quality
    useEffect(() => {
        if (profile?.role === 'admin' || profile?.role === 'gerente_calidad' || profile?.role === 'coordinador') {
            fetchFilterOptions()
        }
    }, [profile])

    useEffect(() => {
        fetchNCRs()

        // Realtime subscription for updates
        const channel = supabase
            .channel('ncr_manager')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'quality_ncr'
            }, () => {
                fetchNCRs()
                fetchStatusCounts()
            })
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [statusFilter, sucursalFilter, productFilter, searchQuery, profile])

    async function fetchFilterOptions() {
        try {
            // Fetch distinct sucursals
            const { data: sucursals, error: sucursalError } = await supabase
                .from('quality_ncr')
                .select('sucursal')
                .order('sucursal')

            if (sucursalError) throw sucursalError

            // Unique values
            if (sucursals) {
                const uniqueSucursals = Array.from(new Set(sucursals.map(item => item.sucursal).filter(Boolean)))
                setSucursalOptions(uniqueSucursals)
            }

            // Fetch distinct products
            const { data: products, error: productError } = await supabase
                .from('quality_ncr')
                .select('product_id')
                .order('product_id')

            if (productError) throw productError

            if (products) {
                const uniqueProducts = Array.from(new Set(products.map(item => item.product_id).filter(Boolean)))
                setProductOptions(uniqueProducts)
            }

        } catch (error) {
            console.error('Error fetching filter options:', error)
        }
    }

    // Status Counts State
    const [statusCounts, setStatusCounts] = useState({
        ALL: 0,
        ABIERTO: 0,
        EN_MRB: 0,
        CERRADO: 0
    })

    useEffect(() => {
        fetchStatusCounts()
    }, [sucursalFilter, productFilter, profile])

    async function fetchStatusCounts() {
        if (!profile) return

        try {
            const baseQuery = supabase.from('quality_ncr').select('status', { count: 'exact', head: true })

            // Apply filters
            if (sucursalFilter !== 'ALL') baseQuery.eq('sucursal', sucursalFilter)
            if (productFilter !== 'ALL') baseQuery.eq('product_id', productFilter)
            if (profile?.role === 'preparador') baseQuery.eq('author_user_id', profile.id)

            // We need to run separate queries or one generic one. 
            // Since we can't easily Group By with the JS client without getting all data,
            // we'll run parallel value counts for simplicity as requested.

            const getCount = async (status: string | null) => {
                let query = supabase.from('quality_ncr').select('*', { count: 'exact', head: true })

                if (status) query = query.eq('status', status)
                if (sucursalFilter !== 'ALL') query = query.eq('sucursal', sucursalFilter)
                if (productFilter !== 'ALL') query = query.eq('product_id', productFilter)
                // Note: Check if we need to filter by preparer. rpc uses p_preparer_id.
                // The table likely has a preparer_id or user_id column. 
                // Looking at rpc call: p_preparer_id. 
                // Looking at NCR interface: preparer_name. 
                // I'll assume standard RLS or explicit filter. 
                // For now, let's respect the ViewMode if possible, but the user is usually Admin for these filters.
                // If ViewMode is MINE, we should technically filter.
                // However, the previous code used an RPC.
                // Let's stick to the visible filters for now to avoid breaking if column names differ.

                const { count, error } = await query
                if (error) throw error
                return count || 0
            }

            const [all, abierto, mrb, cerrado] = await Promise.all([
                getCount(null),
                getCount('ABIERTO'),
                getCount('EN_MRB'),
                getCount('CERRADO')
            ])

            setStatusCounts({
                ALL: all,
                ABIERTO: abierto,
                EN_MRB: mrb,
                CERRADO: cerrado
            })

        } catch (error) {
            console.error('Error fetching status counts:', error)
        }
    }

    async function fetchNCRs() {
        if (!profile) return
        setLoading(true)

        try {
            // Call RPC
            const { data, error } = await supabase.rpc('rpc_ncr_list', {
                p_status: statusFilter === 'ALL' ? null : statusFilter,
                p_sucursal: sucursalFilter === 'ALL' ? null : sucursalFilter,
                p_product: productFilter === 'ALL' ? null : productFilter,
                p_batch: searchQuery || null,
                p_preparer_id: profile.role === 'preparador' ? profile.id : null,
                p_limit: 50,
                p_offset: 0
            })

            if (error) throw error

            let ncrData = data || []

            // Client-side join for disposition
            if (ncrData.length > 0) {
                const ncrIds = ncrData.map((n: any) => n.id)
                const { data: dispositions } = await supabase
                    .from('quality_disposition')
                    .select('ncr_id, disposition_type')
                    .in('ncr_id', ncrIds)

                if (dispositions) {
                    const dispMap = new Map(dispositions.map(d => [d.ncr_id, d.disposition_type]))
                    ncrData = ncrData.map((n: any) => ({
                        ...n,
                        disposition_type: dispMap.get(n.id)
                    }))
                }
            }

            setNcrs(ncrData)
            // Refresh counts when list updates
            fetchStatusCounts()
        } catch (error) {
            console.error('Error fetching NCRs:', error)
        } finally {
            setLoading(false)
        }
    }

    // KPI Calculation
    const totalOpen = ncrs.filter(n => n.status !== 'CERRADO').length

    const promptDelete = (id: string) => {
        setItemToDelete(id)
    }

    const confirmDelete = async () => {
        if (!itemToDelete) return
        setIsDeleting(true)
        const id = itemToDelete

        try {
            console.log("Starting deletion for NCR:", id)
            // 0. Get measurement_id to check if linked to Bitacora
            const { data: ncrData } = await supabase
                .from('quality_ncr')
                .select('measurement_id')
                .eq('id', id)
                .single()

            if (ncrData?.measurement_id) {
                // Case A: Linked to Bitacora -> Delete Bitacora (Cascades to NCR -> Comments/Disp)
                const { error: bitacoraError, count } = await supabase
                    .from('bitacora_produccion_calidad')
                    .delete({ count: 'exact' })
                    .eq('id', ncrData.measurement_id)

                if (bitacoraError) throw bitacoraError

                if (count === 0) {
                    // Parent record missing - Orphaned NCR. Delete NCR manually.
                    const { error: ncrError } = await supabase
                        .from('quality_ncr')
                        .delete()
                        .eq('id', id)
                    if (ncrError) throw ncrError
                }

                toast.success("Registro y NCR eliminados exitosamente")
            } else {
                // Case B: Standalone NCR -> Delete NCR (Cascades to Comments/Disp)
                const { error: ncrError } = await supabase
                    .from('quality_ncr')
                    .delete()
                    .eq('id', id)

                if (ncrError) throw ncrError
                toast.success("NCR eliminado exitosamente")
            }

            fetchNCRs() // Refresh list
        } catch (error: any) {
            console.error('Error deleting NCR:', error)
            toast.error(`Error al eliminar: ${error.message || error.details || "Error desconocido"}`)
        } finally {
            setIsDeleting(false)
            setItemToDelete(null)
        }
    }
    const totalLitersOnHold = ncrs
        .filter(n => n.status !== 'CERRADO')
        .reduce((sum, n) => sum + (n.liters_involved || 0), 0)

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'ABIERTO': return 'bg-red-100 text-red-800 border-red-200'
            case 'EN_MRB': return 'bg-orange-100 text-orange-800 border-orange-200'
            case 'EN_REPROCESO': return 'bg-blue-100 text-blue-800 border-blue-200'
            case 'EN_REINSPECCION': return 'bg-purple-100 text-purple-800 border-purple-200'
            case 'CERRADO': return 'bg-green-100 text-green-800 border-green-200'
            default: return 'bg-slate-100 text-slate-800 border-slate-200'
        }
    }

    return (
        <div className="space-y-6">
            <DeleteConfirmationDialog
                open={!!itemToDelete}
                onOpenChange={(open) => !open && setItemToDelete(null)}
                onConfirm={confirmDelete}
                isDeleting={isDeleting}
            />
            {/* NO TITLE HERE as it will be in the tab */}

            {/* View Mode Toggle moved to parent */}
            <div className="flex flex-col md:flex-row md:items-center justify-end gap-4">
                {/* Toggle rendered by parent */}
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* NCRs Abiertos - Matches 'No Conformes' Red Style */}
                <Card className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-950/20 dark:to-red-900/10 border-[#C1272D]/20 dark:border-[#C1272D]/30">
                    <div className="absolute top-0 right-0 p-6 opacity-10">
                        <AlertTriangle className="w-32 h-32 text-[#C1272D]" />
                    </div>
                    <CardHeader className="pb-4 pt-6 px-6 relative z-10">
                        <CardTitle className="text-lg font-extrabold text-[#C1272D] dark:text-red-400 tracking-wide flex items-center gap-2">
                            <div className="h-2.5 w-2.5 rounded-full bg-[#C1272D] shadow-[0_0_8px_rgba(193,39,45,0.6)]" />
                            NCRs Abiertos
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="relative z-10 px-6 pb-6">
                        <div className="flex flex-col gap-3">
                            <div className="flex items-baseline gap-2">
                                <span className="text-6xl font-extrabold text-[#C1272D] dark:text-red-400 tracking-tight">
                                    {totalOpen}
                                </span>
                                <span className="text-base font-medium text-[#C1272D]/80 dark:text-red-400/80">casos</span>
                            </div>
                            <span className="text-sm font-semibold text-[#C1272D]/70 dark:text-red-300/70">
                                Requieren atención
                            </span>
                        </div>
                    </CardContent>
                </Card>

                {/* Litros en Hold - Matches 'Semi-Conformes' Yellow/Orange Style */}
                <Card className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-950/20 dark:to-orange-900/10 border-orange-200 dark:border-orange-900/30">
                    <div className="absolute top-0 right-0 p-6 opacity-10">
                        <Beaker className="w-32 h-32 text-orange-600" />
                    </div>
                    <CardHeader className="pb-4 pt-6 px-6 relative z-10">
                        <CardTitle className="text-lg font-extrabold text-orange-700 dark:text-orange-400 tracking-wide flex items-center gap-2">
                            <div className="h-2.5 w-2.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]" />
                            Litros en Hold (MRB)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="relative z-10 px-6 pb-6">
                        <div className="flex flex-col gap-3">
                            <div className="flex items-baseline gap-2">
                                <span className="text-6xl font-extrabold text-orange-700 dark:text-orange-400 tracking-tight">
                                    {totalLitersOnHold.toLocaleString()}
                                </span>
                                <span className="text-base font-medium text-orange-600/80 dark:text-orange-400/80">Litros</span>
                            </div>
                            <span className="text-sm font-semibold text-orange-700/70 dark:text-orange-300/70">
                                Volumen detenido
                            </span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Status Tabs with Counts */}
            <div className="w-full">
                <Tabs
                    value={statusFilter}
                    onValueChange={setStatusFilter}
                    className="w-full"
                >
                    <TabsList className="bg-transparent p-0 gap-6 h-auto w-full justify-start overflow-x-auto border-b border-slate-200 dark:border-slate-800 rounded-none pb-px mb-6">
                        <TabsTrigger
                            value="ALL"
                            className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none px-2 py-4 text-slate-500 data-[state=active]:text-blue-600 transition-all hover:text-slate-900 group"
                        >
                            <span className="font-medium text-base mr-2">Todos</span>
                            <Badge variant="secondary" className="bg-slate-100 text-slate-600 group-hover:bg-slate-200 group-data-[state=active]:bg-blue-100 group-data-[state=active]:text-blue-700">
                                {statusCounts.ALL}
                            </Badge>
                        </TabsTrigger>
                        <TabsTrigger
                            value="ABIERTO"
                            className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-red-600 rounded-none px-2 py-4 text-slate-500 data-[state=active]:text-red-600 transition-all hover:text-slate-900 group"
                        >
                            <span className="font-medium text-base mr-2">Abiertos</span>
                            <Badge variant="secondary" className="bg-slate-100 text-slate-600 group-hover:bg-red-50 group-data-[state=active]:bg-red-100 group-data-[state=active]:text-red-700">
                                {statusCounts.ABIERTO}
                            </Badge>
                        </TabsTrigger>
                        <TabsTrigger
                            value="EN_MRB"
                            className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-orange-600 rounded-none px-2 py-4 text-slate-500 data-[state=active]:text-orange-600 transition-all hover:text-slate-900 group"
                        >
                            <span className="font-medium text-base mr-2">En MRB</span>
                            <Badge variant="secondary" className="bg-slate-100 text-slate-600 group-hover:bg-orange-50 group-data-[state=active]:bg-orange-100 group-data-[state=active]:text-orange-700">
                                {statusCounts.EN_MRB}
                            </Badge>
                        </TabsTrigger>
                        <TabsTrigger
                            value="CERRADO"
                            className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-green-600 rounded-none px-2 py-4 text-slate-500 data-[state=active]:text-green-600 transition-all hover:text-slate-900 group"
                        >
                            <span className="font-medium text-base mr-2">Cerrados</span>
                            <Badge variant="secondary" className="bg-slate-100 text-slate-600 group-hover:bg-green-50 group-data-[state=active]:bg-green-100 group-data-[state=active]:text-green-700">
                                {statusCounts.CERRADO}
                            </Badge>
                        </TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            {/* Filters */}
            <Card className="border-primary/5 bg-muted/20 rounded-[2rem]">
                <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="flex flex-col md:flex-row items-center gap-2 w-full md:w-auto flex-wrap">
                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por lote..."
                                className="pl-8"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>



                        {/* Admin Filters: Sucursal & Producto */}
                        {(profile?.role === 'admin' || profile?.role === 'gerente_calidad' || profile?.role === 'coordinador') && (
                            <>
                                <Select value={sucursalFilter} onValueChange={setSucursalFilter}>
                                    <SelectTrigger className="w-full md:w-[180px]">
                                        <div className="flex items-center gap-2 truncate">
                                            <span className="text-muted-foreground">Sucursal:</span>
                                            <span className="truncate">{sucursalFilter === 'ALL' ? 'Todas' : sucursalFilter}</span>
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ALL">Todas las sucursales</SelectItem>
                                        {sucursalOptions.map(option => (
                                            <SelectItem key={option} value={option}>{option}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <Select value={productFilter} onValueChange={setProductFilter}>
                                    <SelectTrigger className="w-full md:w-[220px]">
                                        <div className="flex items-center gap-2 truncate">
                                            <span className="text-muted-foreground">Prod:</span>
                                            <span className="truncate">{productFilter === 'ALL' ? 'Todos' : productFilter}</span>
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ALL">Todos los productos</SelectItem>
                                        {productOptions.map(option => (
                                            <SelectItem key={option} value={option}>{option}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </>
                        )}
                    </div>
                    <Button variant="outline" size="icon" onClick={fetchNCRs} title="Actualizar">
                        <RefreshCcw className="h-4 w-4" />
                    </Button>
                </CardContent>
            </Card>

            {/* Table */}
            <Card className="border-none shadow-lg dark:bg-slate-900 rounded-[2rem] overflow-hidden">
                <CardHeader className="border-b border-slate-200 dark:border-slate-700">
                    <CardTitle className="text-xl font-bold text-slate-900 dark:text-slate-100">Listado de Casos</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-gradient-to-r from-[#0e0c9b] to-[#2a28b5] hover:from-[#0e0c9b] hover:to-[#2a28b5] border-none">
                                    <TableHead className="w-[50px] text-white font-bold text-sm"></TableHead>
                                    <TableHead className="text-white font-bold text-sm">Lote</TableHead>
                                    <TableHead className="text-white font-bold text-sm">Sucursal</TableHead>
                                    <TableHead className="text-white font-bold text-sm">Producto</TableHead>
                                    <TableHead className="text-white font-bold text-sm">Defecto</TableHead>
                                    <TableHead className="text-white font-bold text-sm">Preparador</TableHead>
                                    <TableHead className="text-white font-bold text-sm">Litros Inv.</TableHead>
                                    <TableHead className="text-white font-bold text-sm">Disposición</TableHead>
                                    <TableHead className="text-white font-bold text-sm">Estado</TableHead>
                                    <TableHead className="text-center text-white font-bold text-sm">Check</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={10} className="h-24 text-center">
                                            Cargando datos...
                                        </TableCell>
                                    </TableRow>
                                ) : ncrs.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                                            No se encontraron casos de No Conformidad.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    ncrs.map((ncr) => (
                                        <TableRow key={ncr.id}>
                                            <TableCell>
                                                {profile?.role === 'admin' && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => promptDelete(ncr.id)}
                                                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </TableCell>
                                            <TableCell className="font-medium">{ncr.batch_code}</TableCell>
                                            <TableCell>{ncr.sucursal}</TableCell>
                                            <TableCell className="max-w-[200px] truncate" title={ncr.product_id}>
                                                {ncr.product_id}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="text-xs">
                                                    {ncr.defect_parameter}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm">
                                                {ncr.preparer_name || 'Sin asignar'}
                                            </TableCell>
                                            <TableCell>{ncr.liters_involved?.toLocaleString()} L</TableCell>
                                            <TableCell>
                                                {ncr.disposition_type && ncr.disposition_type !== '-' ? (
                                                    <Badge variant="secondary" className="font-normal border-slate-200 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                                        {ncr.disposition_type.replace(/_/g, ' ')}
                                                    </Badge>
                                                ) : (
                                                    <span className="text-muted-foreground text-xs block text-center">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={`${getStatusColor(ncr.status)} border px-2 py-0.5 pointer-events-none`}>
                                                    {ncr.status.replace('_', ' ')}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <div className="relative flex items-center justify-center gap-2">
                                                    <Link href={`/calidad/ncr/${ncr.id}`}>
                                                        <Button variant="ghost" size="icon">
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                    </Link>
                                                    {ncr.message_count > 0 && (
                                                        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                                                            {ncr.message_count}
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
