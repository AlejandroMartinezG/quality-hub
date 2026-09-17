"use client"

import React from "react"

/**
 * Formato ligero para los textos que escribe Calidad en las auditorías.
 *
 * Soporta un subconjunto pequeño de Markdown, suficiente para dar jerarquía a
 * unas observaciones sin convertirlo en un editor:
 *
 *   **negritas**        *cursivas*
 *   - viñeta            1. lista numerada
 *   línea vacía         = párrafo nuevo
 *   salto simple        = salto de línea
 *
 * Se construyen elementos de React, no cadenas de HTML: así el texto del usuario
 * nunca se interpreta como marcado y no hace falta sanitizar nada.
 *
 * Todo el estilo va inline y sin color propio, para que herede el del contenedor.
 * Eso permite usar el mismo componente en pantalla (con tema claro u oscuro) y
 * en el PDF, donde html2canvas necesita estilos computados.
 */

// Se captura `**negrita**` antes que `*cursiva*` para que el asterisco doble gane.
const INLINE = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g

/** Aplica negritas y cursivas dentro de una línea. */
function conEnfasis(linea: string, clave: string): React.ReactNode[] {
    return linea.split(INLINE).filter(Boolean).map((parte, i) => {
        const k = `${clave}-${i}`
        if (parte.startsWith('**') && parte.endsWith('**') && parte.length > 4) {
            return <strong key={k} style={{ fontWeight: 700 }}>{parte.slice(2, -2)}</strong>
        }
        if (parte.startsWith('*') && parte.endsWith('*') && parte.length > 2) {
            return <em key={k} style={{ fontStyle: 'italic' }}>{parte.slice(1, -1)}</em>
        }
        return <React.Fragment key={k}>{parte}</React.Fragment>
    })
}

// Solo `- ` para viñetas: aceptar `* ` chocaría con la cursiva.
const VINETA = /^\s*-\s+(.*)$/
const NUMERADA = /^\s*\d+[.)]\s+(.*)$/

type Bloque =
    | { tipo: 'parrafo'; lineas: string[] }
    | { tipo: 'vinetas'; lineas: string[] }
    | { tipo: 'numerada'; lineas: string[] }

/** Agrupa las líneas en párrafos y listas. */
function enBloques(texto: string): Bloque[] {
    const bloques: Bloque[] = []
    let actual: Bloque | null = null

    for (const cruda of texto.split(/\r?\n/)) {
        const linea = cruda.trimEnd()

        // Línea vacía: cierra el bloque en curso y abre un párrafo nuevo.
        if (linea.trim() === '') {
            if (actual) bloques.push(actual)
            actual = null
            continue
        }

        const vineta = linea.match(VINETA)
        const numerada = !vineta ? linea.match(NUMERADA) : null

        const tipo: Bloque['tipo'] = vineta ? 'vinetas' : numerada ? 'numerada' : 'parrafo'
        const contenido = vineta ? vineta[1] : numerada ? numerada[1] : linea

        if (actual && actual.tipo === tipo) {
            actual.lineas.push(contenido)
        } else {
            if (actual) bloques.push(actual)
            actual = { tipo, lineas: [contenido] }
        }
    }

    if (actual) bloques.push(actual)
    return bloques
}

const margenLista: React.CSSProperties = { margin: '0 0 6px', paddingLeft: '18px' }

export function TextoFormateado({ texto }: { texto?: string | null }) {
    if (!texto || !texto.trim()) return null

    return (
        <>
            {enBloques(texto).map((bloque, b) => {
                if (bloque.tipo === 'parrafo') {
                    return (
                        <p key={b} style={{ margin: '0 0 6px' }}>
                            {bloque.lineas.map((l, i) => (
                                <React.Fragment key={i}>
                                    {i > 0 && <br />}
                                    {conEnfasis(l, `${b}-${i}`)}
                                </React.Fragment>
                            ))}
                        </p>
                    )
                }
                const Lista = bloque.tipo === 'vinetas' ? 'ul' : 'ol'
                return (
                    <Lista key={b} style={margenLista}>
                        {bloque.lineas.map((l, i) => (
                            <li key={i} style={{ marginBottom: '2px' }}>{conEnfasis(l, `${b}-${i}`)}</li>
                        ))}
                    </Lista>
                )
            })}
        </>
    )
}

/** Ayuda breve de la sintaxis, para mostrar junto a los campos de texto. */
export const AYUDA_FORMATO = '**negritas** · *cursivas* · "- " para viñetas · "1. " para listas numeradas'
