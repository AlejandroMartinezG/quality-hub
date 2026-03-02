'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
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
import { SUCURSAL_ACRONYMS } from "@/lib/production-constants"
import {
    AlertTriangle,
    Search,
    Filter,
    RefreshCcw,
    Eye,
    Beaker,
    Archive,
    Trash2,
    XCircle,
    CheckCircle2,
    Zap
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
    defect_detail?: string
    apariencia_reportada?: string
    last_message_author_id?: string
}

// viewMode logic removed, will rely on profile.role directly
export function NCRManager() {
    const { profile } = useAuth()
    const [ncrs, setNcrs] = useState<NCR[]>([])
    const ncrsRef = useRef<NCR[]>([])

    // Sync ref with state
    useEffect(() => {
        ncrsRef.current = ncrs
    }, [ncrs])

    const profileRef = useRef(profile)
    useEffect(() => {
        profileRef.current = profile
    }, [profile])

    const [loading, setLoading] = useState(true)
    // viewMode is now a prop


    // Delete State
    const [itemToDelete, setItemToDelete] = useState<string | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)

    // Filters
    const [statusFilter, setStatusFilter] = useState<string>('ALL')
    const [searchQuery, setSearchQuery] = useState('')
    const [dispositionFilter, setDispositionFilter] = useState<string>('ALL')

    // Admin Filters State
    const [sucursalFilter, setSucursalFilter] = useState<string>('ALL')
    const [productFilter, setProductFilter] = useState<string>('ALL')
    const [sucursalOptions, setSucursalOptions] = useState<string[]>([])
    const [productOptions, setProductOptions] = useState<string[]>([])

    // Default view logic moved to parent
    // Fetch filter options if Admin/Quality
    useEffect(() => {
        // Handle both role (new) and rol (legacy) for compatibility
        const profileAny = profile as any;
        const userRole = (profileAny?.role || profileAny?.rol || '').toLowerCase();
        const isGlobalRole = ['admin', 'gerente_calidad', 'coordinador', 'director_operaciones'].includes(userRole);

        if (isGlobalRole) {
            fetchFilterOptions()
        }

        // Lock sucursal if branch manager AND has a sucursal assigned
        const isManager = ['gerente_sucursal', 'gerente', 'sucursal'].includes(userRole);
        if (isManager && profileAny?.sucursal && profileAny.sucursal.trim() !== '') {
            setSucursalFilter(profileAny.sucursal.trim())
        } else if (isManager) {
            setSucursalFilter('ALL')
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
            }, (payload) => {
                const event = payload.eventType;
                const newNcr = payload.new as any;
                const oldNcr = payload.old as any;

                const role = profileRef.current?.role?.toLowerCase() || '';
                const isGlobalRole = ['admin', 'administrador', 'coordinador', 'gerente_calidad', 'director_operaciones'].includes(role);
                const isMySucursal =
                    newNcr?.sucursal?.toLowerCase() === profileRef.current?.sucursal?.toLowerCase() ||
                    SUCURSAL_ACRONYMS[profileRef.current?.sucursal || ''] === newNcr?.sucursal;

                const shouldNotify = isGlobalRole || isMySucursal;

                if (shouldNotify && event === 'INSERT') {
                    toast.info(`🚨 Nuevo NCR: ${newNcr.batch_code}`, {
                        description: `Se ha reportado un problema en ${newNcr.sucursal}: ${newNcr.defect_parameter}`,
                        action: {
                            label: 'Ver',
                            onClick: () => window.location.href = `/calidad/ncr/${newNcr.id}`
                        }
                    });
                } else if (shouldNotify && event === 'UPDATE' && oldNcr && oldNcr.status !== newNcr.status) {
                    toast.success(`🔄 Estado Actualizado: ${newNcr.batch_code}`, {
                        description: `El estado ha cambiado de ${oldNcr.status} a ${newNcr.status}`,
                        action: {
                            label: 'Ver',
                            onClick: () => window.location.href = `/calidad/ncr/${newNcr.id}`
                        }
                    });
                }

                fetchNCRs()
                fetchStatusCounts()
            })
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'quality_ncr_comments'
            }, (payload) => {
                const newComment = payload.new as any;
                if (newComment.author_user_id !== profileRef.current?.id) {
                    const ncr = ncrsRef.current.find(n => n.id === newComment.ncr_id);
                    if (ncr) {
                        toast.info(`💬 Nuevo mensaje en lote ${ncr.batch_code}`, {
                            description: newComment.message.substring(0, 50) + (newComment.message.length > 50 ? '...' : ''),
                            action: {
                                label: 'Ver',
                                onClick: () => {
                                    window.location.href = `/calidad/ncr/${newComment.ncr_id}`;
                                }
                            }
                        });

                        if ("Notification" in window && Notification.permission === "granted") {
                            new Notification(`Nuevo mensaje en NCR: ${ncr.batch_code}`, {
                                body: newComment.message.substring(0, 100),
                                icon: '/favicon.ico'
                            });
                        }
                    }
                }
                fetchNCRs()
            })
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'quality_disposition'
            }, (payload) => {
                const newDisp = payload.new as any;
                const ncr = ncrsRef.current.find(n => n.id === newDisp.ncr_id);
                if (ncr) {
                    toast.success(`📋 Disposición Registrada: ${ncr.batch_code}`, {
                        description: `Se ha determinado: ${newDisp.disposition_type}`,
                        action: {
                            label: 'Ver',
                            onClick: () => window.location.href = `/calidad/ncr/${ncr.id}`
                        }
                    });
                }
                fetchNCRs()
            })
            .subscribe()

        // Request notification permission
        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission();
        }

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
            const getCount = async (status: string | null) => {
                let query = supabase.from('quality_ncr').select('*', { count: 'exact', head: true })

                if (status) query = query.eq('status', status)

                // Enforce sucursal filter
                const profileAny = profile as any;
                const userRole = (profileAny?.role || profileAny?.rol || '').toLowerCase();
                const isManager = ['gerente_sucursal', 'gerente', 'sucursal'].includes(userRole);

                if (isManager && profileAny?.sucursal && profileAny.sucursal.trim() !== '') {
                    query = query.eq('sucursal', profileAny.sucursal.trim())
                } else if (sucursalFilter !== 'ALL' && sucursalFilter) {
                    query = query.eq('sucursal', sucursalFilter.trim())
                }

                if (productFilter !== 'ALL') query = query.eq('product_id', productFilter)

                // Filter by preparer if applicable
                if (userRole === 'preparador') {
                    query = query.eq('preparer_user_id', profile.id)
                }

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
            const profileAny = profile as any;
            let effectiveSucursal = (sucursalFilter === 'ALL' || !sucursalFilter) ? null : sucursalFilter.trim();

            // Security: Enforce branch lock for managers (dual role check)
            const userRole = (profileAny?.role || profileAny?.rol || '').toLowerCase();
            const isManager = ['gerente_sucursal', 'gerente', 'sucursal'].includes(userRole);

            if (isManager && profileAny?.sucursal && typeof profileAny.sucursal === 'string' && profileAny.sucursal.trim() !== '') {
                effectiveSucursal = profileAny.sucursal.trim();
            }

            // Call RPC
            const { data, error: rpcError } = await supabase.rpc('rpc_ncr_list', {
                p_status: statusFilter === 'ALL' ? null : statusFilter,
                p_sucursal: effectiveSucursal,
                p_product: productFilter === 'ALL' ? null : productFilter,
                p_batch: searchQuery || null,
                p_preparer_id: userRole === 'preparador' ? profile.id : null,
                p_limit: 50,
                p_offset: 0
            })

            console.log('NCRManager: RPC Result:', { count: data?.length, error: rpcError, forSucursal: effectiveSucursal })

            if (rpcError) throw rpcError

            let ncrData = data || []

            // Client-side join for disposition and last comment
            if (ncrData.length > 0) {
                const ncrIds = ncrData.map((n: any) => n.id)
                const batchCodes = ncrData.map((n: any) => n.batch_code).filter(Boolean)

                try {
                    const [dispResult, ncrExtraResult, bitacoraResult, lastCommentsResult, unreadNotifsResult] = await Promise.all([
                        supabase.from('quality_disposition').select('ncr_id, disposition_type').in('ncr_id', ncrIds),
                        supabase.from('quality_ncr').select('id, defect_detail').in('id', ncrIds),
                        supabase.from('bitacora_produccion_calidad').select('lote_producto, apariencia').in('lote_producto', batchCodes),
                        supabase.from('quality_ncr_comments')
                            .select('ncr_id, author_user_id')
                            .in('ncr_id', ncrIds)
                            .order('created_at', { ascending: false }),
                        supabase.from('notifications')
                            .select('metadata')
                            .eq('user_id', profile.id)
                            .eq('read', false)
                    ])

                    const dispositions = dispResult.data
                    const ncrExtras = ncrExtraResult.data
                    const bitacoras = bitacoraResult.data
                    const lastComments = lastCommentsResult.data
                    const unreadNotifs = unreadNotifsResult.data

                    const dispMap = new Map(dispositions?.map(d => [d.ncr_id, d.disposition_type]) || [])
                    const extraMap = new Map(ncrExtras?.map(n => [n.id, n.defect_detail]) || [])
                    const bitacoraMap = new Map(bitacoras?.map(b => [b.lote_producto, b.apariencia]) || [])

                    const unreadCountMap = new Map();
                    unreadNotifs?.forEach((n: any) => {
                        const ncrId = n.metadata?.ncr_id;
                        if (ncrId) unreadCountMap.set(ncrId, (unreadCountMap.get(ncrId) || 0) + 1);
                    });

                    const lastCommentMap = new Map();
                    lastComments?.forEach(c => {
                        if (!lastCommentMap.has(c.ncr_id)) lastCommentMap.set(c.ncr_id, c.author_user_id);
                    });

                    ncrData = ncrData.map((n: any) => ({
                        ...n,
                        disposition_type: n.disposition_type || dispMap.get(n.id),
                        defect_detail: n.defect_detail || extraMap.get(n.id),
                        apariencia_reportada: bitacoraMap.get(n.batch_code),
                        message_count: unreadCountMap.get(n.id) || 0,
                        last_message_author_id: n.last_message_author_id || lastCommentMap.get(n.id)
                    }))
                } catch (extraError) {
                    console.error('Non-critical error joining NCR extra data:', extraError)
                }
            }

            setNcrs(ncrData)
            fetchStatusCounts()
        } catch (error: any) {
            console.error('Error fetching NCRs:', error)
            const errorMsg = error?.message || 'Error desconocido';
            const errorDetails = error?.details || '';
            toast.error(`Error al cargar NCRs: ${errorMsg} ${errorDetails}`)
        } finally {
            setLoading(false)
        }
    }

    // KPI Calculation
    const totalOpen = ncrs.filter(n => n.status !== 'CERRADO').length

    // Litros SCRAP (NCRs cerrados con disposición SCRAP_DESTRUCCION)
    const scrapLiters = ncrs
        .filter(n => n.status === 'CERRADO' && n.disposition_type?.toUpperCase().includes('SCRAP'))
        .reduce((sum, n) => sum + (n.liters_involved || 0), 0)

    // badFirstTime: litros totales afectados por algún NCR (todos, sin filtro de status)
    // Equivalente al volumen que no pasó a la primera sin incidente
    const badFirstTime = ncrs.reduce((sum, n) => sum + (n.liters_involved || 0), 0)

    // Tasa de cierre: % de NCRs cerrados respecto al total
    const closureRate = statusCounts.ALL > 0
        ? Math.round((statusCounts.CERRADO / statusCounts.ALL) * 100)
        : 0

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

    const getParameterColor = (param: string) => {
        if (!param) return 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'

        const lowerParam = param.toLowerCase();
        if (lowerParam.includes('sólidos') || lowerParam.includes('solidos') || lowerParam.includes('brix')) return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800'
        if (lowerParam.includes('ph')) return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800'
        if (lowerParam.includes('apariencia') || lowerParam.includes('estético')) return 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-900/30 dark:text-fuchsia-300 dark:border-fuchsia-800'
        if (lowerParam.includes('color')) return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800'
        if (lowerParam.includes('aroma') || lowerParam.includes('olor')) return 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-cyan-800'
        if (lowerParam.includes('viscosidad')) return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800'
        if (lowerParam.includes('microbio')) return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800'

        return 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700'
    }

    // Paleta corporativa: azul #0e0c9b → rojo #c41f1a
    const getDispositionStyle = (type: string): string => {
        if (!type || type === '-') return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400'
        const t = type.toUpperCase()
        if (t.includes('SCRAP') || t.includes('DESECHO') || t.includes('DESTRUCCI'))
            return 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300'
        if (t.includes('REPROCESO'))
            return 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300'
        if (t.includes('AJUSTE'))
            return 'bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-900/30 dark:text-violet-300'
        if (t.includes('DOWNGRADE') || t.includes('USE AS IS'))
            return 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300'
        if (t.includes('CONCESION'))
            return 'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-900/30 dark:text-sky-300'
        if (t.includes('HOLD') || t.includes('RETENCION'))
            return 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300'
        if (t.includes('DEVOLUCION') || t.includes('DEVOLUCIÓN'))
            return 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-300'
        if (t.includes('PENDIENTE'))
            return 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300'
        return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300'
    }

    const renderMeasurement = (ncr: NCR) => {
        const defectDetail = ncr.defect_detail;
        const parameter = ncr.defect_parameter;

        if (!defectDetail || !parameter) return <span className="text-muted-foreground text-xs block text-center">-</span>;

        // Buscamos la primera oración que empiece con el parámetro (Ej. Sólidos: ...)
        const parts = defectDetail.split('. ').find(s => s.startsWith(parameter + ':') || s.includes(parameter));
        const textToProcess = parts || defectDetail;

        const valMatch = textToProcess.match(/\(([^)]+)\)/);
        const stdMatch = textToProcess.match(/\[([^\]]+)\]/);

        if (valMatch) {
            let val = valMatch[1];
            let std = stdMatch ? stdMatch[1] : '';

            // FIX: If the old format saved "(Esperado: OPACO)" we extract it
            if (val.startsWith('Esperado:')) {
                std = val;
                val = parameter === 'Apariencia' && ncr.apariencia_reportada ? ncr.apariencia_reportada : 'No Conforme';
            }

            // Simplificar el texto del estándar si es muy largo
            if (std.includes('Tol (+/- 5%):')) {
                std = std.split('|')[1].replace('Tol (+/- 5%):', '').trim();
            } else if (std.startsWith('Esperado:')) {
                std = std.replace('Esperado:', '').trim();
            } else if (std.startsWith('Std: ')) {
                std = std.replace('Std: ', '').trim();
            }

            return (
                <div className="flex flex-col items-start justify-center">
                    <span className="font-bold text-[#C1272D] dark:text-red-400">{val}</span>
                    {std && <span className="text-[10px] text-slate-500 font-mono mt-0.5 leading-tight" title={stdMatch ? stdMatch[1] : std}>[{std}]</span>}
                </div>
            );
        }

        // Extraemos lo que está en corchetes como estándar si no había entrado en el if anterior
        let std = stdMatch ? stdMatch[1] : '';

        // Simplificar el texto del estándar
        if (std.includes('Tol (+/- 5%):')) {
            std = std.split('|')[1].replace('Tol (+/- 5%):', '').trim();
        } else if (std.startsWith('Esperado: ')) {
            std = std.replace('Esperado: ', '').trim();
        } else if (std.startsWith('Std: ')) {
            std = std.replace('Std: ', '').trim();
        }

        // Si no hay paréntesis, extraemos lo reportado (ej. para Apariencia u olores)
        let reportedText = textToProcess;
        if (textToProcess.includes(':')) {
            reportedText = textToProcess.split(':').slice(1).join(':').trim();
        }

        // Removemos lo que esté en corchetes de lo reportado
        reportedText = reportedText.replace(/\[([^\]]+)\]/g, '').trim();

        if (!reportedText || reportedText.toLowerCase() === 'no conforme') {
            reportedText = parameter === 'Apariencia' && ncr.apariencia_reportada ? ncr.apariencia_reportada : 'No Conforme';
        }

        return (
            <div className="flex flex-col items-start justify-center">
                <span className="font-bold text-[#C1272D] dark:text-red-400 max-w-[150px] line-clamp-2 block" title={textToProcess}>
                    {reportedText}
                </span>
                {std && <span className="text-[10px] text-slate-500 font-mono mt-0.5 leading-tight" title={textToProcess}>[{std}]</span>}
            </div>
        );
    }

    // Pre-filter NCRs by disposition before rendering
    const displayNCRs = ncrs.filter(ncr => {
        if (dispositionFilter === 'ALL') return true
        if (dispositionFilter === 'PENDIENTE') return !ncr.disposition_type || ncr.disposition_type === '-'
        return (ncr.disposition_type?.toUpperCase().includes(dispositionFilter.replace(/_/g, ' ')))
            || ncr.disposition_type === dispositionFilter
    })

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
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {/* NCRs Abiertos */}
                <Card className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-950/20 dark:to-red-900/10 border-[#C1272D]/20 dark:border-[#C1272D]/30">
                    <div className="absolute top-0 right-0 p-5 opacity-10">
                        <AlertTriangle className="w-24 h-24 text-[#C1272D]" />
                    </div>
                    <CardHeader className="pb-2 pt-5 px-5 relative z-10">
                        <CardTitle className="text-sm font-extrabold text-[#C1272D] dark:text-red-400 tracking-wide flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-[#C1272D] shadow-[0_0_8px_rgba(193,39,45,0.6)]" />
                            NCRs Abiertos
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="relative z-10 px-5 pb-5">
                        <div className="flex flex-col gap-1">
                            <div className="flex items-baseline gap-2">
                                <span className="text-5xl font-extrabold text-[#C1272D] dark:text-red-400 tracking-tight">
                                    {totalOpen}
                                </span>
                                <span className="text-sm font-medium text-[#C1272D]/80 dark:text-red-400/80">casos</span>
                            </div>
                            <span className="text-xs font-semibold text-[#C1272D]/70 dark:text-red-300/70">
                                Requieren atención
                            </span>
                        </div>
                    </CardContent>
                </Card>

                {/* Litros en Hold */}
                <Card className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-950/20 dark:to-orange-900/10 border-orange-200 dark:border-orange-900/30">
                    <div className="absolute top-0 right-0 p-5 opacity-10">
                        <Beaker className="w-24 h-24 text-orange-600" />
                    </div>
                    <CardHeader className="pb-2 pt-5 px-5 relative z-10">
                        <CardTitle className="text-sm font-extrabold text-orange-700 dark:text-orange-400 tracking-wide flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]" />
                            Litros en Hold
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="relative z-10 px-5 pb-5">
                        <div className="flex flex-col gap-1">
                            <div className="flex items-baseline gap-2">
                                <span className="text-5xl font-extrabold text-orange-700 dark:text-orange-400 tracking-tight">
                                    {totalLitersOnHold.toLocaleString()}
                                </span>
                                <span className="text-sm font-medium text-orange-600/80 dark:text-orange-400/80">L</span>
                            </div>
                            <span className="text-xs font-semibold text-orange-700/70 dark:text-orange-300/70">
                                Volumen detenido
                            </span>
                        </div>
                    </CardContent>
                </Card>

                {/* Bad First Time — Litros totales con incidencia */}
                <Card className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-purple-50 to-violet-100/50 dark:from-purple-950/20 dark:to-violet-900/10 border-purple-200 dark:border-purple-900/30">
                    <div className="absolute top-0 right-0 p-5 opacity-10">
                        <Zap className="w-24 h-24 text-purple-600" />
                    </div>
                    <CardHeader className="pb-2 pt-5 px-5 relative z-10">
                        <CardTitle className="text-sm font-extrabold text-purple-700 dark:text-purple-400 tracking-wide flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]" />
                            Litros Afectados
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="relative z-10 px-5 pb-5">
                        <div className="flex flex-col gap-1">
                            <div className="flex items-baseline gap-2">
                                <span className="text-5xl font-extrabold text-purple-700 dark:text-purple-400 tracking-tight">
                                    {badFirstTime.toLocaleString()}
                                </span>
                                <span className="text-sm font-medium text-purple-600/80 dark:text-purple-400/80">L</span>
                            </div>
                            <span className="text-xs font-semibold text-purple-700/70 dark:text-purple-300/70">
                                Bad First Time (total NCRs)
                            </span>
                        </div>
                    </CardContent>
                </Card>

                {/* Litros SCRAP */}
                <Card className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-950/20 dark:to-slate-900/10 border-slate-200 dark:border-slate-800">
                    <div className="absolute top-0 right-0 p-5 opacity-10">
                        <XCircle className="w-24 h-24 text-slate-600" />
                    </div>
                    <CardHeader className="pb-2 pt-5 px-5 relative z-10">
                        <CardTitle className="text-sm font-extrabold text-slate-700 dark:text-slate-300 tracking-wide flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-slate-500" />
                            Litros SCRAP
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="relative z-10 px-5 pb-5">
                        <div className="flex flex-col gap-1">
                            <div className="flex items-baseline gap-2">
                                <span className="text-5xl font-extrabold text-slate-700 dark:text-slate-300 tracking-tight">
                                    {scrapLiters.toLocaleString()}
                                </span>
                                <span className="text-sm font-medium text-slate-500">L</span>
                            </div>
                            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                Destruidos / confirmados
                            </span>
                        </div>
                    </CardContent>
                </Card>

                {/* Tasa de Cierre */}
                <Card className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-green-50 to-emerald-100/50 dark:from-green-950/20 dark:to-emerald-900/10 border-green-200 dark:border-green-900/30">
                    <div className="absolute top-0 right-0 p-5 opacity-10">
                        <CheckCircle2 className="w-24 h-24 text-green-600" />
                    </div>
                    <CardHeader className="pb-2 pt-5 px-5 relative z-10">
                        <CardTitle className="text-sm font-extrabold text-green-700 dark:text-green-400 tracking-wide flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                            Tasa de Cierre
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="relative z-10 px-5 pb-5">
                        <div className="flex flex-col gap-1">
                            <div className="flex items-baseline gap-2">
                                <span className="text-5xl font-extrabold text-green-700 dark:text-green-400 tracking-tight">
                                    {closureRate}
                                </span>
                                <span className="text-sm font-medium text-green-600/80 dark:text-green-400/80">%</span>
                            </div>
                            <span className="text-xs font-semibold text-green-700/70 dark:text-green-300/70">
                                {statusCounts.CERRADO} de {statusCounts.ALL} NCRs resueltos
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

                        {/* Filtro por Disposición */}
                        <Select value={dispositionFilter} onValueChange={setDispositionFilter}>
                            <SelectTrigger className="w-full md:w-[200px]">
                                <div className="flex items-center gap-2 truncate">
                                    <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                    <span className="text-muted-foreground shrink-0">Disp:</span>
                                    <span className="truncate">{dispositionFilter === 'ALL' ? 'Todas' : dispositionFilter.replace(/_/g, ' ')}</span>
                                </div>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">Todas las disposiciones</SelectItem>
                                <SelectItem value="PENDIENTE">Sin disposición</SelectItem>
                                <SelectItem value="REPROCESO">Reproceso</SelectItem>
                                <SelectItem value="AJUSTE_FORMULA">Ajuste Fórmula</SelectItem>
                                <SelectItem value="DOWNGRADE">Downgrade</SelectItem>
                                <SelectItem value="SCRAP_DESTRUCCION">Scrap / Destrucción</SelectItem>
                                <SelectItem value="HOLD_INVESTIGACION">Hold Investigación</SelectItem>
                                <SelectItem value="CONCESION">Concesión</SelectItem>
                                <SelectItem value="DEVOLUCION">Devolución</SelectItem>
                            </SelectContent>
                        </Select>



                        {/* Admin/Manager Filters: Sucursal & Producto */}
                        {(() => {
                            const role = profile?.role?.toLowerCase();
                            const showSucursalFilter = role === 'admin' || role === 'gerente_calidad' || role === 'coordinador';
                            const showProductFilter = showSucursalFilter || role === 'gerente_sucursal' || role === 'gerente';

                            if (!showProductFilter) return null;

                            return (
                                <>
                                    {showSucursalFilter && (
                                        <Select
                                            value={sucursalFilter}
                                            onValueChange={setSucursalFilter}
                                        >
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
                                    )}

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
                            );
                        })()}
                    </div>
                    <Button variant="outline" size="icon" onClick={fetchNCRs} title="Actualizar">
                        <RefreshCcw className="h-4 w-4" />
                    </Button>
                </CardContent>
            </Card>

            {/* Table */}
            <Card className="border-none shadow-lg dark:bg-slate-900 rounded-[2rem] overflow-hidden">
                <CardHeader className="border-none">
                    <CardTitle className="text-xl font-bold text-slate-900 dark:text-slate-100">Listado de Casos</CardTitle>
                </CardHeader>
                <CardContent className="px-6 pb-6 pt-2">
                    {/* Desktop View */}
                    <div className="hidden md:block">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-gradient-to-r from-[#0e0c9b] to-[#2a28b5] hover:from-[#0e0c9b] hover:to-[#2a28b5] border-none h-12">
                                    <TableHead className="text-center text-white font-bold text-sm w-[70px] rounded-l-2xl">Check</TableHead>
                                    <TableHead className="text-white font-bold text-sm">Lote</TableHead>
                                    <TableHead className="text-white font-bold text-sm">Defecto</TableHead>
                                    <TableHead className="text-white font-bold text-sm">Medición</TableHead>
                                    <TableHead className="text-white font-bold text-sm">Litros Inv.</TableHead>
                                    <TableHead className="text-white font-bold text-sm">Disposición</TableHead>
                                    <TableHead className="text-white font-bold text-sm">Estado</TableHead>
                                    <TableHead className="w-[50px] text-white font-bold text-sm rounded-r-2xl pr-4"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-24 text-center">
                                            Cargando datos...
                                        </TableCell>
                                    </TableRow>
                                ) : ncrs.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                                            No se encontraron casos de No Conformidad.
                                        </TableCell>
                                    </TableRow>
                                ) : displayNCRs.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                                            No hay NCRs con la disposición seleccionada.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    displayNCRs.map((ncr) => (
                                        <TableRow key={ncr.id}>
                                            <TableCell className="text-center">
                                                <div className="relative flex items-center justify-center gap-2">
                                                    <Link href={`/calidad/ncr/${ncr.id}`}>
                                                        <Button variant="ghost" size="icon">
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                    </Link>
                                                    {ncr.message_count > 0 && (
                                                        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm border border-white dark:border-slate-800">
                                                            {ncr.message_count}
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-medium">{ncr.batch_code}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={cn("text-xs font-semibold whitespace-nowrap", getParameterColor(ncr.defect_parameter))}>
                                                    {ncr.defect_parameter}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {renderMeasurement(ncr)}
                                            </TableCell>
                                            <TableCell>{ncr.liters_involved?.toLocaleString()} L</TableCell>
                                            <TableCell>
                                                {ncr.disposition_type && ncr.disposition_type !== '-' ? (
                                                    <Badge variant="outline" className={`font-medium text-[11px] border ${getDispositionStyle(ncr.disposition_type)}`}>
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
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden p-4 space-y-4 bg-slate-50/50 dark:bg-slate-950/20">
                        {loading ? (
                            <div className="py-12 text-center text-muted-foreground">Cargando datos...</div>
                        ) : ncrs.length === 0 ? (
                            <div className="py-12 text-center text-muted-foreground">No se encontraron casos.</div>
                        ) : displayNCRs.length === 0 ? (
                            <div className="py-12 text-center text-muted-foreground">No hay NCRs con la disposición seleccionada.</div>
                        ) : (
                            displayNCRs.map((ncr) => (
                                <div key={ncr.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                                    <div className="p-4 space-y-3">
                                        <div className="flex items-start justify-between">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lote</span>
                                                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{ncr.batch_code}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="outline" className={cn("text-[10px] font-bold px-2 py-0 h-5", getParameterColor(ncr.defect_parameter))}>
                                                        {ncr.defect_parameter}
                                                    </Badge>
                                                    <Badge className={cn("text-[10px] px-2 py-0 h-5", getStatusColor(ncr.status))}>
                                                        {ncr.status.replace('_', ' ')}
                                                    </Badge>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Link href={`/calidad/ncr/${ncr.id}`}>
                                                    <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl relative">
                                                        <Eye className="h-4 w-4 text-primary" />
                                                        {ncr.message_count > 0 && (
                                                            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm border border-white dark:border-slate-800">
                                                                {ncr.message_count}
                                                            </span>
                                                        )}
                                                    </Button>
                                                </Link>
                                                {profile?.role === 'admin' && (
                                                    <Button variant="ghost" size="icon" className="h-9 w-9 text-red-500" onClick={() => promptDelete(ncr.id)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                                            <div className="space-y-1">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Detalle Medición</span>
                                                <div className="text-sm">
                                                    {renderMeasurement(ncr)}
                                                </div>
                                            </div>
                                            <div className="space-y-1 text-right">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Volumen</span>
                                                <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                                    {ncr.liters_involved?.toLocaleString()} L
                                                </div>
                                            </div>
                                        </div>

                                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Disposición Final</span>
                                            {ncr.disposition_type && ncr.disposition_type !== '-' ? (
                                                <Badge variant="outline" className={`text-[10px] h-5 py-0 border font-medium ${getDispositionStyle(ncr.disposition_type)}`}>
                                                    {ncr.disposition_type.replace(/_/g, ' ')}
                                                </Badge>
                                            ) : (
                                                <span className="text-xs text-muted-foreground">Pendiente</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
