"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/AuthProvider"
import { supabase } from "@/lib/supabase"
import { Loader2, XCircle, Clock } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Breadcrumbs } from "@/components/Breadcrumbs"

const CaptureLagPanel = dynamic(() => import("../components/CaptureLagPanel"), {
    ssr: false,
    loading: () => (
        <div className="h-64 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
    ),
})

// Métrica de supervisión: no se expone a preparadores
const ALLOWED_ROLES = [
    'admin', 'gerente_calidad', 'coordinador',
    'director_operaciones', 'director_compras',
    'gerente_sucursal', 'gerente',
]

export default function RezagoPage() {
    const { user, profile, loading: authLoading } = useAuth()
    const router = useRouter()
    const [records, setRecords] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    const role = (profile?.role || '').toLowerCase()
    const isGerente = role === 'gerente_sucursal' || role === 'gerente'

    const [filterDateFrom, setFilterDateFrom] = useState(() => {
        const d = new Date(); d.setDate(d.getDate() - 90)
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

    const fetchData = async (from?: string, to?: string) => {
        setLoading(true)
        try {
            // Solo lo indispensable para calcular el rezago — payload mínimo
            let query = supabase
                .from('bitacora_produccion_calidad')
                .select('sucursal, nombre_preparador, fecha_fabricacion, created_at')
            if (isGerente && profile?.sucursal) query = query.eq('sucursal', profile.sucursal)
            if (from) query = query.gte('fecha_fabricacion', from)
            if (to) query = query.lte('fecha_fabricacion', to + 'T23:59:59')
            const { data, error } = await query
            if (error) throw error
            setRecords(data || [])
        } catch (err: any) {
            toast.error("Error al cargar datos", { description: err.message })
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (user && profile) fetchData(filterDateFrom || undefined, filterDateTo || undefined)
        else if (!authLoading) setLoading(false)
    }, [user?.id, profile?.role, authLoading, filterDateFrom, filterDateTo])

    const today = new Date().toISOString().split('T')[0]
    const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0] }
    const is30 = filterDateFrom === daysAgo(30) && filterDateTo === today
    const is90 = filterDateFrom === daysAgo(90) && filterDateTo === today
    const isCustom = !is30 && !is90 && (filterDateFrom || filterDateTo)

    return (
        <div className="space-y-6 pb-12">
            <Breadcrumbs items={[{ label: "Reportes" }, { label: "Rezago de Captura" }]} />

            <div className="flex items-center gap-3 mb-2">
                <Clock className="h-6 w-6 text-blue-600" />
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Rezago de Captura</h1>
                    <p className="text-sm text-muted-foreground">
                        Cuánto tardan las sucursales en registrar un lote después de fabricarlo
                    </p>
                </div>
            </div>

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
                    {isCustom ? (
                        <button
                            onClick={() => { setFilterDateFrom(daysAgo(90)); setFilterDateTo(today) }}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                            title="Limpiar"
                        >
                            <XCircle className="h-4 w-4" />
                        </button>
                    ) : null}
                </div>
                <div className="flex gap-2 ml-auto">
                    <Button size="sm" variant={is30 ? "default" : "outline"} className="rounded-full text-xs"
                        onClick={() => { setFilterDateFrom(daysAgo(30)); setFilterDateTo(today) }}>
                        Últimos 30 días
                    </Button>
                    <Button size="sm" variant={is90 ? "default" : "outline"} className="rounded-full text-xs"
                        onClick={() => { setFilterDateFrom(daysAgo(90)); setFilterDateTo(today) }}>
                        Últimos 90 días
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="h-64 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
            ) : (
                <CaptureLagPanel records={records} />
            )}
        </div>
    )
}
