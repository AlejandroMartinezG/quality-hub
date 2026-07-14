"use client"

import { useState, useEffect, useRef, Fragment } from "react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { updateBitacoraRecord } from "./actions"
import { useAuth } from "@/components/AuthProvider"
import { Breadcrumbs } from "@/components/Breadcrumbs"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { supabase } from "@/lib/supabase"
import {
    Search, Filter, CheckCircle2, AlertCircle, XCircle, Loader2,
    Calendar, Trash2, Edit2, RotateCcw, ClipboardList, MessageSquare, Send, Download, StickyNote, BookOpen,
    ChevronDown, ChevronRight, Thermometer, Droplet, Palette, Wind
} from "lucide-react"
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import { Label as UILabel } from "@/components/ui/label"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import {
    PRODUCT_STANDARDS, PH_STANDARDS, APPEARANCE_STANDARDS, SUCURSALES
} from "@/lib/production-constants"
import { cn, getBasePath } from "@/lib/utils"

const PdfViewer = dynamic(() => import("@/components/PdfViewer").then(mod => mod.PdfViewer), { ssr: false })

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
    temp_med1?: number | null
    temp_med2?: number | null
    temperatura?: number | null
    apariencia: string
    color: string
    aroma: string
    nombre_preparador: string
    familia_producto?: string
    tamano_lote?: number
    observaciones?: string | null
}

interface ChatMessage {
    id: string
    measurement_id: string
    author_user_id: string
    message: string
    created_at: string
    author_name: string
    author_avatar?: string | null
}

export default function CalidadPage() {
    const { user, profile, loading: authLoading } = useAuth()
    const isAdmin = !!profile && (profile.is_admin || profile.role === 'admin')
    const router = useRouter()

    const [records, setRecords] = useState<BitacoraRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")
    const [sucursalFilter, setSucursalFilter] = useState("all")
    const [statusFilter, setStatusFilter] = useState("all")
    const [filterDateFrom, setFilterDateFrom] = useState(() => {
        const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().split('T')[0]
    })
    const [filterDateTo, setFilterDateTo] = useState(() => new Date().toISOString().split('T')[0])
    const [categoriaFilter, setCategoriaFilter] = useState("all")
    const [productoFilter, setProductoFilter] = useState("all")
    const [editingRecord, setEditingRecord] = useState<BitacoraRecord | null>(null)
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
    const [isUpdating, setIsUpdating] = useState(false)

    // Chat state
    const [chatOpen, setChatOpen] = useState(false)
    const [chatRecord, setChatRecord] = useState<BitacoraRecord | null>(null)
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
    const [chatLoading, setChatLoading] = useState(false)
    const [newChatMsg, setNewChatMsg] = useState('')
    const [sendingChat, setSendingChat] = useState(false)
    const [unreadChatCounts, setUnreadChatCounts] = useState<Map<string, number>>(new Map())
    const chatEndRef = useRef<HTMLDivElement>(null)

    // Expanded row detail state
    const [expandedRowId, setExpandedRowId] = useState<number | null>(null)
    const [expandedChatMsgs, setExpandedChatMsgs] = useState<ChatMessage[]>([])
    const [expandedChatLoading, setExpandedChatLoading] = useState(false)

    // Observations dialog state
    const [obsRecord, setObsRecord] = useState<BitacoraRecord | null>(null)

    // Catálogo de parámetros (PDF) dialog state
    const [catalogOpen, setCatalogOpen] = useState(false)

    // Export state
    const [exportOpen, setExportOpen] = useState(false)
    const [exportDateFrom, setExportDateFrom] = useState('')
    const [exportDateTo, setExportDateTo] = useState('')
    const [exporting, setExporting] = useState(false)

    const PAGE_SIZE = 100
    const [currentPage, setCurrentPage] = useState(0)

    useEffect(() => {
        if (!authLoading && profile) {
            const role = profile.role?.toLowerCase() || ''
            const forbidden = ['director_operaciones', 'mostrador', 'cajera', 'vendedor', 'director_compras']
            if (forbidden.includes(role)) {
                toast.error("Acceso restringido", { description: "No tienes permisos para acceder al módulo de Control de Calidad." })
                router.push('/')
            }
        }
    }, [profile, authLoading, router])

    useEffect(() => {
        if (user && !authLoading) fetchRecords(filterDateFrom || undefined, filterDateTo || undefined)
    }, [user?.id, isAdmin, profile?.role, authLoading])

    useEffect(() => {
        if (user && !authLoading) fetchRecords(filterDateFrom || undefined, filterDateTo || undefined)
    }, [filterDateFrom, filterDateTo])

    const fetchRecords = async (from?: string, to?: string) => {
        if (!user) return
        try {
            setLoading(true)
            let query = supabase.from('bitacora_produccion_calidad').select('*')
            const role = profile?.role?.toLowerCase()
            if (role === 'preparador') {
                query = query.eq('user_id', user.id)
            } else if ((role === 'gerente_sucursal' || role === 'gerente') && profile?.sucursal) {
                query = query.eq('sucursal', profile.sucursal)
            }
            if (from) query = query.gte('fecha_fabricacion', from)
            if (to)   query = query.lte('fecha_fabricacion', to + 'T23:59:59')
            const { data, error } = await query.order('created_at', { ascending: false })
            if (error) throw error
            setRecords(data || [])
            fetchUnreadChats()
        } catch {
            toast.error("Error al cargar los registros. Intenta de nuevo.")
        } finally {
            setLoading(false)
        }
    }

    const fetchUnreadChats = async () => {
        if (!user) return
        const { data } = await supabase.rpc('rpc_measurement_chat_unread', { p_user_id: user.id })
        const counts = new Map<string, number>()
        for (const row of (data || []) as any[]) {
            counts.set(String(row.measurement_id), Number(row.unread_count))
        }
        setUnreadChatCounts(counts)
    }

    const performDelete = async (id: number) => {
        try {
            const { error } = await supabase.from('bitacora_produccion_calidad').delete().eq('id', id)
            if (error) throw error
            toast.success("Registro eliminado permanentemente")
            fetchRecords()
        } catch {
            toast.error("Error al eliminar el registro.")
        }
    }

    const requestDelete = (id: number, lote: string) => {
        toast("¿Estás seguro?", {
            description: `Se eliminará el lote ${lote} de forma permanente.`,
            action: { label: "Confirmar", onClick: () => performDelete(id) },
            cancel: { label: "Cancelar", onClick: () => { } },
            duration: 5000,
        })
    }

    const handleEditSave = async () => {
        if (!editingRecord) return
        try {
            setIsUpdating(true)
            const result = await updateBitacoraRecord({
                id: editingRecord.id,
                ph: editingRecord.ph,
                solidos_medicion_1: editingRecord.solidos_medicion_1,
                solidos_medicion_2: editingRecord.solidos_medicion_2,
                apariencia: editingRecord.apariencia,
                color: editingRecord.color,
                aroma: editingRecord.aroma,
                tamano_lote: editingRecord.tamano_lote ?? null,
                fecha_fabricacion: editingRecord.fecha_fabricacion ?? '',
                lote_producto: editingRecord.lote_producto ?? '',
            })
            if (!result.success) throw new Error(result.message)
            toast.success("Registro actualizado")
            setIsEditDialogOpen(false)
            fetchRecords()
        } catch (e: any) {
            toast.error("Error al actualizar el registro.", { description: e?.message })
        } finally {
            setIsUpdating(false)
        }
    }

    const fetchChatMessages = async (measurementId: string) => {
        const { data: msgs } = await supabase
            .from('measurement_chat_messages')
            .select('id, measurement_id, author_user_id, author_name, message, created_at')
            .eq('measurement_id', measurementId)
            .order('created_at', { ascending: true })

        if (!msgs || msgs.length === 0) { setChatMessages([]); return }

        // Solo se necesita resolver avatar + nombre de respaldo para mensajes
        // antiguos que no tengan author_name guardado (anteriores a esta migración)
        const needsLookup = (msgs as any[]).some((m: any) => !m.author_name)
        const authorIds = Array.from(new Set((msgs as any[]).map((m: any) => m.author_user_id as string)))
        let nameMap: Record<string, string> = {}
        let avatarMap: Record<string, string | null> = {}
        if (needsLookup || authorIds.length > 0) {
            const profilesRes = await fetch('/api/profiles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: authorIds }),
            })
            const profilesData = profilesRes.ok ? await profilesRes.json() : []
            for (const p of (profilesData || []) as any[]) {
                if (p.id) {
                    nameMap[p.id as string] = (p.full_name as string | null) || ''
                    avatarMap[p.id as string] = (p.avatar_url as string | null) || null
                }
            }
        }
        setChatMessages((msgs as any[]).map((m: any) => ({
            ...m,
            author_name: m.author_name || nameMap[m.author_user_id] || 'Usuario eliminado',
            author_avatar: avatarMap[m.author_user_id] ?? null,
        }) as ChatMessage))
    }

    const toggleExpandRow = async (record: BitacoraRecord) => {
        if (expandedRowId === record.id) {
            setExpandedRowId(null)
            return
        }
        setExpandedRowId(record.id)
        setExpandedChatMsgs([])
        setExpandedChatLoading(true)

        const mid = String(record.id)
        const { data: msgs } = await supabase
            .from('measurement_chat_messages')
            .select('id, measurement_id, author_user_id, author_name, message, created_at')
            .eq('measurement_id', mid)
            .order('created_at', { ascending: true })

        if (msgs && msgs.length > 0) {
            const authorIds = Array.from(new Set((msgs as any[]).map((m: any) => m.author_user_id as string)))
            const nameMap: Record<string, string> = {}
            const avatarMap: Record<string, string | null> = {}
            try {
                const profilesRes = await fetch('/api/profiles', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ids: authorIds }),
                })
                const profilesData = profilesRes.ok ? await profilesRes.json() : []
                for (const p of (profilesData || []) as any[]) {
                    if (p.id) {
                        nameMap[p.id as string] = (p.full_name as string | null) || ''
                        avatarMap[p.id as string] = (p.avatar_url as string | null) || null
                    }
                }
            } catch (err) {
                console.error('Error al resolver perfiles del chat:', err)
            }
            setExpandedChatMsgs((msgs as any[]).map((m: any) => ({
                ...m,
                author_name: m.author_name || nameMap[m.author_user_id] || 'Usuario eliminado',
                author_avatar: avatarMap[m.author_user_id] ?? null,
            }) as ChatMessage))
        }
        setExpandedChatLoading(false)
    }

    const openChat = async (record: BitacoraRecord) => {
        const mid = String(record.id)
        setChatRecord(record)
        setChatOpen(true)
        setChatLoading(true)
        setChatMessages([])
        setUnreadChatCounts(prev => { const next = new Map(prev); next.delete(mid); return next })

        // Mark messages as read and CHAT_CALIDAD notifications as read
        if (user) {
            supabase.from('measurement_chat_reads')
                .upsert({ user_id: user.id, measurement_id: mid, last_read_at: new Date().toISOString() },
                    { onConflict: 'user_id,measurement_id' })
                .then(() => { })
            supabase.from('notifications')
                .update({ read: true })
                .eq('user_id', user.id)
                .eq('type', 'CHAT_CALIDAD')
                .eq('read', false)
                .filter('metadata->>measurement_id', 'eq', mid)
                .then(() => { })
        }

        await fetchChatMessages(mid)
        setChatLoading(false)
    }

    const sendChatMessage = async () => {
        if (!newChatMsg.trim() || !chatRecord || !profile) return
        const mid = String(chatRecord.id)
        setSendingChat(true)
        try {
            const { error } = await supabase
                .from('measurement_chat_messages')
                .insert({ measurement_id: mid, author_user_id: profile.id, author_name: profile.full_name, message: newChatMsg.trim() })
            if (error) throw error
            setNewChatMsg('')
            await fetchChatMessages(mid)
            // Update read timestamp so our own message doesn't count as unread
            if (user) {
                supabase.from('measurement_chat_reads')
                    .upsert({ user_id: user.id, measurement_id: mid, last_read_at: new Date().toISOString() },
                        { onConflict: 'user_id,measurement_id' })
                    .then(() => { })
            }
        } catch {
            toast.error('Error al enviar mensaje')
        } finally {
            setSendingChat(false)
        }
    }

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [chatMessages])

    // Auto-open chat when navigating from a notification link (?chat=<measurement_id>)
    useEffect(() => {
        if (loading || records.length === 0) return
        const chatMid = new URLSearchParams(window.location.search).get('chat')
        if (!chatMid) return
        const record = records.find(r => String(r.id) === chatMid)
        if (record) {
            window.history.replaceState({}, '', window.location.pathname)
            openChat(record)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [records, loading])

    // Auto-open chat via custom event (when ya estamos en /calidad y llega notificación)
    useEffect(() => {
        const handler = (e: Event) => {
            const mid = (e as CustomEvent<{ mid: string }>).detail.mid
            const record = records.find(r => String(r.id) === mid)
            if (record) openChat(record)
        }
        window.addEventListener('openChatMeasurement', handler)
        return () => window.removeEventListener('openChatMeasurement', handler)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [records])

    useEffect(() => { setCurrentPage(0) }, [searchTerm, sucursalFilter, statusFilter, filterDateFrom, filterDateTo, categoriaFilter, productoFilter])

    const getStatusInfo = (record: BitacoraRecord): 'success' | 'warning' | 'error' => {
        const std = PRODUCT_STANDARDS[record.codigo_producto]
        if (std && record.solidos_medicion_1 !== null && record.solidos_medicion_2 !== null) {
            const avg = (record.solidos_medicion_1 + record.solidos_medicion_2) / 2
            const specMin = std.min || 0
            const specMax = std.max || 0
            if (avg >= specMin && avg <= specMax) return 'success'
            if ((avg >= specMin * 0.95 && avg < specMin) || (avg > specMax && avg <= specMax * 1.05)) return 'warning'
            return 'error'
        }
        return 'success'
    }

    const getPhStatus = (record: BitacoraRecord): 'success' | 'warning' | 'error' | 'none' => {
        const std = PH_STANDARDS[record.codigo_producto]
        if (!std || record.ph === null) return 'none'
        const { min, max } = std
        if (record.ph >= min && record.ph <= max) return 'success'
        if ((record.ph >= min * 0.97 && record.ph < min) || (record.ph > max && record.ph <= max * 1.03)) return 'warning'
        return 'error'
    }

    const uniqueCategorias = Array.from(new Set(records.map(r => r.familia_producto).filter(Boolean))) as string[]
    const uniqueProductos = Array.from(new Set(records.map(r => r.codigo_producto).filter(Boolean))) as string[]

    const filteredRecords = records.filter(r => {
        const matchesSearch =
            r.lote_producto?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.codigo_producto?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.sucursal?.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesSucursal = sucursalFilter === "all" || r.sucursal === sucursalFilter
        const matchesStatus = statusFilter === "all" || getStatusInfo(r) === statusFilter
        const matchesCategoria = categoriaFilter === "all" || (r.familia_producto || '') === categoriaFilter
        const matchesProducto = productoFilter === "all" || r.codigo_producto === productoFilter
        let matchesTime = true
        const fecha = r.fecha_fabricacion?.split('T')[0] ?? ''
        if (filterDateFrom && fecha && fecha < filterDateFrom) matchesTime = false
        if (filterDateTo && fecha && fecha > filterDateTo) matchesTime = false
        return matchesSearch && matchesSucursal && matchesStatus && matchesTime && matchesCategoria && matchesProducto
    })

    const totalPages = Math.ceil(filteredRecords.length / PAGE_SIZE)
    const paginatedRecords = filteredRecords.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)

    const solidsRecords = filteredRecords.filter(r => !!PRODUCT_STANDARDS[r.codigo_producto])
    const phRecords = filteredRecords.filter(r => getPhStatus(r) !== 'none')
    const pzsAromatizantes = filteredRecords
        .filter(r => {
            const fam = (r.familia_producto || '').toLowerCase()
            return fam.includes('base') && fam.includes('aromat')
        })
        .reduce((sum, r) => sum + (r.tamano_lote || 0), 0)

    const pzsLimpiadores = filteredRecords
        .filter(r => {
            const fam = (r.familia_producto || '').toLowerCase()
            return fam.includes('base') && fam.includes('limp')
        })
        .reduce((sum, r) => sum + (r.tamano_lote || 0), 0)

    const litrosBases = (pzsAromatizantes + pzsLimpiadores) * 20

    const litrosIntermedios = filteredRecords
        .filter(r => {
            const fam = (r.familia_producto || '').toLowerCase()
            return fam.includes('intermedio') || fam.includes('disolucion') || fam.includes('disolución')
        })
        .reduce((sum, r) => sum + (r.tamano_lote || 0), 0)

    const litrosProductos = filteredRecords
        .filter(r => {
            const fam = (r.familia_producto || '').toLowerCase()
            return !fam.includes('base') && !fam.includes('intermedio') && !fam.includes('disolucion') && !fam.includes('disolución')
        })
        .reduce((sum, r) => sum + (r.tamano_lote || 0), 0)

    const totalLitrosGeneral = litrosProductos + litrosBases + litrosIntermedios

    const pct = (n: number, total: number) => total > 0 ? ((n / total) * 100).toFixed(1) + '%' : '—'

    const buildExportRows = (data: BitacoraRecord[]) => data.map(r => {
        const solidsSt = getStatusInfo(r)
        const phSt = getPhStatus(r)
        const avg = r.solidos_medicion_1 !== null && r.solidos_medicion_2 !== null
            ? ((r.solidos_medicion_1 + r.solidos_medicion_2) / 2).toFixed(2)
            : ''
        return {
            'Lote': r.lote_producto || '',
            'Código Producto': r.codigo_producto || '',
            'Categoría': r.familia_producto || '',
            'Sucursal': r.sucursal || '',
            'Fecha Fabricación': r.fecha_fabricacion || '',
            'Fecha Registro': new Date(r.created_at).toLocaleDateString('es-MX'),
            'Preparador': r.nombre_preparador || '',
            'Tamaño Lote (L)': r.tamano_lote ?? '',
            'pH': r.ph ?? '',
            'Sólidos Med. 1 (%)': r.solidos_medicion_1 ?? '',
            'Sólidos Med. 2 (%)': r.solidos_medicion_2 ?? '',
            'Promedio Sólidos (%)': avg,
            'Estado Sólidos': solidsSt === 'success' ? 'Conforme' : solidsSt === 'warning' ? 'Semi-Conforme' : 'No Conforme',
            'Estado pH': phSt === 'none' ? 'N/A' : phSt === 'success' ? 'Conforme' : phSt === 'warning' ? 'Semi-Conforme' : 'No Conforme',
            'Apariencia': r.apariencia || '',
            'Color': r.color || '',
            'Aroma': r.aroma || '',
        }
    })

    const fetchExportData = async (): Promise<BitacoraRecord[]> => {
        let query = supabase.from('bitacora_produccion_calidad').select('*')
        const role = profile?.role?.toLowerCase()
        if (role === 'preparador') query = query.eq('user_id', user!.id)
        else if ((role === 'gerente_sucursal' || role === 'gerente') && profile?.sucursal)
            query = query.eq('sucursal', profile.sucursal)
        if (exportDateFrom) query = query.gte('fecha_fabricacion', exportDateFrom)
        if (exportDateTo) query = query.lte('fecha_fabricacion', exportDateTo)
        const { data } = await query.order('fecha_fabricacion', { ascending: false })
        return (data || []) as BitacoraRecord[]
    }

    const handleExportCsv = async () => {
        setExporting(true)
        try {
            const data = await fetchExportData()
            const rows = buildExportRows(data)
            if (rows.length === 0) { toast.info('No hay registros en ese rango de fechas'); return }
            const headers = Object.keys(rows[0])
            const escape = (v: any) => {
                const s = String(v ?? '')
                return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
            }
            const csv = [
                headers.join(','),
                ...rows.map(r => headers.map(h => escape(r[h as keyof typeof r])).join(','))
            ].join('\n')
            const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `mediciones_${exportDateFrom || 'inicio'}_al_${exportDateTo || 'hoy'}.csv`
            a.click()
            URL.revokeObjectURL(url)
            toast.success(`CSV descargado (${rows.length} registros)`)
            setExportOpen(false)
        } catch { toast.error('Error al exportar') }
        finally { setExporting(false) }
    }

    const handleExportXlsx = async () => {
        setExporting(true)
        try {
            const data = await fetchExportData()
            const rows = buildExportRows(data)
            if (rows.length === 0) { toast.info('No hay registros en ese rango de fechas'); return }
            const { default: XLSX } = await import('xlsx')
            const ws = XLSX.utils.json_to_sheet(rows)
            const headers = Object.keys(rows[0])
            ws['!cols'] = headers.map(h => ({
                wch: Math.max(h.length, ...rows.map(r => String(r[h as keyof typeof r] ?? '').length)) + 2
            }))
            const wb = XLSX.utils.book_new()
            XLSX.utils.book_append_sheet(wb, ws, 'Mediciones')
            XLSX.writeFile(wb, `mediciones_${exportDateFrom || 'inicio'}_al_${exportDateTo || 'hoy'}.xlsx`)
            toast.success(`Excel descargado (${rows.length} registros)`)
            setExportOpen(false)
        } catch { toast.error('Error al exportar') }
        finally { setExporting(false) }
    }

    const today = new Date().toISOString().split('T')[0]
    const sevenDaysAgo = (() => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().split('T')[0] })()
    const isDefault7Days = filterDateFrom === sevenDaysAgo && filterDateTo === today
    const isAllHistory = !filterDateFrom && !filterDateTo

    const resetTo7Days = () => { setFilterDateFrom(sevenDaysAgo); setFilterDateTo(today) }
    const clearDateRange = () => { setFilterDateFrom(""); setFilterDateTo("") }

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-12">
            <Breadcrumbs items={[{ label: "Control de Calidad" }]} />

            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
                        Control de Calidad
                    </h1>
                    <p className="text-muted-foreground mt-1 text-base font-medium tracking-wide">
                        Historial de Mediciones
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setCatalogOpen(true)} className="gap-2">
                        <BookOpen className="h-4 w-4" />
                        Catálogo de Parámetros
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setExportOpen(true)} className="gap-2">
                        <Download className="h-4 w-4" />
                        Exportar datos
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => fetchRecords(filterDateFrom || undefined, filterDateTo || undefined)} className="gap-2" disabled={loading}>
                        <RotateCcw className={cn("h-4 w-4", loading && "animate-spin")} />
                        Actualizar
                    </Button>
                </div>
            </div>

            {/* ── Selector de período ── */}
            <div className="flex flex-wrap items-center gap-3 px-1">
                <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 shrink-0">
                    <Calendar className="h-4 w-4" />
                    Período:
                </span>
                <div className="flex items-center gap-1.5">
                    <input
                        type="date"
                        value={filterDateFrom}
                        onChange={e => setFilterDateFrom(e.target.value)}
                        className="h-9 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        title="Fecha desde"
                    />
                    <span className="text-slate-400 text-sm">—</span>
                    <input
                        type="date"
                        value={filterDateTo}
                        onChange={e => setFilterDateTo(e.target.value)}
                        className="h-9 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        title="Fecha hasta"
                    />
                </div>
                <div className="flex gap-2">
                    <Button
                        size="sm"
                        variant={isDefault7Days ? "default" : "outline"}
                        onClick={resetTo7Days}
                        className="h-9 text-xs"
                    >
                        Últimos 7 días
                    </Button>
                    <Button
                        size="sm"
                        variant={isAllHistory ? "default" : "outline"}
                        onClick={clearDateRange}
                        className="h-9 text-xs"
                    >
                        Todo el historial
                    </Button>
                </div>
                {!isAllHistory && !isDefault7Days && (
                    <button
                        onClick={clearDateRange}
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title="Limpiar rango"
                    >
                        <XCircle className="h-4 w-4" />
                    </button>
                )}
            </div>

            {/* ── Stats Grid ── */}
            <div className="flex flex-col md:grid md:grid-cols-4 md:grid-rows-2 gap-4">

                {/* Total — spans 2 rows */}
                <Card className="md:row-span-2 relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#0e0c9b] to-[#2a28b5] border-none text-white shadow-xl">
                    <div className="absolute bottom-0 right-0 p-6 opacity-10">
                        <ClipboardList className="w-40 h-40 text-white" />
                    </div>
                    <div className="absolute top-4 right-4 h-11 w-11 rounded-2xl bg-white/10 flex items-center justify-center">
                        <ClipboardList className="h-5 w-5 text-white" />
                    </div>
                    <CardContent className="relative z-10 p-6 flex flex-col h-full gap-4">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-0.5">Historial</p>
                            <p className="text-base font-bold text-white/90">Total Analizado</p>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-7xl font-extrabold tracking-tight">{filteredRecords.length}</span>
                            <span className="text-base font-medium text-white/60">muestras</span>
                        </div>
                        
                        <div className="flex items-center justify-between mt-1">
                            <span className="text-xs font-bold uppercase tracking-widest text-white/50">Productos Terminados</span>
                            <span className="text-lg font-bold text-white/90">{litrosProductos.toLocaleString()} L</span>
                        </div>

                        {litrosIntermedios > 0 && (
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold uppercase tracking-widest text-teal-300/80">Productos Intermedios</span>
                                <span className="text-lg font-bold text-teal-300">{litrosIntermedios.toLocaleString()} L</span>
                            </div>
                        )}

                        <div className="h-px bg-white/10" />

                        <div className="space-y-3 flex-1 flex flex-col justify-end">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">Bases (Registradas en pzs)</p>
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-xs text-white/70 font-medium leading-tight">🌿 Aromatizante Ambiental</span>
                                        <span className="text-base font-bold shrink-0">{pzsAromatizantes} pzs</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-xs text-white/70 font-medium leading-tight">🧴 Limpiadores Multiusos</span>
                                        <span className="text-base font-bold shrink-0">{pzsLimpiadores} pzs</span>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between gap-2 mt-3 pt-2 border-t border-white/10">
                                    <span className="text-xs text-emerald-400 font-bold uppercase tracking-wider">Total Bases (Eq.)</span>
                                    <span className="text-lg font-black text-emerald-400 shrink-0">{litrosBases.toLocaleString()} L</span>
                                </div>
                            </div>
                            
                            {totalLitrosGeneral > 0 && (
                                <>
                                    <div className="h-px bg-white/10 mt-4 mb-2" />
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-white font-bold uppercase tracking-wider">Total General</span>
                                        <span className="text-3xl font-black text-white drop-shadow-md tracking-tight">{totalLitrosGeneral.toLocaleString()} L</span>
                                    </div>
                                </>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Sólidos Group */}
                <div className="md:col-span-3 flex flex-col gap-2">
                    <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest md:hidden pl-2">Análisis de % Sólidos</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 h-full">
                        {/* Sólidos — Conformes */}
                        <Card className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/30 dark:to-green-900/10 border-green-200 dark:border-green-500/20 shadow-sm dark:shadow-[0_0_15px_rgba(34,197,94,0.05)]">
                            <div className="absolute top-4 right-4 h-10 w-10 rounded-2xl bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                            </div>
                            <CardContent className="p-6 flex flex-col h-full justify-between gap-6">
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-green-600/60 dark:text-green-400/50 mb-1">% Sólidos</p>
                                    <p className="text-base font-bold text-green-700 dark:text-green-400">Conformes</p>
                                </div>
                                <div className="mt-auto">
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-5xl font-black tracking-tighter text-green-700 dark:text-green-400">
                                            {solidsRecords.filter(r => getStatusInfo(r) === 'success').length}
                                        </span>
                                        <span className="text-lg font-bold text-green-600/70 dark:text-green-500/70">
                                            {pct(solidsRecords.filter(r => getStatusInfo(r) === 'success').length, solidsRecords.length)}
                                        </span>
                                    </div>
                                    <p className="text-xs font-medium text-green-600/50 dark:text-green-400/40 mt-1">de {solidsRecords.length} con estándar de sólidos</p>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Sólidos — Semi-Conforme */}
                        <Card className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-yellow-50 to-yellow-100/50 dark:from-yellow-950/30 dark:to-yellow-900/10 border-yellow-200 dark:border-yellow-500/20 shadow-sm dark:shadow-[0_0_15px_rgba(234,179,8,0.05)]">
                            <div className="absolute top-4 right-4 h-10 w-10 rounded-2xl bg-yellow-100 dark:bg-yellow-900/40 flex items-center justify-center">
                                <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                            </div>
                            <CardContent className="p-6 flex flex-col h-full justify-between gap-6">
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-yellow-600/60 dark:text-yellow-400/50 mb-1">% Sólidos</p>
                                    <p className="text-base font-bold text-yellow-700 dark:text-yellow-400">Semi-Conforme</p>
                                </div>
                                <div className="mt-auto">
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-5xl font-black tracking-tighter text-yellow-700 dark:text-yellow-400">
                                            {solidsRecords.filter(r => getStatusInfo(r) === 'warning').length}
                                        </span>
                                        <span className="text-lg font-bold text-yellow-600/70 dark:text-yellow-500/70">
                                            {pct(solidsRecords.filter(r => getStatusInfo(r) === 'warning').length, solidsRecords.length)}
                                        </span>
                                    </div>
                                    <p className="text-xs font-medium text-yellow-600/50 dark:text-yellow-400/40 mt-1">de {solidsRecords.length} con estándar de sólidos</p>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Sólidos — No Conforme */}
                        <Card className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-950/30 dark:to-red-900/10 border-red-200 dark:border-red-500/20 shadow-sm dark:shadow-[0_0_15px_rgba(220,38,38,0.05)]">
                            <div className="absolute top-4 right-4 h-10 w-10 rounded-2xl bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
                                <XCircle className="h-5 w-5 text-[#C1272D] dark:text-red-400" />
                            </div>
                            <CardContent className="p-6 flex flex-col h-full justify-between gap-6">
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#C1272D]/60 dark:text-red-400/50 mb-1">% Sólidos</p>
                                    <p className="text-base font-bold text-[#C1272D] dark:text-red-400">No Conforme</p>
                                </div>
                                <div className="mt-auto">
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-5xl font-black tracking-tighter text-[#C1272D] dark:text-red-400">
                                            {solidsRecords.filter(r => getStatusInfo(r) === 'error').length}
                                        </span>
                                        <span className="text-lg font-bold text-[#C1272D]/70 dark:text-red-500/70">
                                            {pct(solidsRecords.filter(r => getStatusInfo(r) === 'error').length, solidsRecords.length)}
                                        </span>
                                    </div>
                                    <p className="text-xs font-medium text-red-600/50 dark:text-red-400/40 mt-1">de {solidsRecords.length} con estándar de sólidos</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* pH Group */}
                <div className="md:col-span-3 flex flex-col gap-2 mt-2 md:mt-0">
                    <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest md:hidden pl-2">Análisis de pH</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 h-full">
                        {/* pH — Conformes */}
                        <Card className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/30 dark:to-emerald-900/10 border-emerald-200 dark:border-emerald-500/20 shadow-sm dark:shadow-[0_0_15px_rgba(16,185,129,0.05)]">
                            <div className="absolute top-4 right-4 h-10 w-10 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <CardContent className="p-6 flex flex-col h-full justify-between gap-6">
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600/60 dark:text-emerald-400/50 mb-1">Análisis de pH</p>
                                    <p className="text-base font-bold text-emerald-700 dark:text-emerald-400">Conformes</p>
                                </div>
                                <div>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-5xl font-black tracking-tighter text-emerald-700 dark:text-emerald-400">
                                            {phRecords.filter(r => getPhStatus(r) === 'success').length}
                                        </span>
                                        <span className="text-lg font-bold text-emerald-600/70 dark:text-emerald-500/70">
                                            {pct(phRecords.filter(r => getPhStatus(r) === 'success').length, phRecords.length)}
                                        </span>
                                    </div>
                                    <p className="text-xs font-medium text-emerald-600/50 dark:text-emerald-400/40 mt-1">de {phRecords.length} muestras con estándar</p>
                                </div>
                            </CardContent>
                        </Card>

                        {/* pH — No Conforme */}
                        <Card className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-rose-50 to-rose-100/50 dark:from-rose-950/30 dark:to-rose-900/10 border-rose-200 dark:border-rose-500/20 shadow-sm dark:shadow-[0_0_15px_rgba(244,63,94,0.05)]">
                            <div className="absolute top-4 right-4 h-10 w-10 rounded-2xl bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center">
                                <XCircle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                            </div>
                            <CardContent className="p-6 flex flex-col h-full justify-between gap-6">
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-rose-600/60 dark:text-rose-400/50 mb-1">Análisis de pH</p>
                                    <p className="text-base font-bold text-rose-700 dark:text-rose-400">No Conforme</p>
                                </div>
                                <div>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-5xl font-black tracking-tighter text-rose-700 dark:text-rose-400">
                                            {phRecords.filter(r => getPhStatus(r) === 'error').length}
                                        </span>
                                        <span className="text-lg font-bold text-rose-600/70 dark:text-rose-500/70">
                                            {pct(phRecords.filter(r => getPhStatus(r) === 'error').length, phRecords.length)}
                                        </span>
                                    </div>
                                    <p className="text-xs font-medium text-rose-600/50 dark:text-rose-400/40 mt-1">de {phRecords.length} muestras con estándar</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>

            {/* ── Nota metodológica ── */}
            <div className="flex items-start gap-3 px-4 py-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
                <p className="text-xs leading-relaxed">
                    <span className="font-bold">Nota metodológica:</span> Los lotes cuyo código de producto no tiene un estándar técnico registrado se clasifican como <em>N/A</em> y se excluyen de los conteos de conformidad de sólidos y pH. Solo se contabilizan los lotes con estándar definido, homologando la lógica con el módulo de <span className="font-semibold">Reportes (FTQ / FY)</span>.
                </p>
            </div>

            {/* ── Filtros ── */}
            <Card className="border-primary/5 bg-muted/20 rounded-[2rem]">
                <CardContent className="p-4 flex flex-col md:flex-row gap-4 flex-wrap">
                    <div className="flex-1 min-w-[180px] relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Buscar por lote o producto..." className="pl-10 h-10" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                    <div className="w-full md:w-52">
                        <Select value={categoriaFilter} onValueChange={v => { setCategoriaFilter(v); setProductoFilter("all") }}>
                            <SelectTrigger className="h-10">
                                <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
                                <SelectValue placeholder="Categoría" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas las categorías</SelectItem>
                                {uniqueCategorias.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="w-full md:w-52">
                        <Select value={productoFilter} onValueChange={setProductoFilter}>
                            <SelectTrigger className="h-10">
                                <SelectValue placeholder="Producto" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos los productos</SelectItem>
                                {(categoriaFilter === "all"
                                    ? uniqueProductos
                                    : Array.from(new Set(records.filter(r => r.familia_producto === categoriaFilter).map(r => r.codigo_producto).filter(Boolean))) as string[]
                                ).map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    {isAdmin && (
                        <div className="w-full md:w-56">
                            <Select value={sucursalFilter} onValueChange={setSucursalFilter}>
                                <SelectTrigger className="h-10">
                                    <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
                                    <SelectValue placeholder="Sucursal" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas las sucursales</SelectItem>
                                    {SUCURSALES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                    <div className="w-full md:w-48">
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="h-10"><SelectValue placeholder="Estado" /></SelectTrigger>
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

            {/* ── Tabla ── */}
            <Card className="border-none shadow-lg dark:bg-slate-900 rounded-[2rem] overflow-hidden">
                <CardHeader className="border-none">
                    <CardTitle className="text-xl font-bold text-slate-900 dark:text-slate-100">Registros de Medición</CardTitle>
                    <CardDescription className="text-slate-600 dark:text-slate-400">Comparados con límites de control de % Sólidos y pH.</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12 space-y-4">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-muted-foreground">Cargando registros...</p>
                        </div>
                    ) : (
                        <>
                            {/* Desktop */}
                            <div className="hidden md:block rounded-2xl overflow-hidden shadow-sm">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-gradient-to-r from-[#0e0c9b] to-[#2a28b5] hover:from-[#0e0c9b] hover:to-[#2a28b5] border-none h-12">
                                            <TableHead className="w-[150px] text-white font-bold text-sm rounded-l-2xl pl-6">Número de Lote</TableHead>
                                            <TableHead className="text-white font-bold text-sm">Producto / Sucursal</TableHead>
                                            <TableHead className="text-center text-white font-bold text-sm">Tamaño Lote</TableHead>
                                            <TableHead className="text-center text-white font-bold text-sm">pH</TableHead>
                                            <TableHead className="text-center text-white font-bold text-sm">% Sólidos (Avg)</TableHead>
                                            <TableHead className="text-white font-bold text-sm">Estado</TableHead>
                                            <TableHead className="text-center text-white font-bold text-sm">Apariencia</TableHead>
                                            <TableHead className="text-center text-white font-bold text-sm">Chat</TableHead>
                                            <TableHead className="text-center text-white font-bold text-sm">Obs.</TableHead>
                                            {isAdmin ? (
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
                                        {filteredRecords.length > 0 ? paginatedRecords.map(record => {
                                            const status = getStatusInfo(record)
                                            const phStatus = getPhStatus(record)
                                            const avgSolids = record.solidos_medicion_1 !== null && record.solidos_medicion_2 !== null
                                                ? (record.solidos_medicion_1 + record.solidos_medicion_2) / 2 : null
                                            const stdSolids = PRODUCT_STANDARDS[record.codigo_producto]
                                            const stdPH = PH_STANDARDS[record.codigo_producto]
                                            const stdApp = APPEARANCE_STANDARDS[record.codigo_producto]

                                            const isExpanded = expandedRowId === record.id

                                            return (
                                                <Fragment key={record.id}>
                                                <TableRow className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => toggleExpandRow(record)}>
                                                    <TableCell className="font-mono font-bold text-sm text-slate-700 dark:text-slate-200 pl-6">
                                                        <div className="flex items-center gap-1.5">
                                                            {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />}
                                                            {record.lote_producto}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-base text-slate-800 dark:text-slate-100">{record.codigo_producto}</span>
                                                            <span className="text-xs text-muted-foreground uppercase tracking-wide">{record.sucursal}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <span className="font-bold text-sm text-slate-700 dark:text-slate-200">
                                                            {record.tamano_lote ? record.tamano_lote.toLocaleString() + (record.familia_producto === 'Bases aromatizante ambiental' || record.familia_producto === 'Bases limpiadores liquidos multiusos' ? ' pzs' : ' L') : <span className="text-muted-foreground text-xs">—</span>}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <div className="flex flex-col items-center gap-0.5">
                                                            <span className={cn("font-bold text-sm",
                                                                phStatus === 'success' && "text-emerald-600",
                                                                phStatus === 'warning' && "text-amber-600",
                                                                phStatus === 'error' && "text-rose-600",
                                                                phStatus === 'none' && "text-muted-foreground"
                                                            )}>
                                                                {record.ph ?? "N/A"}
                                                            </span>
                                                            {stdPH && <span className="text-[10px] text-muted-foreground">Ref: {stdPH.min}–{stdPH.max}</span>}
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
                                                                        Std: {stdSolids.min}–{stdSolids.max}
                                                                    </span>
                                                                    <span className="text-[10px] text-muted-foreground/80">
                                                                        Tol: {(stdSolids.min! * 0.95).toFixed(2)}–{(stdSolids.max! * 1.05).toFixed(2)}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge className={cn(
                                                            "gap-1.5 shadow-sm px-3 py-1 text-xs font-semibold uppercase tracking-wider rounded-full border-none",
                                                            status === 'success' && "bg-green-600 text-white hover:bg-green-700",
                                                            status === 'warning' && "bg-yellow-500 text-white hover:bg-yellow-600",
                                                            status === 'error' && "bg-[#C1272D] text-white hover:bg-[#A01F25]"
                                                        )}>
                                                            {status === 'success' && <CheckCircle2 className="h-3 w-3" />}
                                                            {status === 'warning' && <AlertCircle className="h-3 w-3" />}
                                                            {status === 'error' && <XCircle className="h-3 w-3" />}
                                                            {status === 'success' ? 'CONFORME' : status === 'warning' ? 'SEMI-CONF' : 'NO CONF'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <div className="flex flex-col items-center">
                                                            <span className="text-sm font-semibold dark:text-slate-200">{record.apariencia || "N/A"}</span>
                                                            {stdApp && <span className="text-[10px] text-muted-foreground">Esp: {stdApp}</span>}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <div className="relative inline-flex">
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50" title="Abrir chat" onClick={e => { e.stopPropagation(); openChat(record) }}>
                                                                <MessageSquare className="h-4 w-4" />
                                                            </Button>
                                                            {(unreadChatCounts.get(String(record.id)) ?? 0) > 0 && (
                                                                <span className="absolute -top-1.5 -right-1.5 min-w-[1.1rem] h-[1.1rem] rounded-full bg-red-500 border border-white dark:border-slate-900 pointer-events-none text-white text-[9px] font-bold flex items-center justify-center px-0.5">
                                                                    {(unreadChatCounts.get(String(record.id)) ?? 0) > 9 ? '9+' : unreadChatCounts.get(String(record.id))}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        {record.observaciones ? (
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50" title="Ver observaciones" onClick={e => { e.stopPropagation(); setObsRecord(record) }}>
                                                                <StickyNote className="h-4 w-4" />
                                                            </Button>
                                                        ) : (
                                                            <span className="text-muted-foreground text-xs">—</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right text-sm text-muted-foreground">
                                                        {new Date(record.fecha_fabricacion).toLocaleDateString()}
                                                    </TableCell>
                                                    {isAdmin && (
                                                        <TableCell className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                                            {record.nombre_preparador || "N/A"}
                                                        </TableCell>
                                                    )}
                                                    {isAdmin && (
                                                        <TableCell className="text-right pr-6">
                                                            <div className="flex justify-end gap-2">
                                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                                    title="Editar registro"
                                                                    onClick={e => { e.stopPropagation(); setEditingRecord(record); setIsEditDialogOpen(true) }}>
                                                                    <Edit2 className="h-4 w-4" />
                                                                </Button>
                                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                                    title="Eliminar"
                                                                    onClick={e => { e.stopPropagation(); requestDelete(record.id, record.lote_producto) }}>
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        </TableCell>
                                                    )}
                                                </TableRow>
                                                {isExpanded && (
                                                    <TableRow className="bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                                                        <TableCell colSpan={isAdmin ? 12 : 10} className="p-0">
                                                            <div className="p-6 grid grid-cols-1 lg:grid-cols-4 gap-4">
                                                                {/* Mediciones de Sólidos + Temperatura */}
                                                                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-3 space-y-2">
                                                                    <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                                                                        <Droplet className="h-3 w-3" /> Mediciones de Sólidos
                                                                    </p>
                                                                    <div className="grid grid-cols-2 gap-2">
                                                                        <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-2">
                                                                            <p className="text-[9px] text-muted-foreground uppercase">Medición 1</p>
                                                                            <p className="text-base font-black text-slate-800 dark:text-slate-100">{record.solidos_medicion_1 !== null ? `${record.solidos_medicion_1}%` : '—'}</p>
                                                                            <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                                                                <Thermometer className="h-2.5 w-2.5" /> {record.temp_med1 ?? '—'}°C
                                                                            </p>
                                                                        </div>
                                                                        <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-2">
                                                                            <p className="text-[9px] text-muted-foreground uppercase">Medición 2</p>
                                                                            <p className="text-base font-black text-slate-800 dark:text-slate-100">{record.solidos_medicion_2 !== null ? `${record.solidos_medicion_2}%` : '—'}</p>
                                                                            <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                                                                <Thermometer className="h-2.5 w-2.5" /> {record.temp_med2 ?? '—'}°C
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 dark:border-slate-800">
                                                                        <span className="text-[10px] font-semibold text-muted-foreground">Promedio</span>
                                                                        <span className="text-sm font-black text-blue-700 dark:text-blue-400">{avgSolids !== null ? `${avgSolids.toFixed(2)}%` : '—'}</span>
                                                                    </div>
                                                                    {stdSolids && (
                                                                        <div className="flex flex-col gap-1 pt-1">
                                                                            <span className="text-[9px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded text-center">
                                                                                Std: {stdSolids.min}–{stdSolids.max}%
                                                                            </span>
                                                                            <span className="text-[9px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded text-center">
                                                                                Tol: {(stdSolids.min! * 0.95).toFixed(2)}–{(stdSolids.max! * 1.05).toFixed(2)}%
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* Info adicional: pH, Color, Aroma, Apariencia */}
                                                                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-3 space-y-2">
                                                                    <p className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                                                                        <Palette className="h-3 w-3" /> Características del Lote
                                                                    </p>
                                                                    <div className="space-y-1.5 text-xs">
                                                                        <div className="flex justify-between"><span className="text-muted-foreground">pH</span><span className="font-semibold">{record.ph ?? 'N/A'}</span></div>
                                                                        <div className="flex justify-between"><span className="text-muted-foreground">Apariencia</span><span className="font-semibold">{record.apariencia || 'N/A'}</span></div>
                                                                        <div className="flex justify-between"><span className="text-muted-foreground">Color</span><span className="font-semibold">{record.color || 'N/A'}</span></div>
                                                                        <div className="flex justify-between items-center"><span className="text-muted-foreground flex items-center gap-1"><Wind className="h-2.5 w-2.5" /> Aroma</span><span className="font-semibold">{record.aroma || 'N/A'}</span></div>
                                                                    </div>
                                                                    <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800">
                                                                        <p className="text-[9px] text-muted-foreground uppercase mb-1">Observaciones</p>
                                                                        <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                                                                            {record.observaciones || '— Sin observaciones —'}
                                                                        </p>
                                                                    </div>
                                                                </div>

                                                                {/* Chat inline */}
                                                                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 flex flex-col lg:col-span-2">
                                                                    <div className="flex items-center justify-between mb-2">
                                                                        <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                                                                            <MessageSquare className="h-3.5 w-3.5" /> Chat del Lote
                                                                        </p>
                                                                        <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px] text-blue-600" onClick={e => { e.stopPropagation(); openChat(record) }}>
                                                                            Abrir completo
                                                                        </Button>
                                                                    </div>
                                                                    <div className="flex-1 max-h-56 overflow-y-auto space-y-2 pr-1">
                                                                        {expandedChatLoading ? (
                                                                            <div className="flex items-center justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
                                                                        ) : expandedChatMsgs.length === 0 ? (
                                                                            <p className="text-xs text-muted-foreground text-center py-6">Sin mensajes en este lote.</p>
                                                                        ) : (
                                                                            expandedChatMsgs.map(msg => {
                                                                                const isMe = msg.author_user_id === user?.id
                                                                                const label = isMe ? 'Tú' : msg.author_name
                                                                                const initials = (label || 'U').charAt(0).toUpperCase()
                                                                                return (
                                                                                    <div key={msg.id} className="flex items-start gap-2 text-xs bg-slate-50 dark:bg-slate-800 rounded-lg p-2">
                                                                                        <div className={cn(
                                                                                            "h-6 w-6 rounded-full shrink-0 overflow-hidden flex items-center justify-center text-[10px] font-bold mt-0.5",
                                                                                            isMe ? "bg-blue-200 text-blue-700" : "bg-slate-300 dark:bg-slate-600 text-slate-700 dark:text-slate-200"
                                                                                        )}>
                                                                                            {msg.author_avatar
                                                                                                ? <img src={msg.author_avatar} alt={label} className="h-full w-full object-cover" />
                                                                                                : initials}
                                                                                        </div>
                                                                                        <div className="min-w-0">
                                                                                            <p className={cn("font-semibold", isMe ? "text-blue-700 dark:text-blue-400" : "text-slate-700 dark:text-slate-300")}>{label}</p>
                                                                                            <p className="text-slate-600 dark:text-slate-400 break-words">{msg.message}</p>
                                                                                        </div>
                                                                                    </div>
                                                                                )
                                                                            })
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                                </Fragment>
                                            )
                                        }) : (
                                            <TableRow>
                                                <TableCell colSpan={isAdmin ? 12 : 10} className="h-24 text-center text-muted-foreground">
                                                    No se encontraron registros.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-between mt-4 px-1">
                                    <p className="text-xs text-slate-500">
                                        Mostrando {currentPage * PAGE_SIZE + 1}–{Math.min((currentPage + 1) * PAGE_SIZE, filteredRecords.length)} de {filteredRecords.length} registros
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline" size="sm"
                                            onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                                            disabled={currentPage === 0}
                                            className="h-8 px-3 text-xs"
                                        >
                                            ← Anterior
                                        </Button>
                                        <span className="text-xs font-semibold text-slate-600 min-w-[80px] text-center">
                                            Página {currentPage + 1} / {totalPages}
                                        </span>
                                        <Button
                                            variant="outline" size="sm"
                                            onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                                            disabled={currentPage === totalPages - 1}
                                            className="h-8 px-3 text-xs"
                                        >
                                            Siguiente →
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Mobile */}
                            <div className="md:hidden space-y-4">
                                {filteredRecords.length > 0 ? paginatedRecords.map(record => {
                                    const status = getStatusInfo(record)
                                    const avgSolids = record.solidos_medicion_1 !== null && record.solidos_medicion_2 !== null
                                        ? (record.solidos_medicion_1 + record.solidos_medicion_2) / 2 : null
                                    const stdSolids = PRODUCT_STANDARDS[record.codigo_producto]
                                    const stdPH = PH_STANDARDS[record.codigo_producto]
                                    const isExpandedMobile = expandedRowId === record.id

                                    return (
                                        <div key={record.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                                            <div className="p-4 space-y-4 cursor-pointer" onClick={() => toggleExpandRow(record)}>
                                                <div className="flex items-start justify-between">
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            {isExpandedMobile ? <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />}
                                                            <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">Lote</span>
                                                            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{record.lote_producto}</span>
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-base leading-tight text-slate-800 dark:text-slate-100">{record.codigo_producto}</span>
                                                            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{record.sucursal} • {new Date(record.fecha_fabricacion).toLocaleDateString()}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-2">
                                                        <Badge className={cn("px-2 py-0.5 text-[10px] font-bold rounded-full border-none",
                                                            status === 'success' && "bg-green-600 text-white",
                                                            status === 'warning' && "bg-yellow-500 text-white",
                                                            status === 'error' && "bg-[#C1272D] text-white"
                                                        )}>
                                                            {status === 'success' ? 'CONFORME' : status === 'warning' ? 'SEMI' : 'NO CONF.'}
                                                        </Badge>
                                                        <div className="flex gap-1 mt-1">
                                                            <div className="relative inline-flex">
                                                                <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={e => { e.stopPropagation(); openChat(record) }} title="Chat">
                                                                    <MessageSquare className="h-3.5 w-3.5 text-blue-600" />
                                                                </Button>
                                                                {(unreadChatCounts.get(String(record.id)) ?? 0) > 0 && (
                                                                    <span className="absolute -top-1.5 -right-1.5 min-w-[1.1rem] h-[1.1rem] rounded-full bg-red-500 border border-white dark:border-slate-900 pointer-events-none text-white text-[9px] font-bold flex items-center justify-center px-0.5">
                                                                        {(unreadChatCounts.get(String(record.id)) ?? 0) > 9 ? '9+' : unreadChatCounts.get(String(record.id))}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {record.observaciones && (
                                                                <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={e => { e.stopPropagation(); setObsRecord(record) }} title="Ver observaciones">
                                                                    <StickyNote className="h-3.5 w-3.5 text-amber-600" />
                                                                </Button>
                                                            )}
                                                            {isAdmin && (
                                                                <>
                                                                    <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={e => { e.stopPropagation(); setEditingRecord(record); setIsEditDialogOpen(true) }}>
                                                                        <Edit2 className="h-3.5 w-3.5 text-blue-600" />
                                                                    </Button>
                                                                    <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={e => { e.stopPropagation(); requestDelete(record.id, record.lote_producto) }}>
                                                                        <Trash2 className="h-3.5 w-3.5 text-red-600" />
                                                                    </Button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-50 dark:border-slate-800">
                                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl flex flex-col items-center">
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase mb-1">pH</span>
                                                        <span className="font-bold text-sm">{record.ph ?? "N/A"}</span>
                                                        {stdPH && <span className="text-[8px] text-muted-foreground">Ref: {stdPH.min}–{stdPH.max}</span>}
                                                    </div>
                                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl flex flex-col items-center">
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase mb-1">% Sólidos</span>
                                                        <span className="font-bold text-sm">{avgSolids !== null ? avgSolids.toFixed(2) + "%" : "N/A"}</span>
                                                        {stdSolids && <span className="text-[8px] text-muted-foreground text-center">Std: {stdSolids.min}–{stdSolids.max}</span>}
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between text-[11px] pt-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-slate-400 uppercase text-[9px]">Apariencia:</span>
                                                        <span className="font-medium text-slate-700 dark:text-slate-300">{record.apariencia || "N/A"}</span>
                                                    </div>
                                                    {isAdmin && (
                                                        <div className="flex items-center gap-1">
                                                            <span className="font-bold text-slate-400 uppercase text-[9px]">Prep:</span>
                                                            <span className="font-medium text-slate-700 dark:text-slate-300">{record.nombre_preparador?.split(' ')[0] || "N/A"}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {isExpandedMobile && (
                                                <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-4 space-y-3">
                                                    {/* Mediciones de Sólidos */}
                                                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-3 space-y-2">
                                                        <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                                                            <Droplet className="h-3 w-3" /> Mediciones de Sólidos
                                                        </p>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-2">
                                                                <p className="text-[9px] text-muted-foreground uppercase">Medición 1</p>
                                                                <p className="text-base font-black text-slate-800 dark:text-slate-100">{record.solidos_medicion_1 !== null ? `${record.solidos_medicion_1}%` : '—'}</p>
                                                                <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                                                    <Thermometer className="h-2.5 w-2.5" /> {record.temp_med1 ?? '—'}°C
                                                                </p>
                                                            </div>
                                                            <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-2">
                                                                <p className="text-[9px] text-muted-foreground uppercase">Medición 2</p>
                                                                <p className="text-base font-black text-slate-800 dark:text-slate-100">{record.solidos_medicion_2 !== null ? `${record.solidos_medicion_2}%` : '—'}</p>
                                                                <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                                                    <Thermometer className="h-2.5 w-2.5" /> {record.temp_med2 ?? '—'}°C
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 dark:border-slate-800">
                                                            <span className="text-[10px] font-semibold text-muted-foreground">Promedio</span>
                                                            <span className="text-sm font-black text-blue-700 dark:text-blue-400">{avgSolids !== null ? `${avgSolids.toFixed(2)}%` : '—'}</span>
                                                        </div>
                                                        {stdSolids && (
                                                            <div className="flex gap-1.5 pt-1">
                                                                <span className="flex-1 text-[9px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded text-center">
                                                                    Std: {stdSolids.min}–{stdSolids.max}%
                                                                </span>
                                                                <span className="flex-1 text-[9px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded text-center">
                                                                    Tol: {(stdSolids.min! * 0.95).toFixed(2)}–{(stdSolids.max! * 1.05).toFixed(2)}%
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Características del Lote */}
                                                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-3 space-y-2">
                                                        <p className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                                                            <Palette className="h-3 w-3" /> Características del Lote
                                                        </p>
                                                        <div className="space-y-1.5 text-xs">
                                                            <div className="flex justify-between"><span className="text-muted-foreground">pH</span><span className="font-semibold">{record.ph ?? 'N/A'}</span></div>
                                                            <div className="flex justify-between"><span className="text-muted-foreground">Apariencia</span><span className="font-semibold">{record.apariencia || 'N/A'}</span></div>
                                                            <div className="flex justify-between"><span className="text-muted-foreground">Color</span><span className="font-semibold">{record.color || 'N/A'}</span></div>
                                                            <div className="flex justify-between items-center"><span className="text-muted-foreground flex items-center gap-1"><Wind className="h-2.5 w-2.5" /> Aroma</span><span className="font-semibold">{record.aroma || 'N/A'}</span></div>
                                                        </div>
                                                        <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800">
                                                            <p className="text-[9px] text-muted-foreground uppercase mb-1">Observaciones</p>
                                                            <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                                                                {record.observaciones || '— Sin observaciones —'}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {/* Chat inline */}
                                                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-3 flex flex-col">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                                                                <MessageSquare className="h-3 w-3" /> Chat del Lote
                                                            </p>
                                                            <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px] text-blue-600" onClick={e => { e.stopPropagation(); openChat(record) }}>
                                                                Abrir completo
                                                            </Button>
                                                        </div>
                                                        <div className="max-h-44 overflow-y-auto space-y-2 pr-1">
                                                            {expandedChatLoading ? (
                                                                <div className="flex items-center justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
                                                            ) : expandedChatMsgs.length === 0 ? (
                                                                <p className="text-xs text-muted-foreground text-center py-6">Sin mensajes en este lote.</p>
                                                            ) : (
                                                                expandedChatMsgs.map(msg => {
                                                                    const isMe = msg.author_user_id === user?.id
                                                                    const label = isMe ? 'Tú' : msg.author_name
                                                                    const initials = (label || 'U').charAt(0).toUpperCase()
                                                                    return (
                                                                        <div key={msg.id} className="flex items-start gap-2 text-xs bg-slate-50 dark:bg-slate-800 rounded-lg p-2">
                                                                            <div className={cn(
                                                                                "h-6 w-6 rounded-full shrink-0 overflow-hidden flex items-center justify-center text-[10px] font-bold mt-0.5",
                                                                                isMe ? "bg-blue-200 text-blue-700" : "bg-slate-300 dark:bg-slate-600 text-slate-700 dark:text-slate-200"
                                                                            )}>
                                                                                {msg.author_avatar
                                                                                    ? <img src={msg.author_avatar} alt={label} className="h-full w-full object-cover" />
                                                                                    : initials}
                                                                            </div>
                                                                            <div className="min-w-0">
                                                                                <p className={cn("font-semibold", isMe ? "text-blue-700 dark:text-blue-400" : "text-slate-700 dark:text-slate-300")}>{label}</p>
                                                                                <p className="text-slate-600 dark:text-slate-400 break-words">{msg.message}</p>
                                                                            </div>
                                                                        </div>
                                                                    )
                                                                })
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )
                                }) : (
                                    <div className="p-8 text-center text-muted-foreground bg-slate-50 dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                                        No se encontraron registros.
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* ── Observations Dialog ── */}
            <Dialog open={!!obsRecord} onOpenChange={open => { if (!open) setObsRecord(null) }}>
                <DialogContent className="sm:max-w-[480px] sm:rounded-[2rem]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <StickyNote className="h-5 w-5 text-amber-500" />
                            Observaciones adicionales
                        </DialogTitle>
                        <DialogDescription>
                            Lote <strong>{obsRecord?.lote_producto}</strong> · {obsRecord?.codigo_producto}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="mt-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                        {obsRecord?.observaciones || '—'}
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── Catálogo de Parámetros (PDF) Dialog ── */}
            <Dialog open={catalogOpen} onOpenChange={setCatalogOpen}>
                <DialogContent className="sm:max-w-4xl w-[95vw] h-[90vh] sm:rounded-[1.5rem] flex flex-col p-4">
                    <DialogHeader>
                        <div className="flex items-start justify-between gap-4 pr-6">
                            <div>
                                <DialogTitle className="flex items-center gap-2">
                                    <BookOpen className="h-5 w-5 text-[#0e0c9b]" />
                                    Catálogo de Parámetros — Productos Terminados
                                </DialogTitle>
                                <DialogDescription>
                                    Consulta de rangos y especificaciones técnicas por producto
                                </DialogDescription>
                            </div>
                            <Button asChild variant="outline" size="sm" className="gap-2 shrink-0">
                                <a href={`${getBasePath()}/CATALOGO_PT_GINEZ-2026-compressed.pdf`} target="_blank" rel="noopener noreferrer">
                                    Abrir en pestaña nueva
                                </a>
                            </Button>
                        </div>
                    </DialogHeader>
                    <div className="flex-1 overflow-hidden">
                        {catalogOpen && <PdfViewer url={`${getBasePath()}/CATALOGO_PT_GINEZ-2026-compressed.pdf`} />}
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── Edit Dialog ── */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="sm:max-w-[500px] sm:rounded-[2rem]">
                    <DialogHeader>
                        <DialogTitle>Editar Registro de Calidad</DialogTitle>
                        <DialogDescription>
                            Lote <strong>{editingRecord?.lote_producto}</strong> · {editingRecord?.codigo_producto}
                        </DialogDescription>
                    </DialogHeader>
                    {editingRecord && (
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <UILabel htmlFor="fecha_fabricacion" className="text-right text-xs">Fecha fab.</UILabel>
                                <Input
                                    id="fecha_fabricacion"
                                    type="date"
                                    value={editingRecord.fecha_fabricacion?.split('T')[0] ?? ''}
                                    onChange={e => {
                                        const newDate = e.target.value
                                        if (!newDate) return
                                        const newDatePart = newDate.replace(/-/g, '').slice(2)
                                        const parts = (editingRecord.lote_producto || '').split('-')
                                        const newLote = parts.length >= 4 ? [newDatePart, ...parts.slice(1)].join('-') : editingRecord.lote_producto
                                        setEditingRecord({ ...editingRecord, fecha_fabricacion: newDate, lote_producto: newLote })
                                    }}
                                    className="col-span-3"
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <UILabel className="text-right text-xs">No. Lote</UILabel>
                                <Input
                                    value={editingRecord.lote_producto ?? ''}
                                    readOnly
                                    className="col-span-3 bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 cursor-default"
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <UILabel htmlFor="ph" className="text-right text-xs">pH</UILabel>
                                <Input id="ph" type="number" step="0.1" value={editingRecord.ph ?? ""} onChange={e => setEditingRecord({ ...editingRecord, ph: parseFloat(e.target.value) || null })} className="col-span-3" />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <UILabel htmlFor="s1" className="text-right text-xs">Sólidos M1</UILabel>
                                <Input id="s1" type="number" step="0.01" value={editingRecord.solidos_medicion_1 ?? ""} onChange={e => setEditingRecord({ ...editingRecord, solidos_medicion_1: parseFloat(e.target.value) || null })} className="col-span-3" />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <UILabel htmlFor="s2" className="text-right text-xs">Sólidos M2</UILabel>
                                <Input id="s2" type="number" step="0.01" value={editingRecord.solidos_medicion_2 ?? ""} onChange={e => setEditingRecord({ ...editingRecord, solidos_medicion_2: parseFloat(e.target.value) || null })} className="col-span-3" />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <UILabel htmlFor="apariencia" className="text-right text-xs">Apariencia</UILabel>
                                <Input id="apariencia" value={editingRecord.apariencia || ""} onChange={e => setEditingRecord({ ...editingRecord, apariencia: e.target.value })} className="col-span-3" />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <UILabel htmlFor="color" className="text-right text-xs">Color</UILabel>
                                <Input id="color" value={editingRecord.color || ""} onChange={e => setEditingRecord({ ...editingRecord, color: e.target.value })} className="col-span-3" />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <UILabel htmlFor="aroma" className="text-right text-xs">Aroma</UILabel>
                                <Input id="aroma" value={editingRecord.aroma || ""} onChange={e => setEditingRecord({ ...editingRecord, aroma: e.target.value })} className="col-span-3" />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <UILabel htmlFor="tamano_lote" className="text-right text-xs">Tamaño lote</UILabel>
                                <Input id="tamano_lote" type="number" step="1" min="0" value={editingRecord.tamano_lote ?? ""} onChange={e => setEditingRecord({ ...editingRecord, tamano_lote: parseFloat(e.target.value) || undefined })} className="col-span-3" placeholder="ej. 500" />
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleEditSave} disabled={isUpdating}>
                            {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Guardar Cambios
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Export Dialog ── */}
            <Dialog open={exportOpen} onOpenChange={setExportOpen}>
                <DialogContent className="sm:max-w-[500px] sm:rounded-[2rem]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Download className="h-5 w-5 text-blue-600" />
                            Exportar Mediciones
                        </DialogTitle>
                        <DialogDescription>
                            Selecciona el rango de fechas. Si lo dejas vacío, se exporta todo el historial disponible.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-2">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <UILabel className="text-right text-xs col-span-1">Desde</UILabel>
                            <Input
                                type="date"
                                value={exportDateFrom}
                                onChange={e => setExportDateFrom(e.target.value)}
                                className="col-span-3"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <UILabel className="text-right text-xs col-span-1">Hasta</UILabel>
                            <Input
                                type="date"
                                value={exportDateTo}
                                onChange={e => setExportDateTo(e.target.value)}
                                className="col-span-3"
                            />
                        </div>
                    </div>
                    <DialogFooter className="flex-col sm:flex-row gap-2">
                        <Button variant="outline" onClick={() => setExportOpen(false)} disabled={exporting}>
                            Cancelar
                        </Button>
                        <Button variant="outline" onClick={handleExportCsv} disabled={exporting} className="gap-2">
                            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                            Descargar CSV
                        </Button>
                        <Button onClick={handleExportXlsx} disabled={exporting} className="gap-2 bg-green-600 hover:bg-green-700 text-white">
                            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                            Descargar Excel
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Chat Dialog ── */}
            <Dialog open={chatOpen} onOpenChange={setChatOpen}>
                <DialogContent className="sm:max-w-[480px] sm:rounded-[2rem] flex flex-col" style={{ height: '600px' }}>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <MessageSquare className="h-5 w-5 text-blue-600" />
                            Chat — {chatRecord?.lote_producto}
                        </DialogTitle>
                        <DialogDescription>
                            {chatRecord?.codigo_producto} · {chatRecord?.sucursal}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto space-y-3 py-2 pr-1 min-h-0">
                        {chatLoading ? (
                            <div className="flex items-center justify-center h-full">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : chatMessages.length === 0 ? (
                            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                                Sin mensajes aún. ¡Sé el primero en escribir!
                            </div>
                        ) : (
                            chatMessages.map(msg => {
                                const isMe = msg.author_user_id === profile?.id
                                const avatarUrl = isMe ? (profile as any)?.avatar_url : msg.author_avatar
                                const initials = (msg.author_name || 'U').charAt(0).toUpperCase()
                                const avatar = (
                                    <div className={cn(
                                        "h-7 w-7 rounded-full shrink-0 overflow-hidden flex items-center justify-center text-[11px] font-bold",
                                        isMe ? "bg-blue-200 text-blue-700" : "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300"
                                    )}>
                                        {avatarUrl
                                            ? <img src={avatarUrl} alt={msg.author_name} className="h-full w-full object-cover" />
                                            : initials}
                                    </div>
                                )
                                return (
                                    <div key={msg.id} className={cn("flex items-end gap-2", isMe ? "flex-row-reverse" : "flex-row")}>
                                        {avatar}
                                        <div className={cn("flex flex-col max-w-[75%]", isMe ? "items-end" : "items-start")}>
                                            <span className="text-[10px] text-muted-foreground mb-0.5 px-1">{msg.author_name}</span>
                                            <div className={cn(
                                                "rounded-2xl px-3 py-2 text-sm",
                                                isMe ? "bg-blue-600 text-white rounded-br-sm" : "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-bl-sm"
                                            )}>
                                                {msg.message}
                                            </div>
                                            <span className="text-[9px] text-muted-foreground mt-0.5 px-1">
                                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                        <div ref={chatEndRef} />
                    </div>
                    <div className="flex gap-2 pt-2 border-t">
                        <Input
                            placeholder="Escribe un mensaje..."
                            value={newChatMsg}
                            onChange={e => setNewChatMsg(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage() } }}
                            className="flex-1 rounded-xl"
                            disabled={sendingChat || chatLoading}
                        />
                        <Button size="icon" onClick={sendChatMessage} disabled={sendingChat || !newChatMsg.trim() || chatLoading} className="rounded-xl bg-blue-600 hover:bg-blue-700">
                            {sendingChat ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
