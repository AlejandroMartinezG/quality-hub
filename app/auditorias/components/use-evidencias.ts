"use client"

import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { BUCKET, type Evidencia } from "./GaleriaEvidencia"

/** Una hora: alcanza de sobra para llenar una hoja de auditoría. */
const VIGENCIA_URL = 3600

/**
 * Carga las evidencias de una auditoría, firma sus URLs y les asigna el número
 * corrido con el que aparecen en el anexo del reporte.
 *
 * La numeración sigue el orden en que se ven los lotes en la hoja y, dentro de
 * cada lote, el orden de subida. Las fotos generales de la visita van al final.
 * Se calcula aquí y no en la base para que pantalla y PDF siempre coincidan.
 */
export function useEvidencias(auditoriaId: string, ordenLotes: string[]) {
    const [evidencias, setEvidencias] = useState<Evidencia[]>([])
    const [cargando, setCargando] = useState(true)

    const cargar = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('auditoria_evidencias')
                .select('*')
                .eq('auditoria_id', auditoriaId)
                .order('created_at', { ascending: true })
            if (error) throw error

            const filas = (data || []) as Evidencia[]
            if (filas.length === 0) { setEvidencias([]); return }

            // Una sola llamada para todas las rutas en vez de una por foto.
            const rutas = filas.flatMap(f => [f.ruta, f.ruta_miniatura])
            const { data: firmadas } = await supabase.storage
                .from(BUCKET)
                .createSignedUrls(rutas, VIGENCIA_URL)

            const porRuta = new Map<string, string>()
            for (const f of firmadas || []) {
                if (f.path && f.signedUrl) porRuta.set(f.path, f.signedUrl)
            }

            setEvidencias(filas.map(f => ({
                ...f,
                urlCompleta: porRuta.get(f.ruta),
                urlMiniatura: porRuta.get(f.ruta_miniatura),
            })))
        } catch (err: any) {
            toast.error("No se pudieron cargar las fotos", { description: err.message })
        } finally {
            setCargando(false)
        }
    }, [auditoriaId])

    useEffect(() => { cargar() }, [cargar])

    /** Evidencias con su número asignado, agrupadas por lote. */
    const { porLote, generales, numeradas } = useMemo(() => {
        const crudasPorLote = new Map<string, Evidencia[]>()
        const crudasGenerales: Evidencia[] = []

        for (const ev of evidencias) {
            if (ev.lote_id) {
                if (!crudasPorLote.has(ev.lote_id)) crudasPorLote.set(ev.lote_id, [])
                crudasPorLote.get(ev.lote_id)!.push(ev)
            } else {
                crudasGenerales.push(ev)
            }
        }

        // La numeración se reparte recorriendo los lotes en el orden en que se
        // muestran; así el "📷 3–4" de la cabecera cuadra con el anexo.
        //
        // Se crean objetos nuevos en vez de asignarle `numero` a los de estado:
        // mutar durante el render rompe con StrictMode y deja números duplicados.
        let n = 0
        const porLote = new Map<string, Evidencia[]>()
        const numeradas: Evidencia[] = []

        for (const loteId of ordenLotes) {
            const grupo = (crudasPorLote.get(loteId) || []).map(ev => ({ ...ev, numero: ++n }))
            if (grupo.length > 0) {
                porLote.set(loteId, grupo)
                numeradas.push(...grupo)
            }
        }

        const generales = crudasGenerales.map(ev => ({ ...ev, numero: ++n }))
        numeradas.push(...generales)

        return { porLote, generales, numeradas }
    }, [evidencias, ordenLotes])

    return { evidencias, porLote, generales, numeradas, cargando, recargar: cargar }
}

/** Rango legible de los números de un grupo: "3" o "3–5". */
export function rangoFotos(evs: Evidencia[]): string | null {
    const nums = evs.map(e => e.numero).filter((n): n is number => n !== undefined)
    if (nums.length === 0) return null
    const min = Math.min(...nums)
    const max = Math.max(...nums)
    return min === max ? `${min}` : `${min}–${max}`
}
