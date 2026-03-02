import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
    const { data: dispo, error } = await supabase.from('quality_disposition').select('*');
    const { data: ncr, error: ncrError } = await supabase.from('quality_ncr').select('*, quality_disposition(*)');

    return NextResponse.json({ dispo, ncr, error, ncrError });
}
