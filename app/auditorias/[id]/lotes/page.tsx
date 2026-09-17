"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/AuthProvider"
import { supabase } from "@/lib/supabase"
import { Loader2, ShieldCheck, Save } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Breadcrumbs } from "@/components/Breadcrumbs"
import { formatFecha } from "@/lib/utils"
import { useLotesSucursal, TablaLotes } from "../../components/selector-lotes"
import { filasDesdeLotes, tieneMediciones } from "../../components/filas-auditoria"

const ROLES_AUDITORES = ['admin', 'gerente_calidad', 'coordinador']

export default function AjustarLotesPage({ params }: { params: { id: string } }) {
    const { user, profile, loading: authLoading } = useAuth()
    const router = useRouter()

    const [auditoria, setAuditoria] = useState<any>(null)
    const [filasActuales, setFilasActuales] = useState<any[]>([])
    const [seleccion, setSeleccion] = useState<Set<string>>(new Set())
    const [cargandoAud, setCargandoAud] = useState(true)
    const [guardando, setGuardando] = useState(false)

    const role = (profile?.role || '').toLowerCase()
    const { lotes, cargando, limite, setLimite, hayMas, siguientePaso, masAntiguo } =
        useLotesSucursal(auditoria?.sucursal || "")

    useEffect(() => {
        if (!authLoading && profile) {
            if (!profile.is_admin && !ROLES_AUDITORES.includes(role)) {
                toast.error("Acceso restringido", { description: "Solo Calidad puede ajustar lotes." })
                router.push('/')
            }
        }
    }, [profile, authLoading, role, router])

    useEffect(() => {
        const cargar = async () => {
            try {
                const { data: aud, error: errAud } = await supabase
                    .from('auditorias_presenciales')
                    .select('*')
                    .eq('id', params.id)
                    .single()
                if (errAud) throw errAud

                if (aud.estado === 'CERRADA') {
                    toast.error("Auditoría cerrada", { description: "Ya no se pueden ajustar sus lotes." })
                    router.push(`/auditorias/${params.id}`)
                    return
                }

                const { data: filas, error: errFilas } = await supabase
                    .from('auditoria_lotes')
                    .select('*')
                    .eq('auditoria_id', params.id)
                if (errFilas) throw errFilas

                setAuditoria(aud)
                setFilasActuales(filas || [])
                setSeleccion(new Set((filas || []).map(f => f.measurement_id).filter(Boolean)))
            } catch (err: any) {
                toast.error("No se pudo cargar la auditoría", { description: err.message })
                router.push('/auditorias')
            } finally {
                setCargandoAud(false)
            }
        }
        if (user && profile) cargar()
        else if (!authLoading) setCargandoAud(false)
    }, [user?.id, profile?.role, authLoading, params.id, router])

    // Lotes que ya traen mediciones capturadas: la etiqueta "YA MEDIDO" y el aviso
    // al quitarlos salen de aquí.
    const conDatos = useMemo(
        () => new Set(filasActuales.filter(tieneMediciones).map(f => f.measurement_id)),
        [filasActuales]
    )

    const idsOriginales = useMemo(
        () => new Set(filasActuales.map(f => f.measurement_id).filter(Boolean)),
        [filasActuales]
    )

    // Lotes de la auditoría que no alcanzaron a entrar en la ventana consultada:
    // siguen seleccionados aunque no se vean, así que no se pueden perder por error.
    const fueraDeVentana = useMemo(() => {
        if (lotes.length === 0) return 0
        const visibles = new Set(lotes.map(l => l.id))
        return Array.from(idsOriginales).filter(id => !visibles.has(id)).length
    }, [lotes, idsOriginales])

    const toggle = (id: string) => {
        setSeleccion(prev => {
            const next = new Set(prev)
            next.has(id) ? next.delete(id) : next.add(id)
            return next
        })
    }

    // "Seleccionar todos" solo agrega: quitar todo de golpe borraría mediciones
    // sin que quede claro qué se perdió.
    const reemplazar = (ids: string[]) => {
        setSeleccion(prev => {
            const next = new Set(prev)
            for (const id of ids) next.add(id)
            return next
        })
    }

    const agregados = Array.from(seleccion).filter(id => !idsOriginales.has(id))
    const quitados = Array.from(idsOriginales).filter(id => !seleccion.has(id))
    const quitadosConDatos = quitados.filter(id => conDatos.has(id))
    const hayCambios = agregados.length > 0 || quitados.length > 0

    const guardar = async () => {
        if (!hayCambios) { toast.info("No hay cambios que guardar"); return }

        if (quitadosConDatos.length > 0) {
            const lista = filasActuales
                .filter(f => quitadosConDatos.includes(f.measurement_id))
                .map(f => `  • ${f.lote_producto || f.codigo_producto}`)
                .join('\n')
            const seguir = confirm(
                `Vas a quitar ${quitadosConDatos.length} lote${quitadosConDatos.length === 1 ? '' : 's'} que ya ${quitadosConDatos.length === 1 ? 'tiene' : 'tienen'} mediciones capturadas:\n\n${lista}\n\n` +
                `Esas mediciones se borran y no se pueden recuperar.\n\n¿Continuar?`
            )
            if (!seguir) return
        }

        setGuardando(true)
        try {
            if (quitados.length > 0) {
                const { error } = await supabase
                    .from('auditoria_lotes')
                    .delete()
                    .eq('auditoria_id', params.id)
                    .in('measurement_id', quitados)
                if (error) throw error
            }

            if (agregados.length > 0) {
                const filas = filasDesdeLotes(
                    params.id,
                    lotes.filter(l => agregados.includes(l.id))
                )
                const { error } = await supabase.from('auditoria_lotes').insert(filas)
                if (error) throw error
            }

            const partes = []
            if (agregados.length) partes.push(`${agregados.length} agregado${agregados.length === 1 ? '' : 's'}`)
            if (quitados.length) partes.push(`${quitados.length} quitado${quitados.length === 1 ? '' : 's'}`)
            toast.success("Lotes actualizados", { description: partes.join(' · ') })
            router.push(`/auditorias/${params.id}`)
        } catch (err: any) {
            toast.error("No se pudieron actualizar los lotes", { description: err.message })
            setGuardando(false)
        }
    }

    if (cargandoAud || !auditoria) {
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
                { label: auditoria.sucursal, href: `/auditorias/${params.id}` },
                { label: "Ajustar lotes" },
            ]} />

            <div className="flex items-center gap-3 mb-2">
                <ShieldCheck className="h-6 w-6 text-blue-600" />
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Ajustar lotes</h1>
                    <p className="text-sm text-muted-foreground">
                        {auditoria.sucursal} · {formatFecha(auditoria.fecha_auditoria)} — agrega o quita lotes sin perder lo ya capturado
                    </p>
                </div>
            </div>

            <Card className="border-none shadow-sm bg-blue-50 dark:bg-blue-950/30 rounded-[2rem]">
                <CardContent className="p-5 text-sm text-blue-900 dark:text-blue-300">
                    Los lotes marcados ya pertenecen a la auditoría. Los que traen la etiqueta
                    {' '}<strong>YA MEDIDO</strong> conservan sus mediciones: mientras sigan marcados, no se tocan.
                </CardContent>
            </Card>

            <TablaLotes
                sucursal={auditoria.sucursal}
                lotes={lotes}
                cargando={cargando}
                seleccion={seleccion}
                onToggle={toggle}
                onReemplazar={reemplazar}
                hayMas={hayMas}
                siguientePaso={siguientePaso}
                masAntiguo={masAntiguo}
                onAmpliar={() => siguientePaso && setLimite(siguientePaso)}
                limite={limite}
                conDatos={conDatos}
                fueraDeVentana={fueraDeVentana}
                soloAgregar
            />

            <div className="fixed bottom-0 left-0 right-0 z-30 p-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200 dark:border-slate-700">
                <div className="max-w-5xl mx-auto flex flex-wrap items-center gap-3">
                    <span className="text-sm text-slate-600 dark:text-slate-300">
                        <strong>{seleccion.size}</strong> lote{seleccion.size === 1 ? '' : 's'} en la auditoría
                        {agregados.length > 0 && <span className="text-emerald-600 dark:text-emerald-400"> · +{agregados.length}</span>}
                        {quitados.length > 0 && <span className="text-red-600 dark:text-red-400"> · −{quitados.length}</span>}
                        {quitadosConDatos.length > 0 && (
                            <span className="text-red-600 dark:text-red-400 font-semibold"> (con mediciones)</span>
                        )}
                    </span>
                    <Button
                        variant="ghost"
                        className="rounded-full ml-auto"
                        onClick={() => router.push(`/auditorias/${params.id}`)}
                        disabled={guardando}
                    >
                        Cancelar
                    </Button>
                    <Button className="rounded-full gap-2" onClick={guardar} disabled={guardando || !hayCambios}>
                        {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Guardar cambios
                    </Button>
                </div>
            </div>
        </div>
    )
}
