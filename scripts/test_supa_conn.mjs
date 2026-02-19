
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// Read .env.local manually
const envPath = path.resolve(process.cwd(), '.env.local')
const envContent = fs.readFileSync(envPath, 'utf-8')

const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL="([^"]+)"/)
const keyMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY="([^"]+)"/)

if (!urlMatch || !keyMatch) {
    console.error("Could not parse .env.local")
    process.exit(1)
}

const url = urlMatch[1]
const key = keyMatch[1]

console.log(`URL: ${url}`)
console.log(`Key Found: ${!!key}`)

const supabase = createClient(url, key)

async function testConnection() {
    console.log("Testing connection...")
    // Try to fetch bitacora since it's used in the report
    // Even if RLS denies, we should get error or success, not hang.
    const { data, error } = await supabase.from('bitacora_produccion_calidad').select('*').limit(1)

    if (error) {
        console.error("Connection Failed:", error)
    } else {
        console.log("Connection Success!")
        console.log("Data length:", data?.length)
        if (data?.length > 0) console.log("Sample ID:", data[0].id)
    }

    // Try Auth Sign In (with dummy credentials that should fail specifically with invalid login, not network error)
    console.log("Testing Auth endpoint...")
    const { error: authError } = await supabase.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'wrongpassword'
    })

    if (authError) {
        console.log("Auth Response:", authError.message) // Should be "Invalid login credentials"
    }
}

testConnection()
