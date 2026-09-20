"use client"

/**
 * Procesado de imágenes en el navegador, sin dependencias.
 *
 * Una foto de celular pesa 3–6 MB. Subirla tal cual desde una sucursal por datos
 * móviles tarda, y al generar el PDF `html2canvas` tiene que rasterizarla, lo que
 * hace el reporte lento y pesado. Redimensionar antes de subir resuelve las dos
 * cosas y de paso reduce el disco que consume el VPS.
 */

export const ANCHO_COMPLETA = 1600
export const ANCHO_MINIATURA = 400
export const CALIDAD_COMPLETA = 0.8
export const CALIDAD_MINIATURA = 0.7

/** Tamaño máximo del archivo original que aceptamos procesar. */
export const MAX_BYTES_ORIGEN = 15 * 1024 * 1024

function cargarImagen(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file)
        const img = new Image()
        img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen')) }
        img.src = url
    })
}

/**
 * Redimensiona manteniendo proporción y devuelve un JPEG.
 * Si la imagen ya es más chica que `anchoMax`, no la agranda.
 */
async function redimensionar(img: HTMLImageElement, anchoMax: number, calidad: number): Promise<Blob> {
    const escala = Math.min(1, anchoMax / img.naturalWidth)
    const ancho = Math.round(img.naturalWidth * escala)
    const alto = Math.round(img.naturalHeight * escala)

    const canvas = document.createElement('canvas')
    canvas.width = ancho
    canvas.height = alto

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('El navegador no permitió procesar la imagen')

    // Fondo blanco: un PNG con transparencia quedaría negro al pasar a JPEG.
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, ancho, alto)
    ctx.drawImage(img, 0, 0, ancho, alto)

    return new Promise((resolve, reject) => {
        canvas.toBlob(
            b => b ? resolve(b) : reject(new Error('No se pudo comprimir la imagen')),
            'image/jpeg',
            calidad
        )
    })
}

export type ImagenProcesada = {
    completa: Blob
    miniatura: Blob
}

/** Genera las dos versiones que se guardan de cada foto. */
export async function procesarFoto(file: File): Promise<ImagenProcesada> {
    if (!file.type.startsWith('image/')) {
        throw new Error('El archivo no es una imagen')
    }
    if (file.size > MAX_BYTES_ORIGEN) {
        throw new Error(`La imagen supera los ${Math.round(MAX_BYTES_ORIGEN / 1024 / 1024)} MB`)
    }

    const img = await cargarImagen(file)
    const [completa, miniatura] = await Promise.all([
        redimensionar(img, ANCHO_COMPLETA, CALIDAD_COMPLETA),
        redimensionar(img, ANCHO_MINIATURA, CALIDAD_MINIATURA),
    ])
    return { completa, miniatura }
}

/**
 * Descarga una URL y la convierte a `data:` URI.
 *
 * Es lo que permite meter fotos al PDF: `html2canvas` no rasteriza de forma
 * confiable imágenes remotas —aunque `useCORS` esté activo, las URL firmadas
 * suelen terminar en recuadros blancos—, así que se embeben antes de abrir la
 * vista de impresión y nunca hace una petición de red.
 */
export async function urlADataUri(url: string): Promise<string | null> {
    try {
        const resp = await fetch(url)
        if (!resp.ok) return null
        const blob = await resp.blob()
        return await new Promise<string | null>(resolve => {
            const lector = new FileReader()
            lector.onloadend = () => resolve(typeof lector.result === 'string' ? lector.result : null)
            lector.onerror = () => resolve(null)
            lector.readAsDataURL(blob)
        })
    } catch {
        return null
    }
}

/** Texto legible de un tamaño en bytes. */
export function pesoLegible(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
