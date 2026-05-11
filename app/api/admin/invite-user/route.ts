import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { sanitizeText } from '@/lib/sanitize'

const ROLE_LABELS: Record<string, string> = {
    admin: 'Administrador',
    gerente_calidad: 'Gerente de Calidad',
    coordinador: 'Coordinador',
    preparador: 'Preparador',
    gerente_sucursal: 'Gerente de Sucursal',
    gerente: 'Gerente',
    director_operaciones: 'Director de Operaciones',
    director_compras: 'Director de Compras',
    mostrador: 'Mostrador',
    cajera: 'Cajera',
    vendedor: 'Vendedor',
}

function buildInviteEmail(name: string, role: string, sucursal: string, inviteUrl: string): string {
    const roleLabel = ROLE_LABELS[role] || role
    const year = new Date().getFullYear()

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Invitación — Quality Hub GINEZ</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">

  <!-- Wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#0e0c9b;border-radius:16px 16px 0 0;padding:36px 40px;text-align:center;">
              <p style="margin:0 0 4px 0;font-size:28px;font-weight:900;color:#ffffff;letter-spacing:-1px;">
                GI<span style="color:#ef4444;">N</span>EZ
              </p>
              <p style="margin:0;font-size:12px;font-weight:600;color:rgba(255,255,255,0.55);letter-spacing:3px;text-transform:uppercase;">
                Quality Hub
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:40px 40px 32px;">

              <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">
                Hola${name ? ', ' + name.split(' ')[0] : ''}! 👋
              </p>
              <p style="margin:0 0 28px;font-size:15px;color:#475569;line-height:1.6;">
                Has sido invitado a unirte al sistema de gestión de calidad de
                <strong style="color:#0e0c9b;">Operadora GINEZ de México</strong>.
                Tu cuenta ya está lista y configurada con el siguiente perfil:
              </p>

              <!-- Profile card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:28px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:6px 0;border-bottom:1px solid #e2e8f0;">
                          <span style="font-size:12px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Rol asignado</span><br/>
                          <span style="font-size:15px;font-weight:700;color:#0f172a;">${roleLabel}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:12px 0 6px;">
                          <span style="font-size:12px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Sucursal</span><br/>
                          <span style="font-size:15px;font-weight:700;color:#0f172a;">${sucursal}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.6;">
                Haz clic en el botón para crear tu contraseña y activar tu cuenta.
                Este enlace expira en <strong>24 horas</strong>.
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td align="center">
                    <a href="${inviteUrl}"
                       style="display:inline-block;background:#0e0c9b;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:10px;letter-spacing:0.3px;">
                      Activar mi cuenta →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Fallback link -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:8px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 6px;font-size:12px;color:#64748b;">
                      Si el botón no funciona, copia y pega este enlace en tu navegador:
                    </p>
                    <p style="margin:0;font-size:12px;color:#0e0c9b;word-break:break-all;">${inviteUrl}</p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;border-top:1px solid #e2e8f0;border-radius:0 0 16px 16px;padding:24px 40px;text-align:center;">
              <p style="margin:0 0 4px;font-size:12px;color:#94a3b8;">
                Este correo fue enviado automáticamente por el sistema Quality Hub.
              </p>
              <p style="margin:0;font-size:12px;color:#94a3b8;">
                © ${year} Operadora GINEZ de México · Todos los derechos reservados
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`
}

export async function POST(request: NextRequest) {
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )

    try {
        const authHeader = request.headers.get('authorization')
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const token = authHeader.substring(7)
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
        if (authError || !user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { data: callerProfile } = await supabaseAdmin
            .from('profiles')
            .select('is_admin, role')
            .eq('id', user.id)
            .single()

        if (!callerProfile?.is_admin && callerProfile?.role !== 'admin') {
            return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
        }

        const body = await request.json()
        const { email, full_name, role, sucursal } = body

        if (!email || !role || !sucursal) {
            return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 })
        }

        // Generate invite link without sending Supabase's default email
        const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
            type: 'invite',
            email,
            options: {
                redirectTo: 'https://calidadginez.tech/auth/invite/',
                data: { full_name: full_name || '', role, sucursal },
            },
        })

        if (linkError || !linkData) {
            return NextResponse.json({ error: linkError?.message || 'Error generando invitación' }, { status: 400 })
        }

        // Create profile
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .upsert({
                id: linkData.user.id,
                full_name: full_name ? sanitizeText(full_name.trim()) : '',
                role,
                sucursal,
                approved: true,
                updated_at: new Date().toISOString(),
            })

        if (profileError) {
            return NextResponse.json(
                { error: 'Error al crear perfil: ' + profileError.message },
                { status: 500 }
            )
        }

        // Send custom email via Resend
        const resendKey = process.env.RESEND_API_KEY
        if (!resendKey) {
            return NextResponse.json({ error: 'RESEND_API_KEY no configurada' }, { status: 500 })
        }

        const resend = new Resend(resendKey)
        const inviteUrl = linkData.properties.action_link

        const { error: emailError } = await resend.emails.send({
            from: 'Quality Hub GINEZ <noreply@calidadginez.tech>',
            to: email,
            subject: 'Bienvenido a Quality Hub — Activa tu cuenta',
            html: buildInviteEmail(full_name || '', role, sucursal, inviteUrl),
        })

        if (emailError) {
            return NextResponse.json({ error: 'Cuenta creada pero error al enviar email: ' + emailError.message }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 })
    }
}
