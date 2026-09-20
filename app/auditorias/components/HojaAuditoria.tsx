'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select"
import { Loader2, ShieldCheck, Save, Lock, FileDown, CheckCircle2, Eye, PenLine, ListPlus } from 'lucide-react'
import { formatFecha } from "@/lib/utils"
import { TextoFormateado, AYUDA_FORMATO } from "@/lib/texto-formato"
import { PARAMETER_APPLICABILITY, APPEARANCE_STANDARDS, PRODUCT_STANDARDS, PH_STANDARDS } from "@/lib/production-constants"
import {
    compararMediciones, COLOR_RESULTADO, ETIQUETA_VEREDICTO,
    type Comparacion, type NivelParametro,
} from "@/lib/auditoria-utils"
import { PrintReportWrapper } from "@/components/PrintReportWrapper"
import ReporteAuditoria from "./ReporteAuditoria"
import GaleriaEvidencia from "./GaleriaEvidencia"
import { useEvidencias, rangoFotos } from "./use-evidencias"
import { urlADataUri } from "@/lib/imagen-utils"

/** Tope por bloque, para que el anexo del reporte no se vuelva inmanejable. */
const MAX_FOTOS_LOTE = 4
const MAX_FOTOS_GENERAL = 6

// Mismo vocabulario que ofrece la Bitácora al operador, para que ambos lados
// del reporte hablen igual.
const OPCIONES_APARIENCIA = [
    "CRISTALINO", "OPACO", "APERLADO", "TURBIO",
    "PARTICULAS SUSPENDIDAS", "SEPARACION DE COMPONENTES",
]

interface Props {
    auditoria: any
    lotesIniciales: any[]
    puedeEditar: boolean
    nombreUsuario?: string
    userId?: string
    onRecargar: () => void
}

const CAMPOS_CALIDAD = [
    'ph_calidad', 'solidos_1_calidad', 'temp_1_calidad',
    'solidos_2_calidad', 'temp_2_calidad',
    'apariencia_calidad', 'color_calidad', 'aroma_calidad', 'notas',
] as const

const COLOR_NIVEL: Record<NivelParametro, string> = {
    ok: 'text-emerald-600 dark:text-emerald-400',
    desviacion: 'text-amber-600 dark:text-amber-400',
    discrepancia: 'text-red-600 dark:text-red-400',
    na: 'text-slate-300 dark:text-slate-600',
}

const PUNTO_NIVEL: Record<NivelParametro, string> = {
    ok: 'bg-emerald-500',
    desviacion: 'bg-amber-500',
    discrepancia: 'bg-red-500',
    na: 'bg-slate-300 dark:bg-slate-600',
}

export default function HojaAuditoria({
    auditoria, lotesIniciales, puedeEditar, nombreUsuario, userId, onRecargar,
}: Props) {
    const [lotes, setLotes] = useState<any[]>(lotesIniciales)
    const [observaciones, setObservaciones] = useState(auditoria.observaciones || '')
    const [guardando, setGuardando] = useState(false)
    const [cerrando, setCerrando] = useState(false)
    const [printView, setPrintView] = useState(false)
    const [preparandoPdf, setPreparandoPdf] = useState(false)
    const [vistaPrevia, setVistaPrevia] = useState(false)
    // Miniaturas embebidas como data: URI, indexadas por id de evidencia.
    const [fotosPdf, setFotosPdf] = useState<Record<string, string>>({})

    const cerrada = auditoria.estado === 'CERRADA'
    const editable = puedeEditar && !cerrada

    const ordenLotes = useMemo(() => lotes.map(l => l.id), [lotes])
    const { porLote, generales, numeradas, recargar: recargarFotos } =
        useEvidencias(auditoria.id, ordenLotes)

    // Comparación en vivo: se recalcula con cada tecla, así el auditor ve el
    // veredicto antes de guardar y no después.
    const comparaciones = useMemo(() => {
        const mapa = new Map<string, Comparacion>()
        for (const l of lotes) {
            mapa.set(l.id, compararMediciones(
                l.codigo_producto,
                {
                    ph: l.ph_operador,
                    solidos_medicion_1: l.solidos_1_operador,
                    solidos_medicion_2: l.solidos_2_operador,
                    apariencia: l.apariencia_operador,
                    color: l.color_operador,
                    aroma: l.aroma_operador,
                },
                {
                    ph: l.ph_calidad,
                    solidos_medicion_1: l.solidos_1_calidad,
                    solidos_medicion_2: l.solidos_2_calidad,
                    apariencia: l.apariencia_calidad,
                    color: l.color_calidad,
                    aroma: l.aroma_calidad,
                },
            ))
        }
        return mapa
    }, [lotes])

    const resumen = useMemo(() => {
        const vals = Array.from(comparaciones.values())
        return {
            total: vals.length,
            ok: vals.filter(c => c.resultado === 'COINCIDE').length,
            amarillo: vals.filter(c => c.resultado === 'DESVIACION').length,
            rojo: vals.filter(c => c.resultado === 'DISCREPANCIA').length,
            pendiente: vals.filter(c => c.resultado === 'PENDIENTE').length,
        }
    }, [comparaciones])

    const actualizar = (id: string, campo: string, valor: any) => {
        setLotes(prev => prev.map(l => l.id === id ? { ...l, [campo]: valor } : l))
    }

    const guardar = async () => {
        setGuardando(true)
        try {
            // Se guarda también el resultado calculado, para que el historial y
            // la confiabilidad no tengan que recalcular nada al leer.
            for (const l of lotes) {
                const c = comparaciones.get(l.id)!
                const payload: any = {
                    resultado: c.resultado,
                    parametros_afectados: c.parametrosAfectados,
                    updated_at: new Date().toISOString(),
                }
                for (const campo of CAMPOS_CALIDAD) {
                    payload[campo] = l[campo] === '' ? null : l[campo]
                }
                const { error } = await supabase
                    .from('auditoria_lotes')
                    .update(payload)
                    .eq('id', l.id)
                if (error) throw error
            }

            const { error: errObs } = await supabase
                .from('auditorias_presenciales')
                .update({ observaciones })
                .eq('id', auditoria.id)
            if (errObs) throw errObs

            toast.success("Avance guardado")
        } catch (err: any) {
            toast.error("No se pudo guardar", { description: err.message })
        } finally {
            setGuardando(false)
        }
    }

    const cerrar = async () => {
        if (resumen.pendiente > 0) {
            const seguir = confirm(
                `Quedan ${resumen.pendiente} lote${resumen.pendiente === 1 ? '' : 's'} sin medición de Calidad.\n\n` +
                `Si cierras la auditoría, esos lotes quedan sin verificar y no contarán en las estadísticas.\n\n¿Cerrar de todos modos?`
            )
            if (!seguir) return
        }
        setCerrando(true)
        try {
            await guardar()
            const { error } = await supabase
                .from('auditorias_presenciales')
                .update({ estado: 'CERRADA', cerrada_at: new Date().toISOString() })
                .eq('id', auditoria.id)
            if (error) throw error
            toast.success("Auditoría cerrada", { description: "Ya es de solo lectura." })
            onRecargar()
        } catch (err: any) {
            toast.error("No se pudo cerrar", { description: err.message })
        } finally {
            setCerrando(false)
        }
    }

    /**
     * Abre la vista de impresión.
     *
     * `html2canvas` no rasteriza de forma confiable imágenes remotas: aunque
     * `useCORS` esté activo, las URL firmadas suelen salir como recuadros en
     * blanco. Por eso las miniaturas se descargan y se convierten a `data:` URI
     * ANTES de montar el reporte, para que no haga ninguna petición de red.
     */
    const abrirReporte = async () => {
        if (numeradas.length === 0) { setPrintView(true); return }

        setPreparandoPdf(true)
        try {
            const pares = await Promise.all(
                numeradas.map(async ev => [
                    ev.id,
                    ev.urlMiniatura ? await urlADataUri(ev.urlMiniatura) : null,
                ] as const)
            )

            const mapa: Record<string, string> = {}
            let fallidas = 0
            for (const [id, uri] of pares) {
                if (uri) mapa[id] = uri
                else fallidas++
            }
            setFotosPdf(mapa)

            if (fallidas > 0) {
                toast.warning(`${fallidas} foto${fallidas === 1 ? '' : 's'} no se pudo preparar`, {
                    description: "Aparecerán como espacio vacío en el anexo.",
                })
            }
            setPrintView(true)
        } finally {
            setPreparandoPdf(false)
        }
    }

    /** Campo numérico de Calidad. Se apaga cuando el parámetro no aplica al producto. */
    const CampoNum = ({ lote, campo, aplica, paso = "0.1" }: any) => (
        <input
            type="number"
            step={paso}
            value={lote[campo] ?? ''}
            disabled={!editable || !aplica}
            onChange={e => actualizar(lote.id, campo, e.target.value)}
            placeholder={aplica ? '—' : 'n/a'}
            className="w-20 text-sm text-right tabular-nums border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 disabled:bg-slate-100 dark:disabled:bg-slate-900 disabled:text-slate-400 disabled:cursor-not-allowed"
        />
    )

    return (
        <div className="space-y-6">
            {/* Encabezado */}
            <div className="flex flex-wrap items-center gap-3">
                <ShieldCheck className="h-6 w-6 text-blue-600" />
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                        {auditoria.sucursal}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {formatFecha(auditoria.fecha_auditoria)} · Auditor: {auditoria.auditor_nombre || '—'}
                    </p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    {cerrada ? (
                        <Badge className="bg-slate-600 text-white border-none rounded-full gap-1">
                            <Lock className="h-3 w-3" /> Cerrada
                        </Badge>
                    ) : (
                        <Badge className="bg-amber-500 text-white border-none rounded-full">En proceso</Badge>
                    )}
                    {editable && (
                        <Link href={`/auditorias/${auditoria.id}/lotes`}>
                            <Button variant="outline" className="rounded-full gap-2">
                                <ListPlus className="h-4 w-4" /> Ajustar lotes
                            </Button>
                        </Link>
                    )}
                    <Button variant="outline" className="rounded-full gap-2" onClick={abrirReporte} disabled={preparandoPdf}>
                        {preparandoPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                        {preparandoPdf ? 'Preparando…' : 'Reporte'}
                    </Button>
                </div>
            </div>

            {/* Resumen */}
            <div className="flex flex-wrap gap-3">
                {[
                    { label: 'Coinciden', valor: resumen.ok, clase: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400' },
                    { label: 'Desviación', valor: resumen.amarillo, clase: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400' },
                    { label: 'Discrepancia', valor: resumen.rojo, clase: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400' },
                    { label: 'Sin medir', valor: resumen.pendiente, clase: 'bg-slate-100 dark:bg-slate-800 text-slate-500' },
                ].map(k => (
                    <div key={k.label} className={`px-5 py-3 rounded-2xl ${k.clase}`}>
                        <div className="text-3xl font-black tabular-nums">{k.valor}</div>
                        <div className="text-[11px] font-semibold uppercase tracking-wide">{k.label}</div>
                    </div>
                ))}
            </div>

            {/* Lotes */}
            <div className="space-y-4">
                {lotes.map(lote => {
                    const c = comparaciones.get(lote.id)!
                    const aplica = PARAMETER_APPLICABILITY[lote.codigo_producto] || { solidos: false, ph: false }
                    const stdSol = PRODUCT_STANDARDS[lote.codigo_producto]
                    const stdPh = PH_STANDARDS[lote.codigo_producto]
                    const esperaApariencia = Boolean(APPEARANCE_STANDARDS[lote.codigo_producto])
                    const color = COLOR_RESULTADO[c.resultado]

                    return (
                        <Card key={lote.id} className="border-none shadow-sm dark:bg-slate-900 rounded-[2rem] overflow-hidden">
                            <CardHeader className="pb-3">
                                <div className="flex flex-wrap items-center gap-3">
                                    <div>
                                        <CardTitle className="text-base font-bold font-mono">
                                            {lote.lote_producto || lote.codigo_producto}
                                        </CardTitle>
                                        <CardDescription>
                                            {lote.codigo_producto} · {lote.nombre_preparador || '—'} · {formatFecha(lote.fecha_fabricacion)}
                                        </CardDescription>
                                    </div>
                                    {(() => {
                                        const rango = rangoFotos(porLote.get(lote.id) || [])
                                        return rango ? (
                                            <span className="ml-auto text-[11px] font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                                📷 {rango}
                                            </span>
                                        ) : null
                                    })()}
                                    <div className={`${rangoFotos(porLote.get(lote.id) || []) ? '' : 'ml-auto'} px-4 py-1.5 rounded-full text-xs font-bold ${color.bg} ${color.text}`}>
                                        {color.label}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm min-w-[36rem]">
                                        <thead>
                                            <tr className="border-b border-slate-200 dark:border-slate-700">
                                                <th className="text-left px-2 py-2 font-semibold text-slate-500 dark:text-slate-400 w-32">Parámetro</th>
                                                <th className="text-right px-2 py-2 font-semibold text-slate-500 dark:text-slate-400">Operador</th>
                                                <th className="text-center px-2 py-2 font-semibold text-slate-500 dark:text-slate-400">Calidad</th>
                                                <th className="text-right px-2 py-2 font-semibold text-slate-500 dark:text-slate-400 w-20">Δ</th>
                                                <th className="text-left px-2 py-2 font-semibold text-slate-500 dark:text-slate-400">Veredicto</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {aplica.ph && (
                                                <tr className="border-b border-slate-100 dark:border-slate-800">
                                                    <td className="px-2 py-2.5 font-medium text-slate-700 dark:text-slate-300">
                                                        pH
                                                        {stdPh && (
                                                            <span className="block text-[10px] text-slate-400 font-normal">
                                                                Ref: {stdPh.min === stdPh.max ? stdPh.min : `${stdPh.min}–${stdPh.max}`}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-2 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-300">
                                                        {lote.ph_operador ?? '—'}
                                                    </td>
                                                    <td className="px-2 py-2.5 text-center">
                                                        <CampoNum lote={lote} campo="ph_calidad" aplica={aplica.ph} />
                                                    </td>
                                                    <td className={`px-2 py-2.5 text-right tabular-nums font-semibold ${COLOR_NIVEL[c.parametros.find(p => p.clave === 'ph')?.nivel || 'na']}`}>
                                                        {(() => {
                                                            const d = c.parametros.find(p => p.clave === 'ph')?.delta
                                                            return d === null || d === undefined ? '—' : `${d > 0 ? '+' : ''}${d.toFixed(1)}`
                                                        })()}
                                                    </td>
                                                    <td className="px-2 py-2.5">
                                                        <Veredicto p={c.parametros.find(p => p.clave === 'ph')} />
                                                    </td>
                                                </tr>
                                            )}

                                            {aplica.solidos && (
                                                <tr className="border-b border-slate-100 dark:border-slate-800">
                                                    <td className="px-2 py-2.5 font-medium text-slate-700 dark:text-slate-300">
                                                        Sólidos
                                                        {stdSol && (
                                                            <span className="block text-[10px] text-slate-400 font-normal">
                                                                Ref: {stdSol.min}–{stdSol.max}%
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-2 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-300">
                                                        {c.parametros.find(p => p.clave === 'solidos')?.valorOperador}
                                                        <span className="block text-[10px] text-slate-400">
                                                            {lote.solidos_1_operador ?? '—'} / {lote.solidos_2_operador ?? '—'}
                                                        </span>
                                                    </td>
                                                    <td className="px-2 py-2.5">
                                                        <div className="flex items-center justify-center gap-1">
                                                            <CampoNum lote={lote} campo="solidos_1_calidad" aplica={aplica.solidos} paso="0.01" />
                                                            <CampoNum lote={lote} campo="solidos_2_calidad" aplica={aplica.solidos} paso="0.01" />
                                                        </div>
                                                        <div className="flex items-center justify-center gap-1 mt-1">
                                                            <CampoNum lote={lote} campo="temp_1_calidad" aplica={aplica.solidos} />
                                                            <CampoNum lote={lote} campo="temp_2_calidad" aplica={aplica.solidos} />
                                                        </div>
                                                        <div className="text-[10px] text-slate-400 text-center mt-0.5">M1 / M2 · T1 / T2</div>
                                                    </td>
                                                    <td className={`px-2 py-2.5 text-right tabular-nums font-semibold ${COLOR_NIVEL[c.parametros.find(p => p.clave === 'solidos')?.nivel || 'na']}`}>
                                                        {(() => {
                                                            const d = c.parametros.find(p => p.clave === 'solidos')?.delta
                                                            return d === null || d === undefined ? '—' : `${d > 0 ? '+' : ''}${d.toFixed(2)}`
                                                        })()}
                                                    </td>
                                                    <td className="px-2 py-2.5">
                                                        <Veredicto p={c.parametros.find(p => p.clave === 'solidos')} />
                                                    </td>
                                                </tr>
                                            )}

                                            {esperaApariencia && (
                                                <tr className="border-b border-slate-100 dark:border-slate-800">
                                                    <td className="px-2 py-2.5 font-medium text-slate-700 dark:text-slate-300">
                                                        Apariencia
                                                        <span className="block text-[10px] text-slate-400 font-normal">
                                                            Esp: {APPEARANCE_STANDARDS[lote.codigo_producto]}
                                                        </span>
                                                    </td>
                                                    <td className="px-2 py-2.5 text-right text-slate-600 dark:text-slate-300 text-xs">
                                                        {lote.apariencia_operador || '—'}
                                                    </td>
                                                    <td className="px-2 py-2.5">
                                                        <Select
                                                            value={lote.apariencia_calidad || ''}
                                                            onValueChange={v => actualizar(lote.id, 'apariencia_calidad', v)}
                                                            disabled={!editable}
                                                        >
                                                            <SelectTrigger className="rounded-lg h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                                                            <SelectContent>
                                                                {OPCIONES_APARIENCIA.map(o => (
                                                                    <SelectItem key={o} value={o}>{o}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </td>
                                                    <td className="px-2 py-2.5 text-right text-slate-300">—</td>
                                                    <td className="px-2 py-2.5">
                                                        <Veredicto p={c.parametros.find(p => p.clave === 'apariencia')} />
                                                    </td>
                                                </tr>
                                            )}

                                            {(['color', 'aroma'] as const).map(clave => (
                                                <tr key={clave} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                                                    <td className="px-2 py-2.5 font-medium text-slate-700 dark:text-slate-300 capitalize">{clave}</td>
                                                    <td className="px-2 py-2.5 text-right text-slate-600 dark:text-slate-300 text-xs">
                                                        {lote[`${clave}_operador`] || '—'}
                                                    </td>
                                                    <td className="px-2 py-2.5">
                                                        <Select
                                                            value={lote[`${clave}_calidad`] || ''}
                                                            onValueChange={v => actualizar(lote.id, `${clave}_calidad`, v)}
                                                            disabled={!editable}
                                                        >
                                                            <SelectTrigger className="rounded-lg h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="CONFORME">CONFORME</SelectItem>
                                                                <SelectItem value="NO CONFORME">NO CONFORME</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </td>
                                                    <td className="px-2 py-2.5 text-right text-slate-300">—</td>
                                                    <td className="px-2 py-2.5">
                                                        <Veredicto p={c.parametros.find(p => p.clave === clave)} />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <div>
                                    <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Notas del lote</label>
                                    <Textarea
                                        value={lote.notas || ''}
                                        disabled={!editable}
                                        onChange={e => actualizar(lote.id, 'notas', e.target.value)}
                                        placeholder="Qué observaste al medir, condiciones del equipo, etc. Admite **negritas**."
                                        className="mt-1 rounded-2xl text-sm min-h-[3rem]"
                                    />
                                </div>

                                <div>
                                    <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                                        Evidencia fotográfica
                                    </label>
                                    <div className="mt-2">
                                        <GaleriaEvidencia
                                            auditoriaId={auditoria.id}
                                            loteId={lote.id}
                                            evidencias={porLote.get(lote.id) || []}
                                            editable={editable}
                                            maximo={MAX_FOTOS_LOTE}
                                            userId={userId}
                                            onCambio={recargarFotos}
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )
                })}
            </div>

            {/* Observaciones generales */}
            <Card className="border-none shadow-sm dark:bg-slate-900 rounded-[2rem]">
                <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-start gap-3">
                        <div>
                            <CardTitle className="text-base font-bold">Observaciones de la visita</CardTitle>
                            <CardDescription>Conclusiones generales, estado del equipo de medición, acuerdos.</CardDescription>
                        </div>
                        {observaciones.trim() && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="rounded-full gap-2 ml-auto text-xs"
                                onClick={() => setVistaPrevia(v => !v)}
                            >
                                {vistaPrevia ? <PenLine className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                {vistaPrevia ? 'Editar' : 'Vista previa'}
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="space-y-2">
                    {vistaPrevia ? (
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 px-4 py-3 min-h-[6rem] text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                            <TextoFormateado texto={observaciones} />
                        </div>
                    ) : (
                        <Textarea
                            value={observaciones}
                            disabled={!editable}
                            onChange={e => setObservaciones(e.target.value)}
                            placeholder={"Al llevar a cabo la auditoría en campo...\n\n- **Apego al manual**: correcto\n- **Control de parámetros**: correcto"}
                            className="rounded-2xl min-h-[8rem]"
                        />
                    )}
                    <p className="text-[11px] text-slate-400">
                        Formato: {AYUDA_FORMATO}. Se respeta en el reporte impreso.
                    </p>
                </CardContent>
            </Card>

            {/* Evidencia general de la visita */}
            <Card className="border-none shadow-sm dark:bg-slate-900 rounded-[2rem]">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base font-bold">Evidencia general de la visita</CardTitle>
                    <CardDescription>
                        Fotos que no pertenecen a un lote: área de producción, equipo de medición, almacén.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <GaleriaEvidencia
                        auditoriaId={auditoria.id}
                        loteId={null}
                        evidencias={generales}
                        editable={editable}
                        maximo={MAX_FOTOS_GENERAL}
                        userId={userId}
                        onCambio={recargarFotos}
                    />
                </CardContent>
            </Card>

            {/* Barra de acción */}
            {editable && (
                <div className="fixed bottom-0 left-0 right-0 z-30 p-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200 dark:border-slate-700">
                    <div className="max-w-5xl mx-auto flex flex-wrap items-center gap-3">
                        <span className="text-xs text-slate-500">
                            {resumen.total - resumen.pendiente} de {resumen.total} lotes medidos
                        </span>
                        <Button variant="outline" className="rounded-full gap-2 ml-auto" onClick={guardar} disabled={guardando || cerrando}>
                            {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            Guardar avance
                        </Button>
                        <Button className="rounded-full gap-2" onClick={cerrar} disabled={guardando || cerrando}>
                            {cerrando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                            Cerrar auditoría
                        </Button>
                    </div>
                </div>
            )}

            {printView && (
                <PrintReportWrapper
                    title={`Auditoría presencial — ${auditoria.sucursal}`}
                    dateFrom={auditoria.fecha_auditoria}
                    dateTo={auditoria.fecha_auditoria}
                    filters={`Auditor: ${auditoria.auditor_nombre || '—'}`}
                    userName={nombreUsuario}
                    onClose={() => setPrintView(false)}
                >
                    <ReporteAuditoria
                        auditoria={{ ...auditoria, observaciones }}
                        lotes={lotes}
                        comparaciones={comparaciones}
                        evidenciasPorLote={porLote}
                        evidenciasGenerales={generales}
                        fotosPdf={fotosPdf}
                    />
                </PrintReportWrapper>
            )}
        </div>
    )
}

/** Veredicto de un parámetro: punto de color + "operador → calidad". */
function Veredicto({ p }: { p?: { nivel: NivelParametro, veredictoOperador: any, veredictoCalidad: any } }) {
    if (!p) return <span className="text-slate-300">—</span>
    if (p.nivel === 'na') return <span className="text-xs text-slate-300 dark:text-slate-600">sin medir</span>

    const mismo = p.veredictoOperador === p.veredictoCalidad
    return (
        <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full shrink-0 ${PUNTO_NIVEL[p.nivel]}`} />
            {p.veredictoOperador ? (
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {ETIQUETA_VEREDICTO[p.veredictoOperador as keyof typeof ETIQUETA_VEREDICTO]}
                    {!mismo && (
                        <>
                            {' → '}
                            <strong className="text-red-600 dark:text-red-400">
                                {ETIQUETA_VEREDICTO[p.veredictoCalidad as keyof typeof ETIQUETA_VEREDICTO]}
                            </strong>
                        </>
                    )}
                </span>
            ) : (
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {p.nivel === 'ok' ? 'coincide' : 'difiere'}
                </span>
            )}
        </div>
    )
}
