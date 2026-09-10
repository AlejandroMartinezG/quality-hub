import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { SUCURSALES_PRODUCTIVAS } from '@/lib/production-constants'
import { EMAIL_FROM, APP_URL, fetchLogoAttachment, logoAttachments, logoSrc } from '@/lib/email'

// Días sin subir registros a partir de los cuales se envía el recordatorio
const VENTANA_DIAS = 7
// No repetir el aviso a la misma persona dentro de esta ventana
const ANTIRREPETICION_DIAS = 5

const ROLES_DESTINO = ['preparador', 'gerente_sucursal', 'gerente']

function buildEmail(nombre: string, sucursal: string, dias: number | null, src: string): string {
    const primerNombre = nombre ? nombre.split(' ')[0] : ''
    const cuando = dias === null
        ? 'No tenemos registros previos de esta sucursal.'
        : `El último registro se subió hace <strong>${dias} días</strong>.`

    return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f3f9;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f3f9;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(16,20,60,.08);">

        <tr><td style="background:linear-gradient(135deg,#0b109f,#1622a8);padding:28px 32px;">
          <img src="${src}" alt="GINEZ" height="34" style="display:block;border:0;">
        </td></tr>

        <tr><td style="padding:32px;">
          <p style="margin:0 0 6px;font-size:12px;font-weight:bold;letter-spacing:.1em;text-transform:uppercase;color:#0b109f;">Recordatorio de captura</p>
          <h1 style="margin:0 0 18px;font-size:22px;line-height:1.25;color:#121420;">
            ${primerNombre ? primerNombre + ', f' : 'F'}altan registros de ${sucursal}
          </h1>

          <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#3d4358;">
            En la Bitácora de Producción no aparecen registros de <strong>${sucursal}</strong> en los últimos ${VENTANA_DIAS} días. ${cuando}
          </p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#3d4358;">
            Si ya fabricaste lotes en este período, captúralos para mantener el control de calidad al día. Registrar pronto permite detectar desviaciones a tiempo.
          </p>

          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="border-radius:10px;background:#0b109f;">
              <a href="${APP_URL}/bitacora" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;">
                Registrar producción
              </a>
            </td>
          </tr></table>

          <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#767c92;">
            Si la sucursal no produjo en este período, puedes ignorar este mensaje.
          </p>
        </td></tr>

        <tr><td style="padding:18px 32px;background:#f7f8fc;border-top:1px solid #e6e9f4;">
          <p style="margin:0;font-size:12px;color:#767c92;">
            PCC-GINEZ® · Plataforma de Control de Calidad · Mensaje automático, no responder.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export async function POST(req: NextRequest) {
    // Autenticación por secreto compartido: lo llama un cron, no un usuario
    const secret = process.env.CRON_SECRET
    if (!secret) {
        return NextResponse.json({ error: 'CRON_SECRET no configurada' }, { status: 500 })
    }
    if (req.headers.get('authorization') !== `Bearer ${secret}`) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // `simular=1` calcula y devuelve el resumen sin enviar nada
    const simular = req.nextUrl.searchParams.get('simular') === '1'
    // `prueba=correo@dominio` manda UN correo de muestra a esa dirección
    // y no toca sucursales, destinatarios reales ni notificaciones.
    const correoPrueba = req.nextUrl.searchParams.get('prueba')

    try {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { autoRefreshToken: false, persistSession: false } }
        )

        const desde = new Date(Date.now() - VENTANA_DIAS * 86_400_000).toISOString()

        // 1. Sucursales que SÍ subieron algo en la ventana.
        //    Se usa created_at (cuándo se subió), no fecha_fabricacion: quien está
        //    capturando rezago sí está reportando y no debe recibir recordatorio.
        const { data: activas, error: errActivas } = await supabase
            .from('bitacora_produccion_calidad')
            .select('sucursal')
            .gte('created_at', desde)
        if (errActivas) throw errActivas

        const conActividad = new Set((activas || []).map(r => r.sucursal))
        const pendientes = SUCURSALES_PRODUCTIVAS.filter(s => !conActividad.has(s))

        // Modo prueba: un correo de muestra y nada más.
        // Usa una sucursal pendiente real para que el contenido se vea como el definitivo.
        if (correoPrueba) {
            const logoP = await fetchLogoAttachment()
            const sucursalMuestra = pendientes[0] || 'PUEBLA 2'
            const { error: errPrueba } = await new Resend(process.env.RESEND_API_KEY || '').emails.send({
                from: EMAIL_FROM,
                to: correoPrueba,
                subject: `[PRUEBA] Faltan registros de producción — ${sucursalMuestra}`,
                html: buildEmail('Alejandro Martínez', sucursalMuestra, 12, logoSrc(logoP)),
                attachments: logoAttachments(logoP),
            })
            if (errPrueba) {
                return NextResponse.json({ error: 'Error al enviar la prueba: ' + errPrueba.message }, { status: 500 })
            }
            return NextResponse.json({
                ok: true,
                modo: 'prueba',
                enviado_a: correoPrueba,
                sucursal_de_muestra: sucursalMuestra,
                nota: 'Correo de muestra. No se creó ninguna notificación ni se avisó a ninguna sucursal.',
            })
        }

        if (pendientes.length === 0) {
            return NextResponse.json({ ok: true, mensaje: 'Todas las sucursales subieron registros', pendientes: [] })
        }

        // 2. Último registro de cada sucursal pendiente, para decir cuántos días lleva
        const { data: ultimos } = await supabase
            .from('bitacora_produccion_calidad')
            .select('sucursal, created_at')
            .in('sucursal', pendientes)
            .order('created_at', { ascending: false })

        const ultimoPorSucursal = new Map<string, string>()
        for (const r of ultimos || []) {
            if (!ultimoPorSucursal.has(r.sucursal)) ultimoPorSucursal.set(r.sucursal, r.created_at)
        }
        const diasSinRegistro = (suc: string): number | null => {
            const u = ultimoPorSucursal.get(suc)
            if (!u) return null
            return Math.floor((Date.now() - new Date(u).getTime()) / 86_400_000)
        }

        // 3. Perfiles destinatarios de esas sucursales
        const { data: perfiles, error: errPerfiles } = await supabase
            .from('profiles')
            .select('id, full_name, sucursal, role')
            .in('sucursal', pendientes)
            .in('role', ROLES_DESTINO)
        if (errPerfiles) throw errPerfiles

        // 4. Correos desde auth.users: profiles.email puede venir vacío
        const { data: authUsers } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
        const correoPorId = new Map<string, string>()
        for (const u of authUsers?.users || []) {
            if (u.email) correoPorId.set(u.id, u.email)
        }

        // 5. Quién ya recibió un recordatorio hace poco, para no repetir
        const desdeAviso = new Date(Date.now() - ANTIRREPETICION_DIAS * 86_400_000).toISOString()
        const { data: avisosRecientes } = await supabase
            .from('notifications')
            .select('user_id')
            .eq('type', 'recordatorio_captura')
            .gte('created_at', desdeAviso)
        const yaAvisados = new Set((avisosRecientes || []).map(n => n.user_id))

        const resend = new Resend(process.env.RESEND_API_KEY || '')
        const logo = await fetchLogoAttachment()
        const src = logoSrc(logo)

        const enviados: any[] = []
        const omitidos: any[] = []
        const errores: any[] = []
        const notificaciones: any[] = []

        for (const p of perfiles || []) {
            const dias = diasSinRegistro(p.sucursal)

            if (yaAvisados.has(p.id)) {
                omitidos.push({ sucursal: p.sucursal, nombre: p.full_name, motivo: 'avisado recientemente' })
                continue
            }

            const correo = correoPorId.get(p.id)
            const detalle = { sucursal: p.sucursal, nombre: p.full_name, rol: p.role, correo: correo || null, dias }

            notificaciones.push({
                user_id: p.id,
                type: 'recordatorio_captura',
                title: '📋 Faltan registros de producción',
                message: dias === null
                    ? `No hay registros de ${p.sucursal}. Captura tu producción en la Bitácora.`
                    : `${p.sucursal} lleva ${dias} días sin registros. Captura tu producción en la Bitácora.`,
                link: '/bitacora',
                metadata: { sucursal: p.sucursal, dias_sin_registro: dias },
            })

            if (!correo) {
                omitidos.push({ ...detalle, motivo: 'sin correo registrado' })
                continue
            }

            if (simular) { enviados.push(detalle); continue }

            const { error: errMail } = await resend.emails.send({
                from: EMAIL_FROM,
                to: correo,
                subject: `Faltan registros de producción — ${p.sucursal}`,
                html: buildEmail(p.full_name || '', p.sucursal, dias, src),
                attachments: logoAttachments(logo),
            })
            if (errMail) errores.push({ ...detalle, error: errMail.message })
            else enviados.push(detalle)
        }

        // 6. Insertar las notificaciones en app
        if (notificaciones.length > 0 && !simular) {
            const { error: errNotif } = await supabase.from('notifications').insert(notificaciones)
            if (errNotif) errores.push({ paso: 'notificaciones', error: errNotif.message })
        }

        // Sucursales pendientes sin ningún perfil asignado: no hay a quién avisar.
        // Se reporta porque es un problema de configuración que conviene ver.
        const conDestinatario = new Set((perfiles || []).map(p => p.sucursal))
        const sinDestinatario = pendientes.filter(s => !conDestinatario.has(s))

        return NextResponse.json({
            ok: true,
            simulacion: simular,
            resumen: {
                sucursales_pendientes: pendientes.length,
                correos_enviados: enviados.length,
                notificaciones_creadas: simular ? 0 : notificaciones.length,
                omitidos: omitidos.length,
                errores: errores.length,
                sucursales_sin_destinatario: sinDestinatario.length,
            },
            pendientes,
            sin_destinatario: sinDestinatario,
            enviados,
            omitidos,
            errores,
        })
    } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 })
    }
}
