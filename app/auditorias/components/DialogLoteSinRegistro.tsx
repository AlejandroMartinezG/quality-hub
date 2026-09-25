'use client'

import { useState } from 'react'
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select"
import { Loader2, FileWarning } from 'lucide-react'
import {
    CATEGORY_PRODUCTS, PARAMETER_APPLICABILITY,
    APPEARANCE_STANDARDS, PRODUCT_STANDARDS, PH_STANDARDS,
} from "@/lib/production-constants"

/** Todos los códigos del catálogo, sin repetir y en orden. */
const CODIGOS = Array.from(new Set(Object.values(CATEGORY_PRODUCTS).flat())).sort()

const OPCIONES_APARIENCIA = [
    "CRISTALINO", "OPACO", "APERLADO", "TURBIO",
    "PARTICULAS SUSPENDIDAS", "SEPARACION DE COMPONENTES",
]

const VACIO = {
    codigo_producto: '',
    lote_producto: '',
    fecha_fabricacion: '',
    tamano_lote: '',
    nombre_preparador: '',
    ph_calidad: '',
    solidos_1_calidad: '',
    temp_1_calidad: '',
    solidos_2_calidad: '',
    temp_2_calidad: '',
    apariencia_calidad: '',
    color_calidad: '',
    aroma_calidad: '',
    notas: '',
}

interface Props {
    auditoriaId: string
    abierto: boolean
    onCerrar: () => void
    onGuardado: () => void
}

export default function DialogLoteSinRegistro({ auditoriaId, abierto, onCerrar, onGuardado }: Props) {
    const [form, setForm] = useState({ ...VACIO })
    const [guardando, setGuardando] = useState(false)

    const aplica = PARAMETER_APPLICABILITY[form.codigo_producto] || { solidos: false, ph: false }
    const esperaApariencia = Boolean(APPEARANCE_STANDARDS[form.codigo_producto])
    const stdSol = PRODUCT_STANDARDS[form.codigo_producto]
    const stdPh = PH_STANDARDS[form.codigo_producto]

    const codigos = CODIGOS

    const set = (campo: string, valor: string) =>
        setForm(prev => ({ ...prev, [campo]: valor }))

    const guardar = async () => {
        // El código es el ancla: sin él no se puede saber qué estándares aplican
        // ni a qué familia pertenece el lote.
        if (!form.codigo_producto) {
            toast.error("Falta el código de producto", {
                description: "Es lo que define qué parámetros aplican al lote.",
            })
            return
        }

        setGuardando(true)
        try {
            const num = (v: string) => v === '' ? null : parseFloat(v)
            const txt = (v: string) => v.trim() === '' ? null : v.trim()

            const { error } = await supabase.from('auditoria_lotes').insert({
                auditoria_id: auditoriaId,
                measurement_id: null,          // no existe registro que referenciar
                origen: 'SIN_REGISTRO',
                resultado: 'SIN_REGISTRO',
                codigo_producto: form.codigo_producto,
                lote_producto: txt(form.lote_producto),
                fecha_fabricacion: txt(form.fecha_fabricacion),
                nombre_preparador: txt(form.nombre_preparador),
                tamano_lote: num(form.tamano_lote),
                ph_calidad: num(form.ph_calidad),
                solidos_1_calidad: num(form.solidos_1_calidad),
                temp_1_calidad: num(form.temp_1_calidad),
                solidos_2_calidad: num(form.solidos_2_calidad),
                temp_2_calidad: num(form.temp_2_calidad),
                apariencia_calidad: txt(form.apariencia_calidad),
                color_calidad: txt(form.color_calidad),
                aroma_calidad: txt(form.aroma_calidad),
                notas: txt(form.notas),
            })
            if (error) throw error

            toast.success("Lote sin registro agregado", {
                description: "Cuenta en el cumplimiento de registro, no en la discrepancia.",
            })
            setForm({ ...VACIO })
            onGuardado()
            onCerrar()
        } catch (err: any) {
            toast.error("No se pudo agregar", { description: err.message })
        } finally {
            setGuardando(false)
        }
    }

    const Campo = ({ label, campo, tipo = 'text', paso, ayuda }: any) => (
        <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{label}</label>
            <Input
                type={tipo}
                step={paso}
                value={(form as any)[campo]}
                onChange={e => set(campo, e.target.value)}
                className="rounded-full"
            />
            {ayuda && <p className="text-[10px] text-slate-400">{ayuda}</p>}
        </div>
    )

    return (
        <Dialog open={abierto} onOpenChange={o => !o && onCerrar()}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileWarning className="h-5 w-5 text-purple-600" />
                        Lote sin registro en la plataforma
                    </DialogTitle>
                    <DialogDescription>
                        Producto que encontraste físicamente en sucursal y que el operador nunca capturó.
                        Cuenta para el <strong>cumplimiento de registro</strong>, no para la discrepancia.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                            Código de producto *
                        </label>
                        <Select value={form.codigo_producto} onValueChange={v => set('codigo_producto', v)}>
                            <SelectTrigger className="rounded-full">
                                <SelectValue placeholder="Selecciona el código" />
                            </SelectTrigger>
                            <SelectContent className="max-h-72">
                                {codigos.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <p className="text-[10px] text-slate-400">
                            Define qué parámetros aplican y a qué familia pertenece.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Campo label="Número de lote" campo="lote_producto" ayuda="Como venga en la etiqueta física" />
                        <Campo label="Fecha de fabricación" campo="fecha_fabricacion" tipo="date" />
                        <Campo label="Tamaño de lote" campo="tamano_lote" tipo="number" paso="1" />
                        <Campo label="Preparador" campo="nombre_preparador" ayuda="Si lo pudiste identificar" />
                    </div>

                    {form.codigo_producto && (
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
                            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                                Tus mediciones
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {aplica.ph && (
                                    <Campo
                                        label="pH" campo="ph_calidad" tipo="number" paso="0.1"
                                        ayuda={stdPh ? `Ref: ${stdPh.min === stdPh.max ? stdPh.min : `${stdPh.min}–${stdPh.max}`}` : undefined}
                                    />
                                )}
                                {aplica.solidos && (
                                    <>
                                        <Campo
                                            label="Sólidos M1" campo="solidos_1_calidad" tipo="number" paso="0.01"
                                            ayuda={stdSol ? `Ref: ${stdSol.min}–${stdSol.max}%` : undefined}
                                        />
                                        <Campo label="Temp T1" campo="temp_1_calidad" tipo="number" paso="0.1" />
                                        <Campo label="Sólidos M2" campo="solidos_2_calidad" tipo="number" paso="0.01" />
                                        <Campo label="Temp T2" campo="temp_2_calidad" tipo="number" paso="0.1" />
                                    </>
                                )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {esperaApariencia && (
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                                            Apariencia
                                        </label>
                                        <Select value={form.apariencia_calidad} onValueChange={v => set('apariencia_calidad', v)}>
                                            <SelectTrigger className="rounded-full"><SelectValue placeholder="—" /></SelectTrigger>
                                            <SelectContent>
                                                {OPCIONES_APARIENCIA.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        <p className="text-[10px] text-slate-400">
                                            Esp: {APPEARANCE_STANDARDS[form.codigo_producto]}
                                        </p>
                                    </div>
                                )}
                                {(['color', 'aroma'] as const).map(k => (
                                    <div key={k} className="space-y-1">
                                        <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide capitalize">
                                            {k}
                                        </label>
                                        <Select
                                            value={(form as any)[`${k}_calidad`]}
                                            onValueChange={v => set(`${k}_calidad`, v)}
                                        >
                                            <SelectTrigger className="rounded-full"><SelectValue placeholder="—" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="CONFORME">CONFORME</SelectItem>
                                                <SelectItem value="NO CONFORME">NO CONFORME</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Notas</label>
                        <Textarea
                            value={form.notas}
                            onChange={e => set('notas', e.target.value)}
                            placeholder="Dónde lo encontraste, qué te dijeron en sucursal, etc."
                            className="rounded-2xl text-sm min-h-[3rem]"
                        />
                    </div>

                    <div className="flex gap-2">
                        <Button variant="ghost" className="rounded-full ml-auto" onClick={onCerrar} disabled={guardando}>
                            Cancelar
                        </Button>
                        <Button className="rounded-full gap-2" onClick={guardar} disabled={guardando}>
                            {guardando && <Loader2 className="h-4 w-4 animate-spin" />}
                            Agregar lote
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
