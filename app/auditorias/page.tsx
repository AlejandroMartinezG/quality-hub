"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/AuthProvider"
import { supabase } from "@/lib/supabase"
import { Loader2, ShieldCheck, Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Breadcrumbs } from "@/components/Breadcrumbs"

const AuditoriasPanel = dynamic(() => import("./components/AuditoriasPanel"), {
    ssr: false,
    loading: () => (
        <div className="h-64 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
    ),
})

// Verificación de la confiabilidad del operador: no se expone a preparadores.
const ALLOWED_ROLES = [
    'admin', 'gerente_calidad', 'coordinador',
    'director_operaciones', 'director_compras',
    'gerente_sucursal', 'gerente',
]

// Solo estos capturan. Los directores y gerentes leen.
// (No se exporta: una página del App Router solo admite sus exports reservados.)
const ROLES_AUDITORES = ['admin', 'gerente_calidad', 'coordinador']

export default function AuditoriasPage() {
    const { user, profile, loading: authLoading } = useAuth()
    const router = useRouter()
    const [auditorias, setAuditorias] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    const role = (profile?.role || '').toLowerCase()
    const isGerente = role === 'gerente_sucursal' || role === 'gerente'
    const puedeAuditar = profile?.is_admin || ROLES_AUDITORES.includes(role)

    useEffect(() => {
        if (!authLoading && profile) {
            if (!profile.is_admin && !ALLOWED_ROLES.includes(role)) {
                toast.error("Acceso restringido")
                router.push('/')
            }
        }
    }, [profile, authLoading, role, router])

    const fetchData = async () => {
        setLoading(true)
        try {
            // Los lotes vienen anidados: se necesita su resultado y su preparador
            // para los conteos y el bloque de confiabilidad, nada más.
            let query = supabase
                .from('auditorias_presenciales')
                .select('id, sucursal, fecha_auditoria, auditor_nombre, estado, created_at, cerrada_at, auditoria_lotes(id, resultado, nombre_preparador, origen)')
            if (isGerente && profile?.sucursal) query = query.eq('sucursal', profile.sucursal)
            const { data, error } = await query.order('fecha_auditoria', { ascending: false })
            if (error) throw error
            setAuditorias(data || [])
        } catch (err: any) {
            toast.error("Error al cargar auditorías", { description: err.message })
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (user && profile) fetchData()
        else if (!authLoading) setLoading(false)
    }, [user?.id, profile?.role, authLoading])

    return (
        <div className="space-y-6 pb-12">
            <Breadcrumbs items={[{ label: "Auditorías Presenciales" }]} />

            <div className="flex flex-wrap items-center gap-3 mb-2">
                <ShieldCheck className="h-6 w-6 text-blue-600" />
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Auditorías Presenciales</h1>
                    <p className="text-sm text-muted-foreground">
                        Verificación en sitio de las mediciones capturadas por el operador
                    </p>
                </div>
                {puedeAuditar && (
                    <Link href="/auditorias/nueva" className="ml-auto">
                        <Button className="rounded-full gap-2">
                            <Plus className="h-4 w-4" /> Nueva auditoría
                        </Button>
                    </Link>
                )}
            </div>

            {loading ? (
                <div className="h-64 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
            ) : (
                <AuditoriasPanel auditorias={auditorias} />
            )}
        </div>
    )
}
