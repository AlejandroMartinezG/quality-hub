/**
 * Utilidades compartidas para los correos que envía la plataforma vía Resend.
 */

export const EMAIL_FROM = 'PCC-Ginez <noreply@calidadginez.tech>'
export const APP_URL = 'https://calidadginez.tech'

/** Content-ID del logo incrustado. Se referencia como `cid:logo@ginez` en el HTML. */
export const LOGO_CID = 'logo@ginez'

/**
 * Obtiene el logo para adjuntarlo al correo, incrustado en vez de enlazado
 * porque los clientes de correo bloquean imágenes remotas por defecto.
 *
 * Se lee del disco: el contenedor tiene `public/` dentro, y pedirlo por HTTP
 * a su propio dominio implica salir y volver por el proxy, que puede fallar.
 * El fetch queda solo como respaldo.
 */
export async function fetchLogoAttachment(): Promise<{ content: string; contentType: string } | null> {
    try {
        const fs = await import('fs/promises')
        const path = await import('path')
        const buffer = await fs.readFile(path.join(process.cwd(), 'public', 'logo.png'))
        return { content: buffer.toString('base64'), contentType: 'image/png' }
    } catch {
        // Respaldo por red, por si la ruta del disco cambia
        try {
            const res = await fetch(`${APP_URL}/logo.png`, { cache: 'no-store' })
            if (!res.ok) return null
            const buffer = await res.arrayBuffer()
            return {
                content: Buffer.from(buffer).toString('base64'),
                contentType: res.headers.get('content-type') || 'image/png',
            }
        } catch {
            return null
        }
    }
}

/** Adjunto listo para Resend, o arreglo vacío si el logo no se pudo obtener. */
export function logoAttachments(logo: { content: string } | null) {
    return logo ? [{ content: logo.content, filename: 'logo.png', contentId: LOGO_CID }] : []
}

/** Origen de la imagen: incrustada si hay adjunto, remota si no. */
export function logoSrc(logo: unknown | null) {
    return logo ? `cid:${LOGO_CID}` : `${APP_URL}/logo.png`
}
