"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/AuthProvider"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog"
import { Breadcrumbs } from "@/components/Breadcrumbs"
import { Loader2, Star, Plus, Pencil } from "lucide-react"
import { listarEspeciales, type ProductoEspecial } from "@/lib/productos-especiales"

/** Mismos roles que permiten escribir en la tabla según su RLS. */
const ROLES_CALIDAD = ['admin', 'gerente_calidad', 'coordinador']

const VACIO = {
    codigo: '',
    nombre: '',
    mide_ph: false,
    mide_solidos: false,
    mide_apariencia: false,
    notas: '',
    activo: true,
}

export default function ProductosEspecialesPage() {
    const { user, profile, loading: authLoading } = useAuth()
    const router = useRouter()

    const [productos, setProductos] = useState<ProductoEspecial[]>([])
    const [cargando, setCargando] = useState(true)
    const [form, setForm] = useState({ ...VACIO })
    const [editando, setEditando] = useState<string | null>(null)
    const [abierto, setAbierto] = useState(false)
    const [guardando, setGuardando] = useState(false)

    const role = (profile?.role || '').toLowerCase()

    useEffect(() => {
        if (!authLoading && profile) {
            if (!profile.is_admin && !ROLES_CALIDAD.includes(role)) {
                toast.error("Acceso restringido", { description: "Solo Calidad administra los productos especiales." })
                router.push('/')
            }
        }
    }, [profile, authLoading, role, router])

    const cargar = useCallback(async () => {
        setCargando(true)
        setProductos(await listarEspeciales())
        setCargando(false)
    }, [])

    useEffect(() => {
        if (user && profile) cargar()
        else if (!authLoading) setCargando(false)
    }, [user?.id, profile?.role, authLoading, cargar])

    const abrirNuevo = () => {
        setForm({ ...VACIO })
        setEditando(null)
        setAbierto(true)
    }

    const abrirEdicion = (p: ProductoEspecial) => {
        setForm({
            codigo: p.codigo,
            nombre: p.nombre,
            mide_ph: p.mide_ph,
            mide_solidos: p.mide_solidos,
            mide_apariencia: p.mide_apariencia,
            notas: p.notas || '',
            activo: p.activo,
        })
        setEditando(p.codigo)
        setAbierto(true)
    }

    const guardar = async () => {
        const codigo = form.codigo.trim().toUpperCase()

        if (!/^[A-Z0-9-]{1,8}$/.test(codigo)) {
            toast.error("Código inválido", {
                description: "Hasta 8 caracteres, solo mayúsculas, números y guiones.",
            })
            return
        }
        if (!form.nombre.trim()) {
            toast.error("Falta el nombre del producto")
            return
        }

        setGuardando(true)
        try {
            const fila = {
                codigo,
                nombre: form.nombre.trim(),
                mide_ph: form.mide_ph,
                mide_solidos: form.mide_solidos,
                mide_apariencia: form.mide_apariencia,
                notas: form.notas.trim() || null,
                activo: form.activo,
                updated_at: new Date().toISOString(),
            }

            // El código es la llave primaria, así que al editar hay que actualizar
            // en vez de insertar: un upsert por código cubre ambos casos.
            const { error } = editando
                ? await supabase.from('productos_especiales').update(fila).eq('codigo', editando)
                : await supabase.from('productos_especiales').insert({ ...fila, creado_por: user?.id || null })

            if (error) {
                if (error.code === '23505') {
                    toast.error(`El código ${codigo} ya está dado de alta`)
                    return
                }
                throw error
            }

            toast.success(editando ? "Producto actualizado" : `${codigo} dado de alta`)
            setAbierto(false)
            cargar()
        } catch (err: any) {
            toast.error("No se pudo guardar", { description: err.message })
        } finally {
            setGuardando(false)
        }
    }

    if (cargando) {
        return (
            <div className="h-96 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        )
    }

    return (
        <div className="space-y-6 pb-12">
            <Breadcrumbs items={[{ label: "Configuración", href: "/configuracion" }, { label: "Productos especiales" }]} />

            <div className="flex flex-wrap items-center gap-3">
                <Star className="h-6 w-6 text-purple-600" />
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Productos especiales</h1>
                    <p className="text-sm text-muted-foreground">
                        Fabricaciones fuera de línea. Aquí defines su código y qué parámetros debe registrar la sucursal.
                    </p>
                </div>
                <Button className="rounded-full gap-2 ml-auto" onClick={abrirNuevo}>
                    <Plus className="h-4 w-4" /> Dar de alta
                </Button>
            </div>

            <Card className="border-none shadow-sm bg-purple-50 dark:bg-purple-950/30 rounded-[2rem]">
                <CardContent className="p-5 text-sm text-purple-900 dark:text-purple-300">
                    Estos lotes <strong>suman al volumen producido pero no entran al cálculo de FTQ ni de Yield</strong>:
                    se miden, pero no hay un estándar oficial contra el cual declararlos conformes.
                </CardContent>
            </Card>

            {productos.length === 0 ? (
                <Card className="border-none shadow-sm dark:bg-slate-900 rounded-[2rem]">
                    <CardHeader>
                        <CardTitle className="text-lg font-bold">Todavía no hay ninguno</CardTitle>
                        <CardDescription>
                            Da de alta el primero con el botón de arriba. Mientras no exista, la sucursal
                            no podrá capturar lotes con ese código.
                        </CardDescription>
                    </CardHeader>
                </Card>
            ) : (
                <Card className="border-none shadow-sm dark:bg-slate-900 rounded-[2rem]">
                    <CardContent className="p-0 overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-700">
                                    <th className="text-left px-4 py-3 font-semibold text-slate-500 dark:text-slate-400">Código</th>
                                    <th className="text-left px-4 py-3 font-semibold text-slate-500 dark:text-slate-400">Producto</th>
                                    <th className="text-left px-4 py-3 font-semibold text-slate-500 dark:text-slate-400">Registra</th>
                                    <th className="text-left px-4 py-3 font-semibold text-slate-500 dark:text-slate-400">Estado</th>
                                    <th className="px-4 py-3" />
                                </tr>
                            </thead>
                            <tbody>
                                {productos.map(p => (
                                    <tr key={p.codigo} className={`border-b border-slate-100 dark:border-slate-800 last:border-0 ${p.activo ? '' : 'opacity-50'}`}>
                                        <td className="px-4 py-3 font-mono font-bold text-slate-800 dark:text-slate-200">{p.codigo}</td>
                                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                                            {p.nombre}
                                            {p.notas && <span className="block text-[11px] text-slate-400">{p.notas}</span>}
                                        </td>
                                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">
                                            {[
                                                p.mide_ph && 'pH',
                                                p.mide_solidos && 'sólidos',
                                                p.mide_apariencia && 'apariencia',
                                            ].filter(Boolean).join(' · ') || <span className="text-slate-300">ninguno</span>}
                                        </td>
                                        <td className="px-4 py-3">
                                            {p.activo
                                                ? <Badge className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border-none rounded-full">Activo</Badge>
                                                : <Badge className="bg-slate-200 dark:bg-slate-800 text-slate-500 border-none rounded-full">Baja</Badge>}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <Button variant="ghost" size="sm" className="rounded-full gap-2" onClick={() => abrirEdicion(p)}>
                                                <Pencil className="h-3.5 w-3.5" /> Editar
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </CardContent>
                </Card>
            )}

            <Dialog open={abierto} onOpenChange={o => !o && setAbierto(false)}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{editando ? `Editar ${editando}` : 'Nuevo producto especial'}</DialogTitle>
                        <DialogDescription>
                            El código es el que le vas a dar a la sucursal para que capture sus lotes.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Código *</label>
                            <Input
                                value={form.codigo}
                                disabled={!!editando}
                                onChange={e => setForm({ ...form, codigo: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 8) })}
                                placeholder="ESPGIN01"
                                className="rounded-full font-mono font-bold"
                            />
                            <p className="text-[10px] text-slate-400">
                                {editando
                                    ? 'El código no se cambia: los lotes ya registrados lo referencian.'
                                    : 'Hasta 8 caracteres, solo mayúsculas, números y guiones.'}
                            </p>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Nombre *</label>
                            <Input
                                value={form.nombre}
                                onChange={e => setForm({ ...form, nombre: e.target.value })}
                                placeholder="Gel sanitizante — pedido especial"
                                className="rounded-full"
                            />
                        </div>

                        <div className="space-y-2 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
                            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                                Qué debe registrar la sucursal
                            </p>
                            {([
                                ['mide_ph', 'pH'],
                                ['mide_solidos', '% de sólidos (M1, T1, M2, T2)'],
                                ['mide_apariencia', 'Apariencia'],
                            ] as const).map(([campo, etiqueta]) => (
                                <label key={campo} className="flex items-center gap-3 cursor-pointer">
                                    <Checkbox
                                        checked={form[campo]}
                                        onCheckedChange={v => setForm({ ...form, [campo]: !!v })}
                                    />
                                    <span className="text-sm text-slate-700 dark:text-slate-300">{etiqueta}</span>
                                </label>
                            ))}
                            <p className="text-[10px] text-slate-400 pt-1">
                                Lo que marques será obligatorio al capturar. Lo demás ni siquiera se muestra.
                            </p>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Notas</label>
                            <Textarea
                                value={form.notas}
                                onChange={e => setForm({ ...form, notas: e.target.value })}
                                placeholder="Indicaciones para el operador: a qué cliente va, qué cuidar al fabricarlo…"
                                className="rounded-2xl text-sm min-h-[3rem]"
                            />
                            <p className="text-[10px] text-slate-400">Se le muestran al capturar el lote.</p>
                        </div>

                        <label className="flex items-center gap-3 cursor-pointer">
                            <Checkbox checked={form.activo} onCheckedChange={v => setForm({ ...form, activo: !!v })} />
                            <span className="text-sm text-slate-700 dark:text-slate-300">
                                Activo — la sucursal puede capturar lotes con este código
                            </span>
                        </label>

                        <div className="flex gap-2">
                            <Button variant="ghost" className="rounded-full ml-auto" onClick={() => setAbierto(false)} disabled={guardando}>
                                Cancelar
                            </Button>
                            <Button className="rounded-full gap-2" onClick={guardar} disabled={guardando}>
                                {guardando && <Loader2 className="h-4 w-4 animate-spin" />}
                                {editando ? 'Guardar cambios' : 'Dar de alta'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
