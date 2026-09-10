/**
 * Utilidades compartidas para los correos que envía la plataforma vía Resend.
 */

export const EMAIL_FROM = 'PCC-Ginez <noreply@calidadginez.tech>'
export const APP_URL = 'https://calidadginez.tech'

/** Content-ID del logo incrustado. Se referencia como `cid:logo@ginez` en el HTML. */
export const LOGO_CID = 'logo@ginez'

/**
 * Descarga el logo para adjuntarlo al correo. Se incrusta en vez de enlazarlo
 * porque muchos clientes bloquean imágenes remotas por defecto.
 * Devuelve null si falla: el correo debe enviarse igual, con el logo enlazado.
 */
export async function fetchLogoAttachment(): Promise<{ content: string; contentType: string } | null> {
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

/** Adjunto listo para Resend, o arreglo vacío si el logo no se pudo obtener. */
export function logoAttachments(logo: { content: string } | null) {
    return logo ? [{ content: logo.content, filename: 'logo.png', contentId: LOGO_CID }] : []
}

/** Origen de la imagen: incrustada si hay adjunto, remota si no. */
export function logoSrc(logo: unknown | null) {
    return logo ? `cid:${LOGO_CID}` : `${APP_URL}/logo.png`
}
