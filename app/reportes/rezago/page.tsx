"use client"

import { useState, useEffect, useRef } from "react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/AuthProvider"
import { supabase } from "@/lib/supabase"
import { useRangoFechas } from "@/lib/use-rango-fechas"
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

    const rango = useRangoFechas(90)

    /** Ver la nota en app/reportes/fy/page.tsx: sin esto, la consulta más lenta
     *  pisa a la más nueva. */
    const peticion = useRef(0)

    useEffect(() => {
        if (!authLoading && profile) {
            if (!profile.is_admin && !ALLOWED_ROLES.includes(role)) {
                toast.error("Acceso restringido")
                router.push('/')
            }
        }
    }, [profile, authLoading, role, router])

    const fetchData = async (from?: string, to?: string) => {
        const miPeticion = ++peticion.current
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
            if (miPeticion !== peticion.current) return
            if (error) throw error
            setRecords(data || [])
        } catch (err: any) {
            if (miPeticion !== peticion.current) return
            toast.error("Error al cargar datos", { description: err.message })
        } finally {
            if (miPeticion === peticion.current) setLoading(false)
        }
    }

    useEffect(() => {
        if (user && profile) fetchData(rango.aplicado.desde, rango.aplicado.hasta)
        else if (!authLoading) setLoading(false)
    }, [user?.id, profile?.role, authLoading, rango.aplicado])

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
                        value={rango.desdeEditado}
                        onChange={e => rango.editarDesde(e.target.value)}
                        className="text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                    />
                    <span className="text-slate-400 text-sm">—</span>
                    <input
                        type="date"
                        value={rango.hastaEditado}
                        onChange={e => rango.editarHasta(e.target.value)}
                        className="text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                    />
                    {rango.esPersonalizado ? (
                        <button
                            onClick={() => rango.ultimosDias(90)}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                            title="Limpiar"
                        >
                            <XCircle className="h-4 w-4" />
                        </button>
                    ) : null}
                </div>
                <div className="flex gap-2 ml-auto">
                    <Button size="sm" variant={rango.esUltimos30 ? "default" : "outline"} className="rounded-full text-xs"
                        onClick={() => rango.ultimosDias(30)}>
                        Últimos 30 días
                    </Button>
                    <Button size="sm" variant={rango.esUltimos90 ? "default" : "outline"} className="rounded-full text-xs"
                        onClick={() => rango.ultimosDias(90)}>
                        Últimos 90 días
                    </Button>
                </div>
            </div>

            {loading && records.length === 0 ? (
                <div className="h-64 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
            ) : (
                <div className="relative">
                    {loading && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/60 dark:bg-slate-950/60">
                            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                        </div>
                    )}
                    <div className={loading ? "opacity-40 pointer-events-none" : undefined}>
                        <CaptureLagPanel records={records} />
                    </div>
                </div>
            )}
        </div>
    )
}
