'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ShieldCheck, ClipboardCheck, AlertTriangle, Users, ChevronRight, FileWarning } from 'lucide-react'
import { formatFecha } from "@/lib/utils"
import {
    COLOR_RESULTADO, tasaDiscrepancia, tasaCumplimiento,
    type ResultadoLote, type OrigenLote,
} from "@/lib/auditoria-utils"

type LoteResumen = {
    id: string
    resultado: ResultadoLote
    nombre_preparador: string | null
    origen?: OrigenLote | null
}
type Auditoria = {
    id: string
    sucursal: string
    fecha_auditoria: string
    auditor_nombre: string | null
    estado: 'EN_PROCESO' | 'CERRADA'
    auditoria_lotes: LoteResumen[] | null
}

interface Props { auditorias: Auditoria[] }

/** Cuenta 🟢/🟡/🔴 de una auditoría, más los lotes sin registro. */
function conteos(lotes: LoteResumen[]) {
    return {
        total: lotes.length,
        ok: lotes.filter(l => l.resultado === 'COINCIDE').length,
        amarillo: lotes.filter(l => l.resultado === 'DESVIACION').length,
        rojo: lotes.filter(l => l.resultado === 'DISCREPANCIA').length,
        pendiente: lotes.filter(l => l.resultado === 'PENDIENTE').length,
        sinRegistro: lotes.filter(l => l.origen === 'SIN_REGISTRO').length,
    }
}

export default function AuditoriasPanel({ auditorias = [] }: Props) {
    const [vista, setVista] = useState<'sucursal' | 'preparador'>('preparador')

    const { kpis, enProceso, cerradas, confiabilidad } = useMemo(() => {
        const todosLotes: LoteResumen[] = auditorias.flatMap(a => a.auditoria_lotes || [])
        const tasa = tasaDiscrepancia(todosLotes)
        const cumpl = tasaCumplimiento(todosLotes)

        // Confiabilidad agrupada. La clave cambia según la vista elegida.
        //
        // Un lote sin registro puede no tener preparador identificado. En la vista
        // por preparador se agrupa en "Sin identificar" en vez de repartirlo o
        // esconderlo: la omisión existe aunque no se sepa de quién fue.
        const acc = new Map<string, { nombre: string; sucursal: string; lotes: LoteResumen[] }>()
        for (const a of auditorias) {
            for (const l of a.auditoria_lotes || []) {
                const nombre = vista === 'sucursal'
                    ? a.sucursal
                    : (l.nombre_preparador || 'Sin identificar')
                const key = vista === 'sucursal' ? a.sucursal : `${a.sucursal}|${nombre}`
                if (!acc.has(key)) acc.set(key, { nombre, sucursal: a.sucursal, lotes: [] })
                acc.get(key)!.lotes.push(l)
            }
        }

        // Se ordena por el PEOR de los dos ejes: si no, una sucursal con exactitud
        // perfecta y registro pésimo quedaría hasta el fondo de la lista, que es
        // justo el problema que este KPI viene a resolver.
        const confiabilidad = Array.from(acc.values())
            .map(g => {
                const d = tasaDiscrepancia(g.lotes)
                const c = tasaCumplimiento(g.lotes)
                return { ...g, ...d, cumplimiento: c, severidad: Math.max(d.pct, 100 - c.pct) }
            })
            .filter(g => g.n > 0 || g.cumplimiento.sinRegistro > 0)
            .sort((a, b) => b.severidad - a.severidad || b.n - a.n)

        return {
            kpis: {
                auditorias: auditorias.length,
                lotes: todosLotes.filter(l => l.resultado !== 'PENDIENTE').length,
                pctRojo: tasa.pct,
                nRojo: tasa.n,
                confiable: tasa.confiable,
                pctCumplimiento: cumpl.pct,
                sinRegistro: cumpl.sinRegistro,
                inspeccionados: cumpl.n,
            },
            enProceso: auditorias.filter(a => a.estado === 'EN_PROCESO'),
            cerradas: auditorias.filter(a => a.estado === 'CERRADA'),
            confiabilidad,
        }
    }, [auditorias, vista])

    if (auditorias.length === 0) {
        return (
            <Card className="border-none shadow-sm dark:bg-slate-900 rounded-[2rem]">
                <CardHeader>
                    <CardTitle className="text-lg font-bold">Sin auditorías registradas</CardTitle>
                    <CardDescription>
                        Crea la primera con el botón <strong>Nueva auditoría</strong>: elige una sucursal,
                        selecciona los lotes que vas a verificar y captura tus mediciones.
                    </CardDescription>
                </CardHeader>
            </Card>
        )
    }

    const Kpi = ({ label, valor, sub, icon: Icon, tono = 'blue' }: any) => (
        <Card className="border shadow-sm bg-white dark:bg-slate-900 rounded-[1.8rem] overflow-visible relative">
            <CardContent className="p-6">
                <div className="pr-10">
                    <p className="text-[10px] font-bold text-[#1828a8] dark:text-blue-400 uppercase tracking-widest">{label}</p>
                    <div className="text-5xl font-black text-slate-900 dark:text-white mt-3 tracking-tight">{valor}</div>
                    <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>
                </div>
                <div className={`absolute -top-3 -right-3 p-4 rounded-2xl shadow-lg border-4 border-white dark:border-slate-800 ${tono === 'red' ? 'bg-red-100 dark:bg-red-900/50' : 'bg-blue-100 dark:bg-blue-900/50'}`}>
                    <Icon className={`h-10 w-10 ${tono === 'red' ? 'text-[#e2211c] dark:text-red-400' : 'text-[#0b109f] dark:text-blue-400'}`} />
                </div>
            </CardContent>
        </Card>
    )

    const FilaAuditoria = ({ a }: { a: Auditoria }) => {
        const c = conteos(a.auditoria_lotes || [])
        return (
            <Link href={`/auditorias/${a.id}`} className="block group">
                <div className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <div className="min-w-[10rem]">
                        <div className="font-bold text-slate-800 dark:text-slate-100">{a.sucursal}</div>
                        <div className="text-xs text-slate-400">{formatFecha(a.fecha_auditoria)}</div>
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400 min-w-[9rem] truncate">
                        {a.auditor_nombre || '—'}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold">
                        <span className="px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400">{c.ok}</span>
                        <span className="px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">{c.amarillo}</span>
                        <span className="px-2 py-1 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400">{c.rojo}</span>
                        {c.pendiente > 0 && (
                            <span className="px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">{c.pendiente} sin medir</span>
                        )}
                        {c.sinRegistro > 0 && (
                            <span className="px-2 py-1 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400">
                                {c.sinRegistro} sin registro
                            </span>
                        )}
                        <span className="text-slate-400 font-normal ml-1">de {c.total}</span>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                        {a.estado === 'EN_PROCESO' && (
                            <Badge className="bg-amber-500 text-white border-none rounded-full">En proceso</Badge>
                        )}
                        <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
                    </div>
                </div>
            </Link>
        )
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Kpi label="Auditorías" valor={kpis.auditorias} sub="visitas registradas" icon={ShieldCheck} />
                <Kpi label="Lotes verificados" valor={kpis.lotes} sub="con medición de Calidad" icon={ClipboardCheck} />
                <Kpi
                    label="Discrepancia"
                    valor={`${kpis.pctRojo.toFixed(0)}%`}
                    sub={kpis.confiable ? `sobre ${kpis.nRojo} lotes medidos` : `solo ${kpis.nRojo} lotes — aún no es representativo`}
                    icon={AlertTriangle}
                    tono={kpis.pctRojo > 0 ? 'red' : 'blue'}
                />
                {/* El subtítulo importa: el denominador es lo inspeccionado en campo,
                    no la producción real de la sucursal. Sin esa aclaración el número
                    se lee como algo que el sistema no puede saber. */}
                <Kpi
                    label="Cumplimiento de registro"
                    valor={`${kpis.pctCumplimiento.toFixed(0)}%`}
                    sub={kpis.sinRegistro > 0
                        ? `${kpis.sinRegistro} sin registrar de ${kpis.inspeccionados} inspeccionados`
                        : `${kpis.inspeccionados} inspeccionados, todos registrados`}
                    icon={FileWarning}
                    tono={kpis.pctCumplimiento < 100 ? 'red' : 'blue'}
                />
            </div>

            {enProceso.length > 0 && (
                <Card className="border-none shadow-sm bg-amber-50 dark:bg-amber-950/30 rounded-[2rem]">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base font-bold text-amber-900 dark:text-amber-300">
                            Auditorías sin cerrar
                        </CardTitle>
                        <CardDescription className="text-amber-700/70 dark:text-amber-400/70">
                            Retoma la captura donde la dejaste.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {enProceso.map(a => <FilaAuditoria key={a.id} a={a} />)}
                    </CardContent>
                </Card>
            )}

            {/* Confiabilidad — la respuesta a "¿puedo confiar en las mediciones de esta gente?" */}
            <Card className="border-none shadow-sm dark:bg-slate-900 rounded-[2rem]">
                <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-center gap-3">
                        <div>
                            <CardTitle className="text-lg font-bold flex items-center gap-2">
                                <Users className="h-5 w-5 text-[#0b109f] dark:text-blue-400" />
                                Confiabilidad
                            </CardTitle>
                            <CardDescription>
                                Dos ejes: si <strong>mide bien</strong> lo que registra, y si <strong>registra</strong> lo que fabrica
                            </CardDescription>
                        </div>
                        <div className="ml-auto flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-full">
                            {(['preparador', 'sucursal'] as const).map(v => (
                                <button
                                    key={v}
                                    onClick={() => setVista(v)}
                                    className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${vista === v ? 'bg-white dark:bg-slate-700 text-[#0b109f] dark:text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    Por {v}
                                </button>
                            ))}
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {confiabilidad.length === 0 ? (
                        <p className="text-sm text-slate-400 py-4">
                            Todavía no hay lotes con medición de Calidad capturada.
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-200 dark:border-slate-700">
                                        <th className="text-left px-2 py-2 font-semibold text-slate-500 dark:text-slate-400">
                                            {vista === 'sucursal' ? 'Sucursal' : 'Preparador'}
                                        </th>
                                        {vista === 'preparador' && (
                                            <th className="text-left px-2 py-2 font-semibold text-slate-500 dark:text-slate-400">Sucursal</th>
                                        )}
                                        <th className="text-right px-2 py-2 font-semibold text-slate-500 dark:text-slate-400">Lotes</th>
                                        <th className="text-right px-2 py-2 font-semibold text-slate-500 dark:text-slate-400">Discrepancia</th>
                                        <th className="text-right px-2 py-2 font-semibold text-slate-500 dark:text-slate-400">Cumplimiento</th>
                                        <th className="px-2 py-2 w-1/4" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {confiabilidad.map((g, i) => (
                                        <tr key={`${g.sucursal}-${g.nombre}-${i}`} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                                            <td className="px-2 py-2.5 font-medium text-slate-800 dark:text-slate-200">
                                                {g.nombre}
                                                {g.nombre === 'Sin identificar' && (
                                                    <span className="block text-[10px] text-slate-400 font-normal">
                                                        lotes sin preparador conocido
                                                    </span>
                                                )}
                                            </td>
                                            {vista === 'preparador' && (
                                                <td className="px-2 py-2.5 text-slate-500 dark:text-slate-400">{g.sucursal}</td>
                                            )}
                                            <td className="px-2 py-2.5 text-right text-slate-500 tabular-nums">{g.n}</td>
                                            <td className={`px-2 py-2.5 text-right font-bold tabular-nums ${g.n === 0 ? 'text-slate-300' : !g.confiable ? 'text-slate-400' : g.pct > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                                {g.n === 0 ? '—' : `${g.pct.toFixed(0)}%`}
                                                {g.n > 0 && !g.confiable && <span className="ml-1 text-[10px] font-normal">(n bajo)</span>}
                                            </td>
                                            <td className={`px-2 py-2.5 text-right font-bold tabular-nums ${g.cumplimiento.pct < 100 ? 'text-purple-600 dark:text-purple-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                                {g.cumplimiento.pct.toFixed(0)}%
                                                {g.cumplimiento.sinRegistro > 0 && (
                                                    <span className="block text-[10px] font-normal text-slate-400">
                                                        {g.cumplimiento.sinRegistro} sin registrar
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-2 py-2.5">
                                                {/* Barra de severidad: el peor de los dos ejes. */}
                                                <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full ${g.severidad === 0 ? 'bg-emerald-500' : g.cumplimiento.pct < 100 && (100 - g.cumplimiento.pct) >= g.pct ? 'bg-purple-500' : 'bg-red-500'}`}
                                                        style={{ width: `${Math.max(2, g.severidad)}%` }}
                                                    />
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <p className="text-[11px] text-slate-400 mt-3">
                                Con menos de 5 lotes auditados el porcentaje se muestra en gris: un solo lote mueve demasiado la cifra.
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {cerradas.length > 0 && (
                <Card className="border-none shadow-sm dark:bg-slate-900 rounded-[2rem]">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg font-bold">Historial</CardTitle>
                        <CardDescription>{cerradas.length} auditoría{cerradas.length === 1 ? '' : 's'} cerrada{cerradas.length === 1 ? '' : 's'}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {cerradas.map(a => <FilaAuditoria key={a.id} a={a} />)}
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
