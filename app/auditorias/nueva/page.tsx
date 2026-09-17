"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/AuthProvider"
import { supabase } from "@/lib/supabase"
import { Loader2, ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Breadcrumbs } from "@/components/Breadcrumbs"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select"
import { SUCURSALES_PRODUCTIVAS } from "@/lib/production-constants"
import { useLotesSucursal, TablaLotes, PASOS } from "../components/selector-lotes"
import { filasDesdeLotes } from "../components/filas-auditoria"

const ROLES_AUDITORES = ['admin', 'gerente_calidad', 'coordinador']

// Fecha local en YYYY-MM-DD. `toISOString()` devuelve UTC y en México (UTC-6)
// a partir de las 18:00 ya reporta el día siguiente.
const todayISO = () => {
    const d = new Date()
    const mes = String(d.getMonth() + 1).padStart(2, '0')
    const dia = String(d.getDate()).padStart(2, '0')
    return `${d.getFullYear()}-${mes}-${dia}`
}

export default function NuevaAuditoriaPage() {
    const { user, profile, loading: authLoading } = useAuth()
    const router = useRouter()

    const [sucursal, setSucursal] = useState("")
    const [fecha, setFecha] = useState(todayISO())
    // Los ids de la bitácora son UUID, no enteros.
    const [seleccion, setSeleccion] = useState<Set<string>>(new Set())
    const [creando, setCreando] = useState(false)

    const role = (profile?.role || '').toLowerCase()
    const { lotes, cargando, limite, setLimite, hayMas, siguientePaso, masAntiguo, reiniciarVentana } =
        useLotesSucursal(sucursal)

    useEffect(() => {
        if (!authLoading && profile) {
            if (!profile.is_admin && !ROLES_AUDITORES.includes(role)) {
                toast.error("Acceso restringido", { description: "Solo Calidad puede crear auditorías." })
                router.push('/')
            }
        }
    }, [profile, authLoading, role, router])

    // Cambiar de sucursal reinicia todo: los lotes marcados eran de la otra.
    const cambiarSucursal = (s: string) => {
        setSucursal(s)
        setSeleccion(new Set())
        reiniciarVentana()
    }

    const toggle = (id: string) => {
        setSeleccion(prev => {
            const next = new Set(prev)
            next.has(id) ? next.delete(id) : next.add(id)
            return next
        })
    }

    const crear = async () => {
        if (!sucursal) { toast.error("Elige una sucursal"); return }
        if (seleccion.size === 0) { toast.error("Selecciona al menos un lote"); return }
        if (!user?.id) { toast.error("Sesión no válida", { description: "Recarga la página." }); return }

        setCreando(true)
        try {
            const { data: auditoria, error: errAud } = await supabase
                .from('auditorias_presenciales')
                .insert({
                    sucursal,
                    fecha_auditoria: fecha,
                    auditor_user_id: user.id,
                    auditor_nombre: profile?.full_name || null,
                    estado: 'EN_PROCESO',
                })
                .select()
                .single()
            if (errAud) throw errAud

            const filas = filasDesdeLotes(
                auditoria.id,
                lotes.filter(l => seleccion.has(l.id))
            )

            const { error: errLotes } = await supabase.from('auditoria_lotes').insert(filas)
            if (errLotes) throw errLotes

            toast.success("Auditoría creada", { description: `${filas.length} lote${filas.length === 1 ? '' : 's'} listo${filas.length === 1 ? '' : 's'} para verificar.` })
            router.push(`/auditorias/${auditoria.id}`)
        } catch (err: any) {
            toast.error("No se pudo crear la auditoría", { description: err.message })
            setCreando(false)
        }
    }

    return (
        <div className="space-y-6 pb-32">
            <Breadcrumbs items={[{ label: "Auditorías Presenciales", href: "/auditorias" }, { label: "Nueva" }]} />

            <div className="flex items-center gap-3 mb-2">
                <ShieldCheck className="h-6 w-6 text-blue-600" />
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Nueva auditoría</h1>
                    <p className="text-sm text-muted-foreground">
                        Elige la sucursal y marca los lotes que vas a volver a medir
                    </p>
                </div>
            </div>

            <Card className="border-none shadow-sm dark:bg-slate-900 rounded-[2rem]">
                <CardContent className="p-6 flex flex-wrap gap-4 items-end">
                    <div className="space-y-1.5 min-w-[14rem]">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Sucursal</label>
                        <Select value={sucursal} onValueChange={cambiarSucursal}>
                            <SelectTrigger className="rounded-full">
                                <SelectValue placeholder="Selecciona sucursal" />
                            </SelectTrigger>
                            <SelectContent>
                                {SUCURSALES_PRODUCTIVAS.map(s => (
                                    <SelectItem key={s} value={s}>{s}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Fecha de la visita</label>
                        <input
                            type="date"
                            value={fecha}
                            onChange={e => setFecha(e.target.value)}
                            className="block text-sm border border-slate-300 dark:border-slate-600 rounded-full px-4 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                        />
                    </div>
                </CardContent>
            </Card>

            {!sucursal ? (
                <Card className="border-none shadow-sm dark:bg-slate-900 rounded-[2rem]">
                    <CardHeader>
                        <CardTitle className="text-lg font-bold">Elige una sucursal</CardTitle>
                        <CardDescription>Se mostrarán sus últimos {PASOS[0]} lotes registrados.</CardDescription>
                    </CardHeader>
                </Card>
            ) : (
                <TablaLotes
                    // Remonta al cambiar de sucursal, para que el filtro de búsqueda
                    // no quede aplicado sobre los lotes de otra.
                    key={sucursal}
                    sucursal={sucursal}
                    lotes={lotes}
                    cargando={cargando}
                    seleccion={seleccion}
                    onToggle={toggle}
                    onReemplazar={ids => setSeleccion(new Set(ids))}
                    hayMas={hayMas}
                    siguientePaso={siguientePaso}
                    masAntiguo={masAntiguo}
                    onAmpliar={() => siguientePaso && setLimite(siguientePaso)}
                    limite={limite}
                />
            )}

            {seleccion.size > 0 && (
                <div className="fixed bottom-0 left-0 right-0 z-30 p-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200 dark:border-slate-700">
                    <div className="max-w-5xl mx-auto flex items-center gap-4">
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                            {seleccion.size} lote{seleccion.size === 1 ? '' : 's'} seleccionado{seleccion.size === 1 ? '' : 's'}
                        </span>
                        <Button variant="ghost" size="sm" className="rounded-full" onClick={() => setSeleccion(new Set())}>
                            Limpiar
                        </Button>
                        <Button className="rounded-full ml-auto gap-2" onClick={crear} disabled={creando}>
                            {creando && <Loader2 className="h-4 w-4 animate-spin" />}
                            Crear auditoría
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
