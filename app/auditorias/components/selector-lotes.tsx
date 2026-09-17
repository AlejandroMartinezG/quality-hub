'use client'

import { useState, useEffect, useMemo } from "react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Loader2, Search, ChevronDown } from "lucide-react"
import { formatFecha } from "@/lib/utils"
import { promedioSolidos } from "@/lib/auditoria-utils"

const COLUMNAS = 'id, lote_producto, codigo_producto, sucursal, fecha_fabricacion, nombre_preparador, tamano_lote, ph, solidos_medicion_1, solidos_medicion_2, apariencia, color, aroma, estado_calidad'

// Cuántos lotes traer. Se empieza corto y se amplía a mano para alcanzar más
// atrás en el tiempo sin pedir de más cuando no hace falta.
export const PASOS = [60, 90, 120, 150, 200, 250]

/** Los lotes inyectados a mano no traen mediciones del operador: nada que comparar. */
export const esAuditable = (l: any) => l.estado_calidad !== 'SIN MEDICION'

// ============================================================
// Carga de lotes de una sucursal, con ventana ampliable
// ============================================================

export function useLotesSucursal(sucursal: string) {
    const [lotes, setLotes] = useState<any[]>([])
    const [limite, setLimite] = useState(PASOS[0])
    const [cargando, setCargando] = useState(false)

    useEffect(() => {
        let cancelado = false

        const cargar = async () => {
            if (!sucursal) { setLotes([]); return }
            setCargando(true)
            try {
                const { data, error } = await supabase
                    .from('bitacora_produccion_calidad')
                    .select(COLUMNAS)
                    .eq('sucursal', sucursal)
                    .order('fecha_fabricacion', { ascending: false })
                    .order('created_at', { ascending: false })
                    .limit(limite)
                if (error) throw error
                if (!cancelado) setLotes(data || [])
            } catch (err: any) {
                if (!cancelado) toast.error("Error al cargar lotes", { description: err.message })
            } finally {
                if (!cancelado) setCargando(false)
            }
        }

        cargar()
        return () => { cancelado = true }
    }, [sucursal, limite])

    // Si volvieron menos lotes que el tope, ya no hay nada más atrás.
    const siguientePaso = PASOS.find(p => p > limite)
    const hayMas = lotes.length >= limite && siguientePaso !== undefined

    // La fecha más antigua cargada: dice hasta dónde alcanza la ventana.
    const masAntiguo = lotes.length > 0
        ? lotes.reduce((min, l) => (l.fecha_fabricacion < min ? l.fecha_fabricacion : min), lotes[0].fecha_fabricacion)
        : null

    return {
        lotes, cargando, limite, setLimite,
        hayMas, siguientePaso, masAntiguo,
        reiniciarVentana: () => setLimite(PASOS[0]),
    }
}

// ============================================================
// Tabla de selección
// ============================================================

interface TablaProps {
    sucursal: string
    lotes: any[]
    cargando: boolean
    seleccion: Set<string>
    onToggle: (id: string) => void
    onReemplazar: (ids: string[]) => void
    hayMas: boolean
    siguientePaso?: number
    masAntiguo: string | null
    onAmpliar: () => void
    limite: number
    /** Lotes de la auditoría que ya tienen mediciones: quitarlos borra trabajo. */
    conDatos?: Set<string>
    /** Lotes de la auditoría que quedaron fuera de la ventana cargada. */
    fueraDeVentana?: number
    /**
     * En modo edición el botón solo agrega: vaciar la selección de un golpe
     * borraría mediciones ya capturadas sin que quede claro qué se perdió.
     */
    soloAgregar?: boolean
}

export function TablaLotes({
    sucursal, lotes, cargando, seleccion, onToggle, onReemplazar,
    hayMas, siguientePaso, masAntiguo, onAmpliar, limite,
    conDatos, fueraDeVentana = 0, soloAgregar = false,
}: TablaProps) {
    const [filtro, setFiltro] = useState("")

    const visibles = useMemo(() => {
        const q = filtro.trim().toUpperCase()
        if (!q) return lotes
        return lotes.filter(l =>
            (l.codigo_producto || '').toUpperCase().includes(q) ||
            (l.lote_producto || '').toUpperCase().includes(q) ||
            (l.nombre_preparador || '').toUpperCase().includes(q)
        )
    }, [lotes, filtro])

    const elegibles: string[] = useMemo(
        () => visibles.filter(esAuditable).map(l => l.id),
        [visibles]
    )
    const todosPuestos = elegibles.length > 0 && elegibles.every(id => seleccion.has(id))
    // En modo edición nunca se vacía: el botón se apaga cuando ya están todos.
    const desactivarTodos = elegibles.length === 0 || (soloAgregar && todosPuestos)

    const toggleTodos = () => {
        onReemplazar(todosPuestos && !soloAgregar ? [] : elegibles)
    }

    if (cargando && lotes.length === 0) {
        return (
            <div className="h-64 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        )
    }

    if (lotes.length === 0) {
        return (
            <Card className="border-none shadow-sm dark:bg-slate-900 rounded-[2rem]">
                <CardHeader>
                    <CardTitle className="text-lg font-bold">Sin lotes registrados</CardTitle>
                    <CardDescription>{sucursal} no tiene registros en la bitácora.</CardDescription>
                </CardHeader>
            </Card>
        )
    }

    return (
        <Card className="border-none shadow-sm dark:bg-slate-900 rounded-[2rem]">
            <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center gap-3">
                    <div>
                        <CardTitle className="text-lg font-bold">Últimos lotes de {sucursal}</CardTitle>
                        <CardDescription>
                            {visibles.length} lote{visibles.length === 1 ? '' : 's'} · más recientes primero
                            {masAntiguo && <> · alcanza hasta el {formatFecha(masAntiguo)}</>}
                        </CardDescription>
                    </div>
                    <div className="relative flex-1 min-w-[12rem] max-w-xs">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            value={filtro}
                            onChange={e => setFiltro(e.target.value)}
                            placeholder="Código, lote o preparador"
                            className="w-full text-sm border border-slate-300 dark:border-slate-600 rounded-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                        />
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        onClick={toggleTodos}
                        disabled={desactivarTodos}
                    >
                        {todosPuestos && !soloAgregar ? 'Quitar todos' : 'Seleccionar todos'}
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {fueraDeVentana > 0 && (
                    <div className="mb-4 px-4 py-3 rounded-2xl bg-blue-50 dark:bg-blue-950/30 text-xs text-blue-800 dark:text-blue-300">
                        <strong>{fueraDeVentana} lote{fueraDeVentana === 1 ? '' : 's'} de esta auditoría</strong> {fueraDeVentana === 1 ? 'es más antiguo' : 'son más antiguos'} que
                        la ventana cargada y no {fueraDeVentana === 1 ? 'aparece' : 'aparecen'} en esta lista.
                        {' '}Siguen incluidos en la auditoría. Carga más lotes si necesitas quitarlos.
                    </div>
                )}

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
                                const puede = esAuditable(l)
                                const prom = promedioSolidos(l.solidos_medicion_1, l.solidos_medicion_2)
                                const yaMedido = conDatos?.has(l.id)
                                return (
                                    <tr
                                        key={l.id}
                                        onClick={() => puede && onToggle(l.id)}
                                        className={`border-b border-slate-100 dark:border-slate-800 last:border-0 ${puede ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50' : 'opacity-50'} ${seleccion.has(l.id) ? 'bg-blue-50 dark:bg-blue-950/30' : ''}`}
                                    >
                                        <td className="px-2 py-2.5">
                                            <Checkbox
                                                checked={seleccion.has(l.id)}
                                                disabled={!puede}
                                                onCheckedChange={() => puede && onToggle(l.id)}
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
                                            {yaMedido && (
                                                <Badge className="ml-2 bg-emerald-600 text-white border-none rounded-full text-[10px] px-2">
                                                    YA MEDIDO
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

                <div className="flex flex-col items-center gap-2 pt-4">
                    {hayMas ? (
                        <>
                            <Button
                                variant="outline"
                                className="rounded-full gap-2"
                                onClick={onAmpliar}
                                disabled={cargando}
                            >
                                {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronDown className="h-4 w-4" />}
                                Cargar {siguientePaso} lotes
                            </Button>
                            <p className="text-[11px] text-slate-400">Lo que ya seleccionaste se conserva.</p>
                        </>
                    ) : (
                        <p className="text-[11px] text-slate-400">
                            {lotes.length < limite
                                ? `Son todos los lotes registrados en ${sucursal}.`
                                : `Tope de ${limite} lotes alcanzado.`}
                        </p>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
