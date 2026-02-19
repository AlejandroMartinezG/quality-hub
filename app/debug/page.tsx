'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function DebugPage() {
    const [config, setConfig] = useState<any>(null)
    const [authStatus, setAuthStatus] = useState<any>(null)
    const [tableStatus, setTableStatus] = useState<any>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        checkConnection()
    }, [])

    async function checkConnection() {
        // 1. Check Config
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        setConfig({
            url: url || 'MISSING',
            keyPresent: !!key,
            keyPrefix: key ? key.substring(0, 10) + '...' : 'N/A'
        })

        // 2. Check Auth Session
        try {
            const { data: { session }, error: authError } = await supabase.auth.getSession()
            if (authError) {
                setAuthStatus({ error: authError.message })
            } else {
                setAuthStatus({
                    session: session ? 'Active' : 'No Session',
                    email: session?.user?.email
                })
            }
        } catch (e: any) {
            setAuthStatus({ error: e.message })
        }

        // 3. Check Database Read (Public access check)
        try {
            // Try reading a table that should exist, e.g. quality_ncr even if empty
            const { count, error: dbError } = await supabase
                .from('quality_ncr')
                .select('*', { count: 'exact', head: true })

            if (dbError) {
                setTableStatus({ error: dbError.message, details: dbError })
            } else {
                setTableStatus({ success: true, rowCount: count })
            }
        } catch (e: any) {
            setTableStatus({ error: e.message })
        }
    }

    return (
        <div className="p-8 max-w-2xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold">Diagnóstico de Conexión Supabase</h1>

            <div className="space-y-4">
                <section className="p-4 border rounded bg-slate-50">
                    <h2 className="font-semibold mb-2">1. Configuración del Cliente</h2>
                    <pre className="text-sm overflow-x-auto bg-white p-2 rounded border">
                        {JSON.stringify(config, null, 2)}
                    </pre>
                    {config?.url === 'MISSING' && (
                        <p className="text-red-500 font-bold mt-2">ERROR: Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL</p>
                    )}
                </section>

                <section className="p-4 border rounded bg-slate-50">
                    <h2 className="font-semibold mb-2">2. Estado de Sesión</h2>
                    <pre className="text-sm overflow-x-auto bg-white p-2 rounded border">
                        {JSON.stringify(authStatus, null, 2)}
                    </pre>
                </section>

                <section className="p-4 border rounded bg-slate-50">
                    <h2 className="font-semibold mb-2">3. Acceso a Base de Datos (quality_ncr)</h2>
                    <pre className="text-sm overflow-x-auto bg-white p-2 rounded border">
                        {JSON.stringify(tableStatus, null, 2)}
                    </pre>
                </section>
            </div>

            <div className="mt-8">
                <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                    Recargar Página
                </button>
            </div>
        </div>
    )
}
