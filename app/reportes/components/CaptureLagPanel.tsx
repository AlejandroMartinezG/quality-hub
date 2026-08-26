'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Clock, CalendarCheck, AlertTriangle, Timer } from 'lucide-react'

interface CaptureLagPanelProps {
    records: any[]
}

// Días entre la fecha de fabricación declarada y el día en que se capturó el registro.
// Se comparan días calendario locales, no timestamps, para no contar horas sueltas.
function lagDays(record: any): number | null {
    if (!record?.fecha_fabricacion || !record?.created_at) return null
    const [y, m, d] = String(record.fecha_fabricacion).split('T')[0].split('-').map(Number)
    if (!y || !m || !d) return null
    const cre = new Date(record.created_at)
    if (isNaN(cre.getTime())) return null
    const fabDay = Date.UTC(y, m - 1, d)
    const creDay = Date.UTC(cre.getFullYear(), cre.getMonth(), cre.getDate())
    return Math.round((creDay - fabDay) / 86_400_000)
}

// Azul (al día) → rojo (rezago alto). Mismo criterio de heatmap del resto del panel.
function getHeatColor(ratio: number): string {
    const hue = Math.round((232 + ratio * 130) % 360)
    const light = Math.round(42 - ratio * 8)
    return `hsl(${hue},72%,${light}%)`
}

type Row = {
    sucursal: string
    preparador: string
    lotes: number
    promedio: number
    mismoDia: number
    masDe7: number
    peor: number
}

export default function CaptureLagPanel({ records = [] }: CaptureLagPanelProps) {
    const [sortKey, setSortKey] = useState<keyof Row>('promedio')
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

    const { rows, kpis } = useMemo(() => {
        const acc = new Map<string, { sucursal: string; preparador: string; lags: number[] }>()
        let total = 0, suma = 0, mismoDia = 0, masDe7 = 0, peor = 0

        for (const r of records) {
            const lag = lagDays(r)
            if (lag === null || lag < 0) continue   // negativos = fecha futura, se analizan aparte
            const sucursal = r.sucursal || '—'
            const preparador = r.nombre_preparador || '—'
            const key = `${sucursal}|${preparador}`
            if (!acc.has(key)) acc.set(key, { sucursal, preparador, lags: [] })
            acc.get(key)!.lags.push(lag)

            total++
            suma += lag
            if (lag === 0) mismoDia++
            if (lag > 7) masDe7++
            if (lag > peor) peor = lag
        }

        const rows: Row[] = Array.from(acc.values()).map((g) => {
            const n = g.lags.length
            return {
                sucursal: g.sucursal,
                preparador: g.preparador,
                lotes: n,
                promedio: g.lags.reduce((a, b) => a + b, 0) / n,
                mismoDia: (g.lags.filter(l => l === 0).length / n) * 100,
                masDe7: g.lags.filter(l => l > 7).length,
                peor: Math.max(...g.lags),
            }
        })

        return {
            rows,
            kpis: {
                promedio: total > 0 ? suma / total : 0,
                mismoDiaPct: total > 0 ? (mismoDia / total) * 100 : 0,
                masDe7,
                peor,
                total,
            }
        }
    }, [records])

    const maxProm = useMemo(() => Math.max(1, ...rows.map(r => r.promedio)), [rows])

    const sorted = useMemo(() => [...rows].sort((a, b) => {
        const av = a[sortKey], bv = b[sortKey]
        if (typeof av === 'string' || typeof bv === 'string') {
            return sortDir === 'desc'
                ? String(bv).localeCompare(String(av))
                : String(av).localeCompare(String(bv))
        }
        return sortDir === 'desc' ? (bv as number) - (av as number) : (av as number) - (bv as number)
    }), [rows, sortKey, sortDir])

    const th = (key: keyof Row, label: string, align: 'left' | 'right' = 'right') => (
        <th
            onClick={() => {
                if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
                else { setSortKey(key); setSortDir('desc') }
            }}
            className={`${align === 'left' ? 'text-left' : 'text-right'} px-2 py-2 font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap cursor-pointer hover:text-[#0b109f] dark:hover:text-blue-400 select-none`}
        >
            {label}{sortKey === key ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ' ↕'}
        </th>
    )

    if (kpis.total === 0) {
        return (
            <Card className="border-none shadow-sm dark:bg-slate-900 rounded-[2rem]">
                <CardHeader>
                    <CardTitle className="text-lg font-bold">Rezago de Captura</CardTitle>
                    <CardDescription>No hay registros en el período seleccionado.</CardDescription>
                </CardHeader>
            </Card>
        )
    }

    return (
        <div className="space-y-6">
            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border shadow-sm bg-white dark:bg-slate-900 rounded-[1.8rem] overflow-visible relative">
                    <CardContent className="p-6">
                        <div className="pr-10">
                            <p className="text-[10px] font-bold text-[#1828a8] dark:text-blue-400 uppercase tracking-widest">Rezago promedio</p>
                            <div className="text-5xl font-black text-slate-900 dark:text-white mt-3 tracking-tight">
                                {kpis.promedio.toFixed(1)}
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5">días entre fabricar y capturar</p>
                        </div>
                        <div className="absolute -top-3 -right-3 p-4 bg-blue-100 dark:bg-blue-900/50 rounded-2xl shadow-lg border-4 border-white dark:border-slate-800">
                            <Clock className="h-10 w-10 text-[#0b109f] dark:text-blue-400" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border shadow-sm bg-white dark:bg-slate-900 rounded-[1.8rem] overflow-visible relative">
                    <CardContent className="p-6">
                        <div className="pr-10">
                            <p className="text-[10px] font-bold text-green-600 dark:text-green-400 uppercase tracking-widest">Capturado el mismo día</p>
                            <div className="text-5xl font-black text-slate-900 dark:text-white mt-3 tracking-tight">
                                {kpis.mismoDiaPct.toFixed(0)}<span className="text-2xl">%</span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5">de {kpis.total.toLocaleString()} lotes</p>
                        </div>
                        <div className="absolute -top-3 -right-3 p-4 bg-green-100 dark:bg-green-900/50 rounded-2xl shadow-lg border-4 border-white dark:border-slate-800">
                            <CalendarCheck className="h-10 w-10 text-green-700 dark:text-green-400" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border shadow-sm bg-white dark:bg-slate-900 rounded-[1.8rem] overflow-visible relative">
                    <CardContent className="p-6">
                        <div className="pr-10">
                            <p className="text-[10px] font-bold text-[#b82820] dark:text-red-400 uppercase tracking-widest">Con más de 7 días</p>
                            <div className="text-5xl font-black text-slate-900 dark:text-white mt-3 tracking-tight">
                                {kpis.masDe7.toLocaleString()}
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                                {((kpis.masDe7 / kpis.total) * 100).toFixed(1)}% del total
                            </p>
                        </div>
                        <div className="absolute -top-3 -right-3 p-4 bg-red-100 dark:bg-red-900/50 rounded-2xl shadow-lg border-4 border-white dark:border-slate-800">
                            <AlertTriangle className="h-10 w-10 text-[#b82820] dark:text-red-400" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border shadow-sm bg-white dark:bg-slate-900 rounded-[1.8rem] overflow-visible relative">
                    <CardContent className="p-6">
                        <div className="pr-10">
                            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Peor rezago</p>
                            <div className="text-5xl font-black text-slate-900 dark:text-white mt-3 tracking-tight">
                                {kpis.peor}
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5">días de retraso máximo</p>
                        </div>
                        <div className="absolute -top-3 -right-3 p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl shadow-lg border-4 border-white dark:border-slate-800">
                            <Timer className="h-10 w-10 text-slate-600 dark:text-slate-300" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Detalle por preparador */}
            <Card className="border-none shadow-sm dark:bg-slate-900 rounded-[2rem]">
                <CardHeader>
                    <CardTitle className="text-lg font-bold">Rezago de Captura por Preparador</CardTitle>
                    <CardDescription className="text-xs">
                        Días transcurridos entre la fecha de fabricación declarada y el momento en que se registró el lote.
                        Un rezago alto significa que las desviaciones de calidad se detectan tarde.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs border-collapse">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-700">
                                    {th('sucursal', 'Sucursal', 'left')}
                                    {th('preparador', 'Preparador', 'left')}
                                    {th('lotes', 'Lotes')}
                                    {th('promedio', 'Rezago prom.')}
                                    {th('mismoDia', 'Mismo día')}
                                    {th('masDe7', '+7 días')}
                                    {th('peor', 'Peor')}
                                </tr>
                            </thead>
                            <tbody>
                                {sorted.map(r => (
                                    <tr
                                        key={`${r.sucursal}|${r.preparador}`}
                                        className="border-b border-slate-50 dark:border-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                                    >
                                        <td className="px-2 py-2 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">{r.sucursal}</td>
                                        <td className="px-2 py-2 text-slate-600 dark:text-slate-300 whitespace-nowrap">{r.preparador}</td>
                                        <td className="px-2 py-2 text-right tabular-nums text-slate-500 dark:text-slate-400">{r.lotes.toLocaleString()}</td>
                                        <td className="px-2 py-2 text-right">
                                            <span
                                                className="inline-block min-w-[3.5rem] rounded-lg px-2 py-1 font-bold tabular-nums text-white"
                                                style={{ backgroundColor: getHeatColor(Math.min(1, r.promedio / maxProm)) }}
                                            >
                                                {r.promedio.toFixed(1)} d
                                            </span>
                                        </td>
                                        <td className="px-2 py-2 text-right tabular-nums font-semibold text-slate-700 dark:text-slate-200">
                                            {r.mismoDia.toFixed(0)}%
                                        </td>
                                        <td className={`px-2 py-2 text-right tabular-nums font-bold ${r.masDe7 > 0 ? 'text-[#b82820] dark:text-red-400' : 'text-slate-300 dark:text-slate-600'}`}>
                                            {r.masDe7}
                                        </td>
                                        <td className="px-2 py-2 text-right tabular-nums text-slate-500 dark:text-slate-400">{r.peor} d</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <p className="mt-4 text-[11px] text-slate-400 dark:text-slate-500">
                        El rezago se mide contra la fecha de fabricación que captura el preparador. Se excluyen los registros
                        con fecha posterior al día de captura, que indicarían una fecha mal escrita.
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}
