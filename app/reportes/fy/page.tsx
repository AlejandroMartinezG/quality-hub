"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/AuthProvider"
import { supabase } from "@/lib/supabase"
import { analyzeRecord, type EnrichedRecord } from "@/lib/analysis-utils"
import { Loader2, XCircle, Activity } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import dynamic from "next/dynamic"

const SPYReportPage = dynamic(() => import("../spy/SPYReportPage"), { ssr: false })

const ALLOWED_ROLES = [
    'admin', 'gerente_calidad', 'coordinador',
    'director_operaciones', 'director_compras',
    'preparador', 'gerente_sucursal', 'gerente',
]

export default function FTQPage() {
    const { user, profile, loading: authLoading } = useAuth()
    const router = useRouter()
    const [records, setRecords] = useState<EnrichedRecord[]>([])
    const [loading, setLoading] = useState(true)

    const role = profile?.role?.toLowerCase() || ''
    const isPreparador = role === 'preparador'
    const isGerente = role === 'gerente_sucursal' || role === 'gerente'

    const [filterDateFrom, setFilterDateFrom] = useState(() => {
        const d = new Date()
        d.setDate(d.getDate() - 30)
        return d.toISOString().split('T')[0]
    })
    const [filterDateTo, setFilterDateTo] = useState(() => new Date().toISOString().split('T')[0])

    useEffect(() => {
        if (!authLoading && profile) {
            if (!profile.is_admin && !ALLOWED_ROLES.includes(role)) {
                toast.error("Acceso restringido")
                router.push('/')
            }
        }
    }, [profile, authLoading, role, router])

    const fetchData = useCallback(async (from?: string, to?: string) => {
        if (!user) return
        setLoading(true)
        try {
            let query = supabase.from('bitacora_produccion_calidad').select('*')
            if (isPreparador) {
                query = query.eq('user_id', user.id)
            } else if (isGerente && profile?.sucursal) {
                query = query.eq('sucursal', profile.sucursal)
            }
            if (from) query = query.gte('fecha_fabricacion', from)
            if (to) query = query.lte('fecha_fabricacion', to + 'T23:59:59')
            const { data, error } = await query.order('created_at', { ascending: true })
            if (error) throw error
            setRecords((data || []).map(analyzeRecord))
        } catch {
            toast.error("Error al cargar datos")
        } finally {
            setLoading(false)
        }
    }, [user, isPreparador, isGerente, profile?.sucursal])

    useEffect(() => {
        if (user && !authLoading) {
            fetchData(filterDateFrom, filterDateTo)
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id, profile?.role, authLoading])

    useEffect(() => {
        if (user && !authLoading) {
            fetchData(filterDateFrom, filterDateTo)
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filterDateFrom, filterDateTo])

    const today = new Date().toISOString().split('T')[0]
    const thirtyDaysAgo = (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0] })()
    const ninetyDaysAgo = (() => { const d = new Date(); d.setDate(d.getDate() - 90); return d.toISOString().split('T')[0] })()

    const is30Days = filterDateFrom === thirtyDaysAgo && filterDateTo === today
    const is90Days = filterDateFrom === ninetyDaysAgo && filterDateTo === today
    const isCustom = !is30Days && !is90Days && (filterDateFrom || filterDateTo)

    if (authLoading) {
        return (
            <div className="h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        )
    }

    return (
        <div className="space-y-6 pb-12">
            {/* Header */}
            <div className="flex items-center gap-3 mb-2">
                <Activity className="h-6 w-6 text-blue-600" />
                <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                    Control de Calidad (FTQ/FY)
                </h1>
            </div>

            {/* Date Range Selector */}
            <div className="flex flex-wrap items-center gap-3 p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700">
                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Período:</span>

                <div className="flex items-center gap-2">
                    <input
                        type="date"
                        value={filterDateFrom}
                        onChange={e => setFilterDateFrom(e.target.value)}
                        className="text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                    />
                    <span className="text-slate-400 text-sm">—</span>
                    <input
                        type="date"
                        value={filterDateTo}
                        onChange={e => setFilterDateTo(e.target.value)}
                        className="text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                    />
                    {isCustom && (
                        <button
                            onClick={() => { setFilterDateFrom(thirtyDaysAgo); setFilterDateTo(today) }}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                            title="Limpiar"
                        >
                            <XCircle className="h-4 w-4" />
                        </button>
                    )}
                </div>

                <div className="flex gap-2 ml-auto">
                    <Button
                        size="sm"
                        variant={is30Days ? "default" : "outline"}
                        className="rounded-full text-xs"
                        onClick={() => { setFilterDateFrom(thirtyDaysAgo); setFilterDateTo(today) }}
                    >
                        Últimos 30 días
                    </Button>
                    <Button
                        size="sm"
                        variant={is90Days ? "default" : "outline"}
                        className="rounded-full text-xs"
                        onClick={() => { setFilterDateFrom(ninetyDaysAgo); setFilterDateTo(today) }}
                    >
                        Últimos 90 días
                    </Button>
                    <Button
                        size="sm"
                        variant={!filterDateFrom && !filterDateTo ? "default" : "outline"}
                        className="rounded-full text-xs"
                        onClick={() => { setFilterDateFrom(""); setFilterDateTo("") }}
                    >
                        Todo el historial
                    </Button>
                </div>
            </div>

            {/* Content */}
            {loading ? (
                <div className="h-64 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
            ) : (
                <SPYReportPage records={records} profile={profile} />
            )}
        </div>
    )
}
