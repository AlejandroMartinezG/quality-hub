import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

        const { userId, role, sucursal, approved, full_name, area, position, is_admin } = await request.json()

        if (!userId) {
            return NextResponse.json({ error: 'userId requerido' }, { status: 400 })
        }

        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
        if (role !== undefined) updates.role = role
        if (sucursal !== undefined) updates.sucursal = sucursal
        if (approved !== undefined) updates.approved = approved
        if (full_name !== undefined) updates.full_name = full_name
        if (area !== undefined) updates.area = area
        if (position !== undefined) updates.position = position
        if (is_admin !== undefined) updates.is_admin = is_admin

        const { error } = await supabaseAdmin
            .from('profiles')
            .update(updates)
            .eq('id', userId)

        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 })
    }
}
