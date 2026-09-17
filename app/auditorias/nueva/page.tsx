"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/AuthProvider"
import { supabase } from "@/lib/supabase"
import { Loader2, ShieldCheck, Search } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Breadcrumbs } from "@/components/Breadcrumbs"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select"
import { SUCURSALES_PRODUCTIVAS } from "@/lib/production-constants"
import { formatFecha } from "@/lib/utils"
import { promedioSolidos } from "@/lib/auditoria-utils"

const ROLES_AUDITORES = ['admin', 'gerente_calidad', 'coordinador']

// Fecha local en YYYY-MM-DD. `toISOString()` devuelve UTC y en México (UTC-6)
// a partir de las 18:00 ya reporta el día siguiente.
const todayISO = () => {
    const d = new Date()
    const mes = String(d.getMonth() + 1).padStart(2, '0')
    const dia = String(d.getDate()).padStart(2, '0')
    return `${d.getFullYear()}-${mes}-${dia}`
}

const COLUMNAS = 'id, lote_producto, codigo_producto, sucursal, fecha_fabricacion, nombre_preparador, tamano_lote, ph, solidos_medicion_1, solidos_medicion_2, apariencia, color, aroma, estado_calidad'

export default function NuevaAuditoriaPage() {
    const { user, profile, loading: authLoading } = useAuth()
    const router = useRouter()

    const [sucursal, setSucursal] = useState("")
    const [fecha, setFecha] = useState(todayISO())
    const [lotes, setLotes] = useState<any[]>([])
    // Los ids de la bitácora son UUID, no enteros.
    const [seleccion, setSeleccion] = useState<Set<string>>(new Set())
    const [filtro, setFiltro] = useState("")
    const [cargando, setCargando] = useState(false)
    const [creando, setCreando] = useState(false)

    const role = (profile?.role || '').toLowerCase()

    useEffect(() => {
        if (!authLoading && profile) {
            if (!profile.is_admin && !ROLES_AUDITORES.includes(role)) {
                toast.error("Acceso restringido", { description: "Solo Calidad puede crear auditorías." })
                router.push('/')
            }
        }
    }, [profile, authLoading, role, router])

    const cargarLotes = async (suc: string) => {
        if (!suc) { setLotes([]); return }
        setCargando(true)
        setSeleccion(new Set())
        try {
            const { data, error } = await supabase
                .from('bitacora_produccion_calidad')
                .select(COLUMNAS)
                .eq('sucursal', suc)
                .order('fecha_fabricacion', { ascending: false })
                .order('created_at', { ascending: false })
                .limit(60)
            if (error) throw error
            setLotes(data || [])
        } catch (err: any) {
            toast.error("Error al cargar lotes", { description: err.message })
        } finally {
            setCargando(false)
        }
    }

    useEffect(() => { cargarLotes(sucursal) }, [sucursal])

    const visibles = useMemo(() => {
        const q = filtro.trim().toUpperCase()
        if (!q) return lotes
        return lotes.filter(l =>
            (l.codigo_producto || '').toUpperCase().includes(q) ||
            (l.lote_producto || '').toUpperCase().includes(q) ||
            (l.nombre_preparador || '').toUpperCase().includes(q)
        )
    }, [lotes, filtro])

    // Los lotes inyectados a mano no traen mediciones del operador: no hay nada
    // contra qué comparar, así que no se pueden auditar.
    const auditable = (l: any) => l.estado_calidad !== 'SIN MEDICION'

    const toggle = (id: string) => {
        setSeleccion(prev => {
            const next = new Set(prev)
            next.has(id) ? next.delete(id) : next.add(id)
            return next
        })
    }

    const toggleTodos = () => {
        const elegibles: string[] = visibles.filter(auditable).map(l => l.id)
        const todosPuestos = elegibles.every(id => seleccion.has(id))
        setSeleccion(todosPuestos ? new Set() : new Set(elegibles))
    }

    const crear = async () => {
        if (!sucursal) { toast.error("Elige una sucursal"); return }
        if (seleccion.size === 0) { toast.error("Selecciona al menos un lote"); return }
        if (!user?.id) { toast.error("Sesión no válida", { description: "Recarga la página." }); return }

        setCreando(true)
        try {
            const { data: auditoria, error: errAud } = await supabase
                .from('auditorias_presenciales')
                .insert({
                    sucursal,
                    fecha_auditoria: fecha,
                    auditor_user_id: user.id,
                    auditor_nombre: profile?.full_name || null,
                    estado: 'EN_PROCESO',
                })
                .select()
                .single()
            if (errAud) throw errAud

            // Se copian los valores del operador: el registro original puede
            // editarse después y el reporte debe conservar lo que decía hoy.
            const elegidos = lotes.filter(l => seleccion.has(l.id))
            const filas = elegidos.map(l => ({
                auditoria_id: auditoria.id,
                measurement_id: l.id,
                lote_producto: l.lote_producto,
                codigo_producto: l.codigo_producto,
                nombre_preparador: l.nombre_preparador,
                fecha_fabricacion: l.fecha_fabricacion,
                tamano_lote: l.tamano_lote,
                ph_operador: l.ph,
                solidos_1_operador: l.solidos_medicion_1,
                solidos_2_operador: l.solidos_medicion_2,
                apariencia_operador: l.apariencia,
                color_operador: l.color,
                aroma_operador: l.aroma,
                resultado: 'PENDIENTE',
            }))

            const { error: errLotes } = await supabase.from('auditoria_lotes').insert(filas)
            if (errLotes) throw errLotes

            toast.success("Auditoría creada", { description: `${filas.length} lote${filas.length === 1 ? '' : 's'} listo${filas.length === 1 ? '' : 's'} para verificar.` })
            router.push(`/auditorias/${auditoria.id}`)
        } catch (err: any) {
            toast.error("No se pudo crear la auditoría", { description: err.message })
            setCreando(false)
        }
    }

    return (
        <div className="space-y-6 pb-32">
            <Breadcrumbs items={[{ label: "Auditorías Presenciales", href: "/auditorias" }, { label: "Nueva" }]} />

            <div className="flex items-center gap-3 mb-2">
                <ShieldCheck className="h-6 w-6 text-blue-600" />
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Nueva auditoría</h1>
                    <p className="text-sm text-muted-foreground">
                        Elige la sucursal y marca los lotes que vas a volver a medir
                    </p>
                </div>
            </div>

            <Card className="border-none shadow-sm dark:bg-slate-900 rounded-[2rem]">
                <CardContent className="p-6 flex flex-wrap gap-4 items-end">
                    <div className="space-y-1.5 min-w-[14rem]">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Sucursal</label>
                        <Select value={sucursal} onValueChange={setSucursal}>
                            <SelectTrigger className="rounded-full">
                                <SelectValue placeholder="Selecciona sucursal" />
                            </SelectTrigger>
                            <SelectContent>
                                {SUCURSALES_PRODUCTIVAS.map(s => (
                                    <SelectItem key={s} value={s}>{s}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Fecha de la visita</label>
                        <input
                            type="date"
                            value={fecha}
                            onChange={e => setFecha(e.target.value)}
                            className="block text-sm border border-slate-300 dark:border-slate-600 rounded-full px-4 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                        />
                    </div>
                    {lotes.length > 0 && (
                        <div className="space-y-1.5 flex-1 min-w-[12rem]">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Buscar</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <input
                                    value={filtro}
                                    onChange={e => setFiltro(e.target.value)}
                                    placeholder="Código, lote o preparador"
                                    className="w-full text-sm border border-slate-300 dark:border-slate-600 rounded-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                                />
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {cargando ? (
                <div className="h-64 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
            ) : !sucursal ? (
                <Card className="border-none shadow-sm dark:bg-slate-900 rounded-[2rem]">
                    <CardHeader>
                        <CardTitle className="text-lg font-bold">Elige una sucursal</CardTitle>
                        <CardDescription>Se mostrarán sus últimos 60 lotes registrados.</CardDescription>
                    </CardHeader>
                </Card>
            ) : lotes.length === 0 ? (
                <Card className="border-none shadow-sm dark:bg-slate-900 rounded-[2rem]">
                    <CardHeader>
                        <CardTitle className="text-lg font-bold">Sin lotes registrados</CardTitle>
                        <CardDescription>{sucursal} no tiene registros en la bitácora.</CardDescription>
                    </CardHeader>
                </Card>
            ) : (
                <Card className="border-none shadow-sm dark:bg-slate-900 rounded-[2rem]">
                    <CardHeader className="pb-3">
                        <div className="flex flex-wrap items-center gap-3">
                            <div>
                                <CardTitle className="text-lg font-bold">Últimos lotes de {sucursal}</CardTitle>
                                <CardDescription>{visibles.length} lote{visibles.length === 1 ? '' : 's'} · más recientes primero</CardDescription>
                            </div>
                            <Button variant="outline" size="sm" className="rounded-full ml-auto" onClick={toggleTodos}>
                                Seleccionar todos
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-200 dark:border-slate-700">
                                        <th className="w-10 px-2 py-2" />
                                        <th className="text-left px-2 py-2 font-semibold text-slate-500 dark:text-slate-400">Lote</th>
                                        <th className="text-left px-2 py-2 font-semibold text-slate-500 dark:text-slate-400">Producto</th>
                                        <th className="text-left px-2 py-2 font-semibold text-slate-500 dark:text-slate-400">Fecha</th>
                                        <th className="text-left px-2 py-2 font-semibold text-slate-500 dark:text-slate-400">Preparador</th>
                                        <th className="text-right px-2 py-2 font-semibold text-slate-500 dark:text-slate-400">pH</th>
                                        <th className="text-right px-2 py-2 font-semibold text-slate-500 dark:text-slate-400">Sólidos</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {visibles.map(l => {
                                        const puede = auditable(l)
                                        const prom = promedioSolidos(l.solidos_medicion_1, l.solidos_medicion_2)
                                        return (
                                            <tr
                                                key={l.id}
                                                onClick={() => puede && toggle(l.id)}
                                                className={`border-b border-slate-100 dark:border-slate-800 last:border-0 ${puede ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50' : 'opacity-50'} ${seleccion.has(l.id) ? 'bg-blue-50 dark:bg-blue-950/30' : ''}`}
                                            >
                                                <td className="px-2 py-2.5">
                                                    <Checkbox
                                                        checked={seleccion.has(l.id)}
                                                        disabled={!puede}
                                                        onCheckedChange={() => puede && toggle(l.id)}
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                </td>
                                                <td className="px-2 py-2.5 font-mono text-xs text-slate-600 dark:text-slate-300">
                                                    {l.lote_producto || '—'}
                                                    {!puede && (
                                                        <Badge className="ml-2 bg-slate-400 text-white border-none rounded-full text-[10px] px-2">
                                                            SIN MEDICIÓN
                                                        </Badge>
                                                    )}
                                                </td>
                                                <td className="px-2 py-2.5 font-semibold text-slate-800 dark:text-slate-200">{l.codigo_producto}</td>
                                                <td className="px-2 py-2.5 text-slate-500">{formatFecha(l.fecha_fabricacion)}</td>
                                                <td className="px-2 py-2.5 text-slate-500 truncate max-w-[10rem]">{l.nombre_preparador || '—'}</td>
                                                <td className="px-2 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-300">
                                                    {l.ph ?? '—'}
                                                </td>
                                                <td className="px-2 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-300">
                                                    {prom === null ? '—' : prom.toFixed(2)}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Barra de acción fija: la tabla puede ser larga */}
            {seleccion.size > 0 && (
                <div className="fixed bottom-0 left-0 right-0 z-30 p-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200 dark:border-slate-700">
                    <div className="max-w-5xl mx-auto flex items-center gap-4">
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                            {seleccion.size} lote{seleccion.size === 1 ? '' : 's'} seleccionado{seleccion.size === 1 ? '' : 's'}
                        </span>
                        <Button variant="ghost" size="sm" className="rounded-full" onClick={() => setSeleccion(new Set())}>
                            Limpiar
                        </Button>
                        <Button className="rounded-full ml-auto gap-2" onClick={crear} disabled={creando}>
                            {creando && <Loader2 className="h-4 w-4 animate-spin" />}
                            Crear auditoría
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
