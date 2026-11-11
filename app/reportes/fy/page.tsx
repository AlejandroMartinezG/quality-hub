"use client"

import { useState, useEffect, useRef } from "react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/AuthProvider"
import { supabase } from "@/lib/supabase"
import { analyzeRecord } from "@/lib/analysis-utils"
import { useRangoFechas } from "@/lib/use-rango-fechas"
import { Loader2, XCircle, Activity } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SUCURSALES } from "@/lib/production-constants"
// Carga diferida: saca Recharts del bundle inicial y lo descarga en paralelo al fetch de datos
const SPYReportPage = dynamic(() => import("../spy/SPYReportPage"), {
    ssr: false,
    loading: () => (
        <div className="h-64 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
    ),
})

const ALLOWED_ROLES = [
    'admin', 'gerente_calidad', 'coordinador',
    'director_operaciones', 'director_compras',
    'preparador', 'gerente_sucursal', 'gerente',
]

export default function FTQPage() {
    const { user, profile, loading: authLoading } = useAuth()
    const router = useRouter()
    const [records, setRecords] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    const role = (profile?.role || '').toLowerCase()
    const isPreparador = role === 'preparador'
    const isGerente = role === 'gerente_sucursal' || role === 'gerente'

    const [selectedSucursal, setSelectedSucursal] = useState("all")

    const rango = useRangoFechas(30)

    /**
     * Número de la consulta en curso. Sin esto, dos consultas encimadas pintan
     * en el orden en que CONTESTAN, no en el que se pidieron: la más lenta
     * aterriza al final y sobreescribe al resultado correcto.
     */
    const peticion = useRef(0)

    // Access control
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
            let query = supabase.from('bitacora_produccion_calidad').select('id, lote_producto, codigo_producto, nombre_preparador, sucursal, familia_producto, fecha_fabricacion, tamano_lote, created_at, user_id, ph, solidos_medicion_1, solidos_medicion_2, apariencia, estado_calidad')
            if (isPreparador) {
                query = query.eq('user_id', user?.id)
            } else if (isGerente && profile?.sucursal) {
                query = query.eq('sucursal', profile.sucursal)
            }
            if (from) query = query.gte('fecha_fabricacion', from)
            if (to) query = query.lte('fecha_fabricacion', to + 'T23:59:59')
            const { data, error } = await query.order('created_at', { ascending: true })
            if (miPeticion !== peticion.current) return   // llegó tarde: ya hay una más nueva
            if (error) throw error
            setRecords((data || []).map(analyzeRecord))
        } catch (err: any) {
            if (miPeticion !== peticion.current) return
            toast.error("Error al cargar datos", { description: err.message })
        } finally {
            // Apagar el spinner desde una consulta vieja daría la pantalla por
            // lista mientras la buena sigue en camino.
            if (miPeticion === peticion.current) setLoading(false)
        }
    }

    useEffect(() => {
        if (user && profile) {
            fetchData(rango.aplicado.desde, rango.aplicado.hasta)
        } else if (!authLoading) {
            setLoading(false)
        }
    }, [user?.id, profile?.role, authLoading, rango.aplicado])

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
                {!isPreparador && !isGerente && (
                    <Select value={selectedSucursal} onValueChange={setSelectedSucursal}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Todas las sucursales" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todas las sucursales</SelectItem>
                            {SUCURSALES.map((s: string) => (
                                <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}

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
                    {rango.esPersonalizado && (
                        <button
                            onClick={() => rango.ultimosDias(30)}
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
                        variant={rango.esUltimos30 ? "default" : "outline"}
                        className="rounded-full text-xs"
                        onClick={() => rango.ultimosDias(30)}
                    >
                        Últimos 30 días
                    </Button>
                    <Button
                        size="sm"
                        variant={rango.esUltimos90 ? "default" : "outline"}
                        className="rounded-full text-xs"
                        onClick={() => rango.ultimosDias(90)}
                    >
                        Últimos 90 días
                    </Button>
                    <Button
                        size="sm"
                        variant={rango.historial ? "default" : "outline"}
                        className="rounded-full text-xs"
                        onClick={rango.todoElHistorial}
                    >
                        Todo el historial
                    </Button>
                </div>
            </div>

            {/* Content */}
            {loading && records.length === 0 ? (
                <div className="h-64 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
            ) : (
                /* El reporte se mantiene montado mientras recarga. Si se
                   desmonta, vuelve a montarse con sus filtros internos en
                   blanco —parámetro, producto y período— y el usuario pierde
                   en silencio lo que había elegido. */
                <div className="relative">
                    {loading && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/60 dark:bg-slate-950/60">
                            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                        </div>
                    )}
                    <div className={loading ? "opacity-40 pointer-events-none" : undefined}>
                        <SPYReportPage
                            records={selectedSucursal === 'all' ? records : records.filter(r => r.sucursal === selectedSucursal)}
                            profile={profile}
                        />
                    </div>
                </div>
            )}
        </div>
    )
}
