"use client"

import { useEffect, useState } from "react"

/**
 * Rango de fechas para los módulos de análisis.
 *
 * Separa la fecha que el usuario ESCRIBE de la que se CONSULTA, por dos
 * razones que juntas hacían fluctuar las cifras en pantalla:
 *
 * 1. Un `<input type="date">` reporta cadena vacía mientras la fecha está
 *    incompleta. Si esa cadena vacía llega a la consulta, el límite
 *    correspondiente simplemente no se aplica — o sea, se pide todo el
 *    historial. Al teclear "01/08/2026" se disparaban consultas gigantes que
 *    nadie pidió, y como contestaban tarde, pisaban al resultado bueno.
 *
 * 2. Sin pausa, cada estado intermedio del input lanzaba su propia consulta.
 *
 * Aquí una fecha incompleta NO se aplica: se conserva el último rango válido.
 * Y "todo el historial" deja de ser "no hay fechas" para volverse un modo
 * explícito, que es lo que siempre significó de verdad.
 */

const PAUSA_MS = 400

/**
 * Fecha local en formato YYYY-MM-DD.
 *
 * No se usa `toISOString()`: devuelve la fecha en UTC y en México, seis horas
 * atrás, a partir de las 18:00 ya entrega el día siguiente. Los rangos de
 * "últimos 30 días" quedaban corridos un día según la hora en que se abriera
 * la pantalla.
 */
export function fechaLocal(d: Date = new Date()): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function haceDias(dias: number): string {
    const d = new Date()
    d.setDate(d.getDate() - dias)
    return fechaLocal(d)
}

export interface RangoAplicado {
    /** `undefined` cuando no hay límite inferior (modo historial). */
    desde?: string
    /** `undefined` cuando no hay límite superior (modo historial). */
    hasta?: string
    /** true solo cuando el usuario pidió explícitamente todo el historial. */
    historial: boolean
}

/** Igual que `haceDias` pero en meses, para los módulos que arrancan en "3 meses". */
export function haceMeses(meses: number): string {
    const d = new Date()
    d.setMonth(d.getMonth() - meses)
    return fechaLocal(d)
}

/**
 * @param diasIniciales   ventana inicial en días
 * @param desdeInicial    fecha de arranque explícita; tiene precedencia sobre
 *                        `diasIniciales` para los módulos cuyo valor por
 *                        defecto no se expresa en días (p. ej. "3 meses")
 */
export function useRangoFechas(diasIniciales = 30, desdeInicial?: string) {
    const arranque = desdeInicial ?? haceDias(diasIniciales)

    const [desdeEditado, setDesdeEditado] = useState(arranque)
    const [hastaEditado, setHastaEditado] = useState(() => fechaLocal())
    const [historial, setHistorial] = useState(false)

    const [aplicado, setAplicado] = useState<RangoAplicado>(() => ({
        desde: arranque,
        hasta: fechaLocal(),
        historial: false,
    }))

    useEffect(() => {
        const t = setTimeout(() => {
            if (historial) {
                // Se devuelve el objeto anterior si no cambió nada: la identidad
                // estable evita que los efectos que dependen del rango vuelvan a
                // consultar sin motivo.
                setAplicado(prev => prev.historial
                    ? prev
                    : { desde: undefined, hasta: undefined, historial: true })
                return
            }

            // Fecha a medio escribir: se ignora y se conserva el rango anterior.
            if (!desdeEditado || !hastaEditado) return

            setAplicado(prev =>
                !prev.historial && prev.desde === desdeEditado && prev.hasta === hastaEditado
                    ? prev
                    : { desde: desdeEditado, hasta: hastaEditado, historial: false })
        }, PAUSA_MS)
        return () => clearTimeout(t)
    }, [desdeEditado, hastaEditado, historial])

    // Escribir una fecha implica salir del modo historial.
    const editarDesde = (v: string) => { setHistorial(false); setDesdeEditado(v) }
    const editarHasta = (v: string) => { setHistorial(false); setHastaEditado(v) }

    const ultimosDias = (dias: number) => {
        setHistorial(false)
        setDesdeEditado(haceDias(dias))
        setHastaEditado(fechaLocal())
    }

    const todoElHistorial = () => {
        setHistorial(true)
        setDesdeEditado("")
        setHastaEditado("")
    }

    const hoy = fechaLocal()
    /** Si el rango escrito corresponde exactamente al atajo de N días. */
    const esUltimosDias = (dias: number) =>
        !historial && desdeEditado === haceDias(dias) && hastaEditado === hoy

    const esUltimos30 = esUltimosDias(30)
    const esUltimos90 = esUltimosDias(90)
    const esPersonalizado = !historial && !esUltimos30 && !esUltimos90

    return {
        /** Valor de los inputs. */
        desdeEditado,
        hastaEditado,
        editarDesde,
        editarHasta,
        /** Rango que debe consultarse. Identidad estable mientras no cambie. */
        aplicado,
        historial,
        ultimosDias,
        todoElHistorial,
        esUltimosDias,
        esUltimos30,
        esUltimos90,
        esPersonalizado,
    }
}
