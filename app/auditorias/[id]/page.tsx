"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/AuthProvider"
import { supabase } from "@/lib/supabase"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Breadcrumbs } from "@/components/Breadcrumbs"

const HojaAuditoria = dynamic(() => import("../components/HojaAuditoria"), {
    ssr: false,
    loading: () => (
        <div className="h-64 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
    ),
})

const ALLOWED_ROLES = [
    'admin', 'gerente_calidad', 'coordinador',
    'director_operaciones', 'director_compras',
    'gerente_sucursal', 'gerente',
]
const ROLES_AUDITORES = ['admin', 'gerente_calidad', 'coordinador']

export default function AuditoriaDetallePage({ params }: { params: { id: string } }) {
    const { user, profile, loading: authLoading } = useAuth()
    const router = useRouter()
    const [auditoria, setAuditoria] = useState<any>(null)
    const [lotes, setLotes] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    const role = (profile?.role || '').toLowerCase()
    const puedeEditar = Boolean(profile?.is_admin) || ROLES_AUDITORES.includes(role)

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
            const { data: aud, error: errAud } = await supabase
                .from('auditorias_presenciales')
                .select('*')
                .eq('id', params.id)
                .single()
            if (errAud) throw errAud

            const { data: lts, error: errLotes } = await supabase
                .from('auditoria_lotes')
                .select('*')
                .eq('auditoria_id', params.id)
                .order('fecha_fabricacion', { ascending: false })
            if (errLotes) throw errLotes

            setAuditoria(aud)
            setLotes(lts || [])
        } catch (err: any) {
            toast.error("No se pudo cargar la auditoría", { description: err.message })
            router.push('/auditorias')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (user && profile) fetchData()
        else if (!authLoading) setLoading(false)
    }, [user?.id, profile?.role, authLoading, params.id])

    if (loading || !auditoria) {
        return (
            <div className="h-96 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        )
    }

    return (
        <div className="space-y-6 pb-32">
            <Breadcrumbs items={[
                { label: "Auditorías Presenciales", href: "/auditorias" },
                { label: `${auditoria.sucursal}` },
            ]} />
            <HojaAuditoria
                auditoria={auditoria}
                lotesIniciales={lotes}
                puedeEditar={puedeEditar}
                nombreUsuario={profile?.full_name || undefined}
                onRecargar={fetchData}
            />
        </div>
    )
}
