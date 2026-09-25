'use client'

import { formatFecha } from "@/lib/utils"
import { TextoFormateado } from "@/lib/texto-formato"
import { APPEARANCE_STANDARDS, PRODUCT_STANDARDS, PH_STANDARDS } from "@/lib/production-constants"
import {
    COLOR_RESULTADO_PDF, ETIQUETA_VEREDICTO, TOLERANCIAS, tasaCumplimiento,
    type Comparacion, type NivelParametro,
} from "@/lib/auditoria-utils"
import type { Evidencia } from "./GaleriaEvidencia"

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
    evidenciasPorLote?: Map<string, Evidencia[]>
    evidenciasGenerales?: Evidencia[]
    /**
     * Miniaturas ya convertidas a `data:` URI, por id de evidencia.
     * html2canvas no rasteriza imágenes remotas de forma confiable, así que el
     * reporte nunca recibe URLs: las recibe embebidas.
     */
    fotosPdf?: Record<string, string>
}

const COLOR_NIVEL: Record<NivelParametro, string> = {
    ok: '#047857',
    desviacion: '#b45309',
    discrepancia: '#b91c1c',
    na: '#94a3b8',
}

/**
 * Rejilla de miniaturas con su número y pie de foto.
 *
 * `ancho` se achica para las fotos que van dentro del bloque de un lote: así
 * caben cuatro en una fila sin desbordar el ancho útil de la página.
 *
 * Las imágenes van a ancho fijo y ALTO NATURAL, sin caja de recorte ni
 * `object-fit`: html2canvas no soporta bien `object-fit` dentro de un contenedor
 * de altura fija con `overflow: hidden`, y las dibujaba en blanco en el PDF
 * aunque en pantalla se vieran correctas. Las filas quedan algo desparejas según
 * la foto sea horizontal o vertical, que es preferible a un recuadro vacío.
 *
 * El ancho va en píxeles y no en centímetros porque html2canvas trabaja en px;
 * convertir unidades físicas es otra fuente de resultados raros al rasterizar.
 */
function RejillaFotos({ fotos, fotosPdf, ancho = 174 }: {
    fotos: Evidencia[]
    fotosPdf: Record<string, string>
    /** Ancho de cada miniatura en píxeles. */
    ancho?: number
}) {
    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'flex-start' }}>
            {fotos.map(ev => {
                const src = fotosPdf[ev.id]
                return (
                    <div key={ev.id} style={{ width: `${ancho}px` }}>
                        {src ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={src}
                                alt={ev.descripcion || `Foto ${ev.numero}`}
                                style={{
                                    width: `${ancho}px`, height: 'auto', display: 'block',
                                    borderRadius: '6px', border: '1px solid #e2e8f0',
                                }}
                            />
                        ) : (
                            <div style={{
                                width: `${ancho}px`, height: `${Math.round(ancho * 0.75)}px`,
                                borderRadius: '6px', border: '1px solid #e2e8f0',
                                backgroundColor: '#f8fafc',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '7pt', color: '#cbd5e1',
                            }}>
                                Sin vista previa
                            </div>
                        )}
                        <div style={{ fontSize: '7.5pt', color: '#334155', marginTop: '2px' }}>
                            <strong>Foto {ev.numero}</strong>
                            {ev.descripcion && <span style={{ color: '#64748b' }}> · {ev.descripcion}</span>}
                        </div>
                    </div>
                )
            })}
        </div>
    )
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

export default function ReporteAuditoria({
    auditoria, lotes, comparaciones,
    evidenciasPorLote, evidenciasGenerales = [], fotosPdf = {},
}: Props) {
    // Los lotes sin registro se separan: no tienen lado del operador, así que no
    // entran en la tabla de comparaciones ni en el porcentaje de discrepancia.
    const sinRegistro = lotes.filter(l => l.origen === 'SIN_REGISTRO')
    const registrados = lotes.filter(l => l.origen !== 'SIN_REGISTRO')
    const cumplimiento = tasaCumplimiento(lotes)

    const vals = registrados.map(l => comparaciones.get(l.id)).filter(Boolean) as Comparacion[]
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

    const conDiscrepancia = registrados.filter(l => comparaciones.get(l.id)?.resultado === 'DISCREPANCIA')

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
                        {
                            label: '% cumplimiento registro',
                            valor: `${cumplimiento.pct.toFixed(0)}%`,
                            bg: cumplimiento.pct < 100 ? '#f3e8ff' : '#f8fafc',
                            fg: cumplimiento.pct < 100 ? '#7e22ce' : '#334155',
                        },
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
                    {' '}<strong>Cumplimiento de registro</strong> = proporción de los lotes inspeccionados en campo
                    que sí tenían captura en la plataforma.
                </p>
            </div>

            {/* --- Lotes sin registro --- */}
            {/* Va ANTES del detalle de lotes verificados: es el hallazgo que se
                pierde si queda al final o dentro de las observaciones. */}
            {sinRegistro.length > 0 && (
                <div className="print-no-break" style={{
                    marginBottom: '16px', padding: '10px 12px',
                    backgroundColor: '#faf5ff', border: '1.5px solid #d8b4fe', borderRadius: '8px',
                }}>
                    <h3 style={{ fontSize: '11pt', fontWeight: 800, margin: '0 0 4px', color: '#7e22ce' }}>
                        Lotes sin registro en la plataforma
                    </h3>
                    <p style={{ fontSize: '8.5pt', color: '#6b21a8', margin: '0 0 8px' }}>
                        Producto encontrado físicamente en sucursal del que <strong>no existe captura
                        en la Bitácora de Producción y Calidad</strong>. Sin registro no hay trazabilidad
                        del lote ni forma de contrastar las mediciones del operador.
                    </p>

                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                <th style={{ ...th, borderBottom: '1px solid #d8b4fe', color: '#6b21a8' }}>Producto</th>
                                <th style={{ ...th, borderBottom: '1px solid #d8b4fe', color: '#6b21a8' }}>Tamaño</th>
                                <th style={{ ...th, borderBottom: '1px solid #d8b4fe', color: '#6b21a8' }}>Inspeccionado</th>
                                <th style={{ ...th, borderBottom: '1px solid #d8b4fe', color: '#6b21a8' }}>Preparador</th>
                                <th style={{ ...th, borderBottom: '1px solid #d8b4fe', color: '#6b21a8' }}>Medición de Calidad</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sinRegistro.map(l => {
                                const c = comparaciones.get(l.id)
                                const fuera = c?.parametros.filter(p => p.nivel === 'discrepancia' || p.nivel === 'desviacion') || []
                                const medidos = c?.parametros.filter(p => p.nivel !== 'na') || []
                                return (
                                    <tr key={l.id}>
                                        <td style={{ ...td, borderBottom: '1px solid #f3e8ff', fontWeight: 700 }}>
                                            {l.codigo_producto}
                                        </td>
                                        <td style={{ ...td, borderBottom: '1px solid #f3e8ff', fontSize: '8pt' }}>
                                            {l.tamano_lote ? `${l.tamano_lote} L` : '—'}
                                        </td>
                                        <td style={{ ...td, borderBottom: '1px solid #f3e8ff', fontSize: '8pt' }}>
                                            {formatFecha(auditoria.fecha_auditoria)}
                                        </td>
                                        <td style={{ ...td, borderBottom: '1px solid #f3e8ff', fontSize: '8pt' }}>
                                            {l.nombre_preparador || <span style={{ color: '#a78bfa' }}>no identificado</span>}
                                        </td>
                                        <td style={{ ...td, borderBottom: '1px solid #f3e8ff', fontSize: '8pt' }}>
                                            {medidos.length === 0 ? (
                                                <span style={{ color: '#a78bfa' }}>sin medir</span>
                                            ) : fuera.length > 0 ? (
                                                <strong style={{ color: '#b91c1c' }}>
                                                    fuera de especificación — {fuera.map(p => `${p.nombre} ${p.valorCalidad}`).join(' · ')}
                                                </strong>
                                            ) : (
                                                <span style={{ color: '#047857' }}>dentro de especificación</span>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* --- Detalle por lote --- */}
            <h3 style={{ fontSize: '11pt', fontWeight: 800, margin: '0 0 8px', color: '#0e0c9b' }}>
                Lotes verificados
            </h3>

            {registrados.map(lote => {
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
                            <div style={{ padding: '6px 10px', fontSize: '8pt', color: '#475569', backgroundColor: '#fafafa', borderTop: '1px solid #f1f5f9', lineHeight: 1.4 }}>
                                <div style={{ color: '#64748b', fontWeight: 700, marginBottom: '2px' }}>Notas</div>
                                <TextoFormateado texto={lote.notas} />
                            </div>
                        )}

                        {(() => {
                            const fotos = evidenciasPorLote?.get(lote.id) || []
                            if (fotos.length === 0) return null
                            return (
                                <div style={{ padding: '6px 10px', borderTop: '1px solid #f1f5f9' }}>
                                    <div style={{
                                        fontSize: '8pt', color: '#64748b', fontWeight: 700, marginBottom: '4px',
                                    }}>
                                        Evidencia
                                    </div>
                                    <RejillaFotos fotos={fotos} fotosPdf={fotosPdf} ancho={144} />
                                </div>
                            )
                        })()}
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
                    lineHeight: 1.45,
                }}>
                    {auditoria.observaciones
                        ? <TextoFormateado texto={auditoria.observaciones} />
                        : 'Sin observaciones registradas.'}
                </div>
            </div>

            {/* --- Evidencia general --- */}
            {/* Las fotos de cada lote van dentro de su propio bloque; aquí solo
                quedan las de la visita, que no pertenecen a ningún lote. */}
            {evidenciasGenerales.length > 0 && (
                <div className="print-no-break" style={{ marginTop: '16px' }}>
                    <h3 style={{ fontSize: '10pt', fontWeight: 800, margin: '0 0 6px', color: '#0e0c9b' }}>
                        Evidencia general de la visita
                    </h3>
                    <RejillaFotos fotos={evidenciasGenerales} fotosPdf={fotosPdf} />
                </div>
            )}

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
