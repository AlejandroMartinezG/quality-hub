'use client'

import { formatFecha } from "@/lib/utils"
import { APPEARANCE_STANDARDS, PRODUCT_STANDARDS, PH_STANDARDS } from "@/lib/production-constants"
import {
    COLOR_RESULTADO_PDF, ETIQUETA_VEREDICTO, TOLERANCIAS,
    type Comparacion, type NivelParametro,
} from "@/lib/auditoria-utils"

/**
 * Vista imprimible de una auditoría.
 *
 * Todo el estilo va inline a propósito: html2canvas necesita estilos computados,
 * y las variantes `dark:` de Tailwind producirían un PDF con fondo oscuro. Es la
 * misma regla que sigue la vista de impresión de los reportes SPY.
 */

interface Props {
    auditoria: any
    lotes: any[]
    comparaciones: Map<string, Comparacion>
}

const COLOR_NIVEL: Record<NivelParametro, string> = {
    ok: '#047857',
    desviacion: '#b45309',
    discrepancia: '#b91c1c',
    na: '#94a3b8',
}

const th: React.CSSProperties = {
    textAlign: 'left', padding: '5px 6px', fontSize: '8.5pt', fontWeight: 700,
    color: '#475569', borderBottom: '1px solid #cbd5e1', textTransform: 'uppercase',
    letterSpacing: '0.03em',
}

const td: React.CSSProperties = {
    padding: '5px 6px', fontSize: '9pt', color: '#1e293b',
    borderBottom: '1px solid #f1f5f9', verticalAlign: 'top',
}

export default function ReporteAuditoria({ auditoria, lotes, comparaciones }: Props) {
    const vals = lotes.map(l => comparaciones.get(l.id)).filter(Boolean) as Comparacion[]
    const resumen = {
        total: vals.length,
        ok: vals.filter(c => c.resultado === 'COINCIDE').length,
        amarillo: vals.filter(c => c.resultado === 'DESVIACION').length,
        rojo: vals.filter(c => c.resultado === 'DISCREPANCIA').length,
        pendiente: vals.filter(c => c.resultado === 'PENDIENTE').length,
    }
    const evaluados = resumen.total - resumen.pendiente
    const pctRojo = evaluados > 0 ? (resumen.rojo / evaluados) * 100 : 0

    const preparadores = Array.from(
        new Set(lotes.map(l => l.nombre_preparador).filter(Boolean))
    )

    const conDiscrepancia = lotes.filter(l => comparaciones.get(l.id)?.resultado === 'DISCREPANCIA')

    return (
        <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', color: '#1e293b' }}>

            {/* --- Datos de la visita --- */}
            <div className="print-no-break" style={{ marginBottom: '14px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt' }}>
                    <tbody>
                        <tr>
                            <td style={{ padding: '3px 0', width: '20%', color: '#64748b', fontWeight: 600 }}>Sucursal</td>
                            <td style={{ padding: '3px 0', width: '30%', fontWeight: 700 }}>{auditoria.sucursal}</td>
                            <td style={{ padding: '3px 0', width: '20%', color: '#64748b', fontWeight: 600 }}>Fecha de visita</td>
                            <td style={{ padding: '3px 0', fontWeight: 700 }}>{formatFecha(auditoria.fecha_auditoria)}</td>
                        </tr>
                        <tr>
                            <td style={{ padding: '3px 0', color: '#64748b', fontWeight: 600 }}>Auditor</td>
                            <td style={{ padding: '3px 0' }}>{auditoria.auditor_nombre || '—'}</td>
                            <td style={{ padding: '3px 0', color: '#64748b', fontWeight: 600 }}>Preparador(es)</td>
                            <td style={{ padding: '3px 0' }}>{preparadores.join(', ') || '—'}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* --- Resumen --- */}
            <div className="print-no-break" style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {[
                        { label: 'Lotes verificados', valor: evaluados, bg: '#eff6ff', fg: '#1d4ed8' },
                        { label: 'Coinciden', valor: resumen.ok, bg: '#d1fae5', fg: '#047857' },
                        { label: 'Desviación', valor: resumen.amarillo, bg: '#fef3c7', fg: '#b45309' },
                        { label: 'Discrepancia', valor: resumen.rojo, bg: '#fee2e2', fg: '#b91c1c' },
                        { label: '% discrepancia', valor: `${pctRojo.toFixed(0)}%`, bg: '#f8fafc', fg: '#334155' },
                    ].map(k => (
                        <div key={k.label} style={{
                            flex: '1 1 0', minWidth: '90px', padding: '8px 10px',
                            backgroundColor: k.bg, borderRadius: '8px', textAlign: 'center',
                        }}>
                            <div style={{ fontSize: '18pt', fontWeight: 800, color: k.fg, lineHeight: 1.1 }}>{k.valor}</div>
                            <div style={{ fontSize: '7pt', fontWeight: 700, color: k.fg, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                {k.label}
                            </div>
                        </div>
                    ))}
                </div>
                {resumen.pendiente > 0 && (
                    <p style={{ fontSize: '8pt', color: '#b45309', marginTop: '6px' }}>
                        {resumen.pendiente} lote{resumen.pendiente === 1 ? '' : 's'} quedaron sin medición de Calidad y no entran en los porcentajes.
                    </p>
                )}
                <p style={{ fontSize: '7.5pt', color: '#94a3b8', marginTop: '4px' }}>
                    Criterio: <strong>Discrepancia</strong> = la medición de Calidad cambia el veredicto de conformidad.
                    {' '}<strong>Desviación</strong> = mismo veredicto, pero la diferencia supera la tolerancia
                    (pH ±{TOLERANCIAS.ph} · sólidos ±{TOLERANCIAS.solidos} pp).
                </p>
            </div>

            {/* --- Detalle por lote --- */}
            <h3 style={{ fontSize: '11pt', fontWeight: 800, margin: '0 0 8px', color: '#0e0c9b' }}>
                Lotes verificados
            </h3>

            {lotes.map(lote => {
                const c = comparaciones.get(lote.id)
                if (!c) return null
                const color = COLOR_RESULTADO_PDF[c.resultado]
                const stdSol = PRODUCT_STANDARDS[lote.codigo_producto]
                const stdPh = PH_STANDARDS[lote.codigo_producto]
                const stdApp = APPEARANCE_STANDARDS[lote.codigo_producto]

                return (
                    <div key={lote.id} className="print-no-break" style={{
                        marginBottom: '12px', border: '1px solid #e2e8f0',
                        borderRadius: '8px', overflow: 'hidden',
                    }}>
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '6px 10px', backgroundColor: '#f8fafc',
                            borderBottom: '1px solid #e2e8f0',
                        }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '9.5pt', fontWeight: 800, fontFamily: 'monospace' }}>
                                    {lote.lote_producto || lote.codigo_producto}
                                </div>
                                <div style={{ fontSize: '8pt', color: '#64748b' }}>
                                    {lote.codigo_producto} · {lote.nombre_preparador || '—'} · fabricado {formatFecha(lote.fecha_fabricacion)}
                                </div>
                            </div>
                            <div style={{
                                padding: '3px 10px', borderRadius: '999px',
                                backgroundColor: color.bg, color: color.fg,
                                fontSize: '8pt', fontWeight: 800, whiteSpace: 'nowrap',
                            }}>
                                {color.label}
                            </div>
                        </div>

                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    <th style={{ ...th, width: '22%' }}>Parámetro</th>
                                    <th style={{ ...th, textAlign: 'right', width: '18%' }}>Operador</th>
                                    <th style={{ ...th, textAlign: 'right', width: '18%' }}>Calidad</th>
                                    <th style={{ ...th, textAlign: 'right', width: '12%' }}>Δ</th>
                                    <th style={{ ...th, width: '30%' }}>Veredicto</th>
                                </tr>
                            </thead>
                            <tbody>
                                {c.parametros.map(p => {
                                    const ref = p.clave === 'ph' && stdPh
                                        ? (stdPh.min === stdPh.max ? `${stdPh.min}` : `${stdPh.min}–${stdPh.max}`)
                                        : p.clave === 'solidos' && stdSol ? `${stdSol.min}–${stdSol.max}%`
                                        : p.clave === 'apariencia' && stdApp ? stdApp
                                        : null
                                    const cambio = p.veredictoOperador && p.veredictoOperador !== p.veredictoCalidad
                                    return (
                                        <tr key={p.clave}>
                                            <td style={td}>
                                                <strong>{p.nombre}</strong>
                                                {ref && <div style={{ fontSize: '7pt', color: '#94a3b8' }}>Ref: {ref}</div>}
                                            </td>
                                            <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                                {p.valorOperador}
                                            </td>
                                            <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                                                {p.valorCalidad}
                                            </td>
                                            <td style={{
                                                ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums',
                                                fontWeight: 700, color: COLOR_NIVEL[p.nivel],
                                            }}>
                                                {p.delta === null ? '—' : `${p.delta > 0 ? '+' : ''}${p.delta.toFixed(2)}`}
                                            </td>
                                            <td style={{ ...td, fontSize: '8pt', color: COLOR_NIVEL[p.nivel] }}>
                                                {p.nivel === 'na' ? (
                                                    <span style={{ color: '#cbd5e1' }}>sin medir</span>
                                                ) : p.veredictoOperador ? (
                                                    <>
                                                        {ETIQUETA_VEREDICTO[p.veredictoOperador]}
                                                        {cambio && <strong> → {ETIQUETA_VEREDICTO[p.veredictoCalidad!]}</strong>}
                                                    </>
                                                ) : (
                                                    p.nivel === 'ok' ? 'coincide' : 'difiere'
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>

                        {lote.notas && (
                            <div style={{ padding: '6px 10px', fontSize: '8pt', color: '#475569', backgroundColor: '#fafafa', borderTop: '1px solid #f1f5f9' }}>
                                <strong style={{ color: '#64748b' }}>Notas: </strong>{lote.notas}
                            </div>
                        )}
                    </div>
                )
            })}

            {/* --- Hallazgos --- */}
            {conDiscrepancia.length > 0 && (
                <div className="print-no-break" style={{
                    marginTop: '16px', padding: '10px 12px',
                    backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px',
                }}>
                    <h3 style={{ fontSize: '10pt', fontWeight: 800, margin: '0 0 6px', color: '#b91c1c' }}>
                        Hallazgos que requieren atención
                    </h3>
                    <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '8.5pt', color: '#7f1d1d' }}>
                        {conDiscrepancia.map(l => {
                            const c = comparaciones.get(l.id)!
                            const params = c.parametros.filter(p => p.nivel === 'discrepancia')
                            return (
                                <li key={l.id} style={{ marginBottom: '3px' }}>
                                    <strong style={{ fontFamily: 'monospace' }}>{l.lote_producto || l.codigo_producto}</strong>
                                    {' — '}
                                    {params.map(p => `${p.nombre}: ${p.valorOperador} → ${p.valorCalidad}`).join(' · ')}
                                    {l.nombre_preparador && ` (${l.nombre_preparador})`}
                                </li>
                            )
                        })}
                    </ul>
                </div>
            )}

            {/* --- Observaciones --- */}
            <div className="print-no-break" style={{ marginTop: '16px' }}>
                <h3 style={{ fontSize: '10pt', fontWeight: 800, margin: '0 0 6px', color: '#0e0c9b' }}>
                    Observaciones de la visita
                </h3>
                <div style={{
                    minHeight: '40px', padding: '8px 10px', fontSize: '9pt',
                    border: '1px solid #e2e8f0', borderRadius: '8px',
                    color: auditoria.observaciones ? '#1e293b' : '#cbd5e1',
                    whiteSpace: 'pre-wrap',
                }}>
                    {auditoria.observaciones || 'Sin observaciones registradas.'}
                </div>
            </div>

            {/* --- Firmas --- */}
            <div className="print-no-break" style={{ marginTop: '32px', display: 'flex', gap: '40px' }}>
                {['Auditor de Calidad', 'Gerente de Sucursal'].map(rol => (
                    <div key={rol} style={{ flex: 1, textAlign: 'center' }}>
                        <div style={{ borderTop: '1px solid #94a3b8', paddingTop: '4px', fontSize: '8pt', color: '#64748b' }}>
                            {rol}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
