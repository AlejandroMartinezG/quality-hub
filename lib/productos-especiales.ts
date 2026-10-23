"use client"

import { supabase } from "@/lib/supabase"

/**
 * Productos terminados especiales: fabricaciones fuera de línea con código
 * asignado por Calidad.
 *
 * Se distinguen del resto por su `familia_producto`, que es lo que la Bitácora
 * guarda en cada lote. Ese valor es el que permite a los reportes reconocerlos
 * sin necesidad de consultar el catálogo.
 */
export const CATEGORIA_ESPECIAL = 'Producto especial'

export type ProductoEspecial = {
    codigo: string
    nombre: string
    mide_ph: boolean
    mide_solidos: boolean
    mide_apariencia: boolean
    notas: string | null
    activo: boolean
}

/** ¿Este lote es un producto especial? Sirve igual en la app y en los reportes. */
export function esEspecial(registro: { familia_producto?: string | null }): boolean {
    return registro.familia_producto === CATEGORIA_ESPECIAL
}

/**
 * Busca un producto especial por su código.
 *
 * Devuelve `null` si no está dado de alta: la Bitácora usa eso para avisarle al
 * operador que el código no existe todavía, en vez de dejarlo capturar un lote
 * que después nadie sabría interpretar.
 */
export async function buscarEspecial(codigo: string): Promise<ProductoEspecial | null> {
    const limpio = codigo.trim().toUpperCase()
    if (!limpio) return null

    const { data, error } = await supabase
        .from('productos_especiales')
        .select('codigo, nombre, mide_ph, mide_solidos, mide_apariencia, notas, activo')
        .eq('codigo', limpio)
        .maybeSingle()

    if (error) {
        console.error("No se pudo consultar el producto especial:", error.message)
        return null
    }
    return data as ProductoEspecial | null
}

/** Todos los dados de alta, para la pantalla de administración. */
export async function listarEspeciales(): Promise<ProductoEspecial[]> {
    const { data, error } = await supabase
        .from('productos_especiales')
        .select('codigo, nombre, mide_ph, mide_solidos, mide_apariencia, notas, activo')
        .order('activo', { ascending: false })
        .order('codigo')

    if (error) {
        console.error("No se pudieron listar los productos especiales:", error.message)
        return []
    }
    return (data || []) as ProductoEspecial[]
}
