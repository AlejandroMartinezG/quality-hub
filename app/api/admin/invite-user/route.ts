import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sanitizeText } from '@/lib/sanitize'

export async function POST(request: NextRequest) {
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

        if (!email || !full_name || !role || !sucursal) {
            return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 })
        }

        const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
            email,
            {
                redirectTo: 'https://calidadginez.tech/auth/invite/',
                data: { full_name, role, sucursal },
            }
        )

        if (inviteError) {
            return NextResponse.json({ error: inviteError.message }, { status: 400 })
        }

        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .upsert({
                id: inviteData.user.id,
                full_name: sanitizeText(full_name.trim()),
                role,
                sucursal,
                approved: true,
                updated_at: new Date().toISOString(),
            })

        if (profileError) {
            return NextResponse.json(
                { error: 'Invitación enviada pero error al crear perfil: ' + profileError.message },
                { status: 500 }
            )
        }

        return NextResponse.json({ success: true })
    } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 })
    }
}
