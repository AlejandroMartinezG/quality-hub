import { supabaseAdmin } from '@/lib/supabase-admin'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
    const { ids } = await req.json()
    if (!Array.isArray(ids) || ids.length === 0) return NextResponse.json([])

    const { data } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', ids)

    return NextResponse.json(data || [])
}
