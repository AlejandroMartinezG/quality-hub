import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: NextRequest) {
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

    if (!token) return NextResponse.json([], { status: 401 })

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) return NextResponse.json([], { status: 401 })

    const { ids } = await req.json()
    if (!Array.isArray(ids) || ids.length === 0) return NextResponse.json([])
    if (ids.length > 50) return NextResponse.json([], { status: 400 })

    const { data } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', ids)

    return NextResponse.json(data || [])
}
