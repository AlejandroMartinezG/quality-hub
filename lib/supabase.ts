import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// DEBUG: Log Env vars (safe partial key) to verify browser sees them
if (typeof window !== 'undefined') {
    console.log('--- SUPABASE CLIENT CONFIG ---')
    console.log('URL:', supabaseUrl)
    console.log('KEY:', supabaseAnonKey ? `${supabaseAnonKey.substring(0, 10)}...` : 'MISSING')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // PKCE flow provides CSRF protection by default —
        // the auth code is bound to a code_verifier that only
        // the original client knows, preventing interception attacks.
        flowType: 'pkce',
        // Storage defaults to localStorage which is fine for a static SPA.
        // Supabase JS v2+ handles secure token storage internally.
    },
})

