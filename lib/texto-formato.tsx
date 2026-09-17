"use client"

import React from "react"

/**
 * Formato ligero para los textos que escribe Calidad en las auditorías.
 *
 * Soporta un subconjunto pequeño de Markdown más algunas marcas propias, para
 * dar jerarquía a unas observaciones sin convertirlo en un editor completo:
 *
 *   **negritas**      *cursivas*      __subrayado__
 *   !!rojo!!          ++verde++       ==resaltado==
 *   # ## ###          títulos
 *   - o *             viñetas
 *   1.                lista numerada
 *   línea vacía       párrafo nuevo
 *   salto simple      salto de línea
 *
 * Se construyen elementos de React, no cadenas de HTML: así el texto del usuario
 * nunca se interpreta como marcado y no hace falta sanitizar nada. Estos reportes
 * salen del sistema hacia gerencia y dirección.
 *
 * Los colores se fijan explícitos (fondo y texto) y son legibles tanto sobre el
 * blanco del PDF como sobre el tema oscuro en pantalla. Lo demás no fija color,
 * para heredar el del contenedor.
 */

// Orden importante: las marcas dobles van antes que la cursiva simple, o el
// asterisco suelto se comería el inicio de `**negritas**`.
const INLINE = /(\*\*[^*\n]+\*\*|__[^_\n]+__|==[^=\n]+==|!![^!\n]+!!|\+\+[^+\n]+\+\+|\*[^*\n]+\*)/g

const ROJO = '#dc2626'
const VERDE = '#059669'

/** Aplica las marcas de énfasis dentro de una línea. */
function conEnfasis(linea: string, clave: string): React.ReactNode[] {
    return linea.split(INLINE).filter(Boolean).map((parte, i) => {
        const k = `${clave}-${i}`
        const interior = (n: number) => parte.slice(n, -n)

        if (parte.startsWith('**') && parte.endsWith('**') && parte.length > 4)
            return <strong key={k} style={{ fontWeight: 700 }}>{interior(2)}</strong>

        if (parte.startsWith('__') && parte.endsWith('__') && parte.length > 4)
            return <u key={k} style={{ textDecoration: 'underline' }}>{interior(2)}</u>

        if (parte.startsWith('==') && parte.endsWith('==') && parte.length > 4)
            return (
                <mark key={k} style={{ backgroundColor: '#fef08a', color: '#713f12', padding: '0 2px', borderRadius: '2px' }}>
                    {interior(2)}
                </mark>
            )

        if (parte.startsWith('!!') && parte.endsWith('!!') && parte.length > 4)
            return <span key={k} style={{ color: ROJO, fontWeight: 600 }}>{interior(2)}</span>

        if (parte.startsWith('++') && parte.endsWith('++') && parte.length > 4)
            return <span key={k} style={{ color: VERDE, fontWeight: 600 }}>{interior(2)}</span>

        if (parte.startsWith('*') && parte.endsWith('*') && parte.length > 2)
            return <em key={k} style={{ fontStyle: 'italic' }}>{interior(1)}</em>

        return <React.Fragment key={k}>{parte}</React.Fragment>
    })
}

// `* ` y `- ` al inicio de línea son viñeta. No choca con la cursiva porque
// `*cursiva*` no lleva espacio después del asterisco.
const VINETA = /^\s*[-*]\s+(.*)$/
const NUMERADA = /^\s*\d+[.)]\s+(.*)$/
const TITULO = /^(#{1,3})\s+(.*)$/

type Bloque =
    | { tipo: 'parrafo'; lineas: string[] }
    | { tipo: 'vinetas'; lineas: string[] }
    | { tipo: 'numerada'; lineas: string[] }
    | { tipo: 'titulo'; lineas: string[]; nivel: number }

/** Agrupa las líneas en títulos, párrafos y listas. */
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

        // Cada título es su propio bloque; nunca se agrupa con el siguiente.
        const titulo = linea.match(TITULO)
        if (titulo) {
            if (actual) bloques.push(actual)
            actual = null
            bloques.push({ tipo: 'titulo', lineas: [titulo[2]], nivel: titulo[1].length })
            continue
        }

        const vineta = linea.match(VINETA)
        const numerada = !vineta ? linea.match(NUMERADA) : null

        const tipo: Exclude<Bloque['tipo'], 'titulo'> =
            vineta ? 'vinetas' : numerada ? 'numerada' : 'parrafo'
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

const TAMANO_TITULO: Record<number, string> = { 1: '1.35em', 2: '1.18em', 3: '1.05em' }

export function TextoFormateado({ texto }: { texto?: string | null }) {
    if (!texto || !texto.trim()) return null

    return (
        <>
            {enBloques(texto).map((bloque, b) => {
                if (bloque.tipo === 'titulo') {
                    return (
                        <div
                            key={b}
                            style={{
                                fontSize: TAMANO_TITULO[bloque.nivel] || '1em',
                                fontWeight: 800,
                                margin: b === 0 ? '0 0 6px' : '12px 0 6px',
                            }}
                        >
                            {conEnfasis(bloque.lineas[0], `${b}-0`)}
                        </div>
                    )
                }

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
                    <Lista key={b} style={{ margin: '0 0 8px', paddingLeft: '18px' }}>
                        {bloque.lineas.map((l, i) => (
                            <li key={i} style={{ marginBottom: '4px' }}>{conEnfasis(l, `${b}-${i}`)}</li>
                        ))}
                    </Lista>
                )
            })}
        </>
    )
}

/** Ayuda breve de la sintaxis, para mostrar junto a los campos de texto. */
export const AYUDA_FORMATO =
    '**negritas** · *cursivas* · __subrayado__ · !!rojo!! · ++verde++ · ==resaltado== · "- " viñetas · "### " título'
