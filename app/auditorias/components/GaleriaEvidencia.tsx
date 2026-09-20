'use client'

import { useState, useRef } from 'react'
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog"
import { Camera, Loader2, Trash2, X } from 'lucide-react'
import { procesarFoto, pesoLegible } from "@/lib/imagen-utils"

export const BUCKET = 'evidencia-auditorias'

export type Evidencia = {
    id: string
    auditoria_id: string
    lote_id: string | null
    ruta: string
    ruta_miniatura: string
    descripcion: string | null
    bytes: number
    urlMiniatura?: string
    urlCompleta?: string
    /** Número corrido dentro del reporte. Lo asigna la hoja, no la base. */
    numero?: number
}

interface Props {
    auditoriaId: string
    loteId: string | null
    evidencias: Evidencia[]
    editable: boolean
    maximo: number
    userId?: string
    onCambio: () => void
}

export default function GaleriaEvidencia({
    auditoriaId, loteId, evidencias, editable, maximo, userId, onCambio,
}: Props) {
    const [subiendo, setSubiendo] = useState(false)
    const [abierta, setAbierta] = useState<Evidencia | null>(null)
    const [borrando, setBorrando] = useState<string | null>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    const lleno = evidencias.length >= maximo

    const subir = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const archivos = Array.from(e.target.files || [])
        if (archivos.length === 0) return
        if (inputRef.current) inputRef.current.value = ''

        const cupo = maximo - evidencias.length
        if (archivos.length > cupo) {
            toast.error(`Solo caben ${cupo} foto${cupo === 1 ? '' : 's'} más aquí`)
            return
        }

        setSubiendo(true)
        let subidas = 0

        for (const archivo of archivos) {
            // Cada foto se sube por separado: si una falla, las demás se salvan.
            try {
                const { completa, miniatura } = await procesarFoto(archivo)

                const id = crypto.randomUUID()
                const ruta = `${auditoriaId}/${id}.jpg`
                const rutaMin = `${auditoriaId}/${id}_min.jpg`

                const sube = (p: string, b: Blob) => supabase.storage
                    .from(BUCKET)
                    .upload(p, b, { contentType: 'image/jpeg', upsert: false })

                const { error: e1 } = await sube(ruta, completa)
                if (e1) throw e1

                const { error: e2 } = await sube(rutaMin, miniatura)
                if (e2) {
                    // Sin miniatura no sirve para el PDF: se revierte la completa
                    // en vez de dejar un objeto suelto ocupando disco.
                    await supabase.storage.from(BUCKET).remove([ruta])
                    throw e2
                }

                const { error: e3 } = await supabase.from('auditoria_evidencias').insert({
                    id,
                    auditoria_id: auditoriaId,
                    lote_id: loteId,
                    ruta,
                    ruta_miniatura: rutaMin,
                    bytes: completa.size + miniatura.size,
                    subida_por: userId || null,
                })
                if (e3) {
                    await supabase.storage.from(BUCKET).remove([ruta, rutaMin])
                    throw e3
                }

                subidas++
            } catch (err: any) {
                toast.error(`No se pudo subir ${archivo.name}`, { description: err.message })
            }
        }

        setSubiendo(false)
        if (subidas > 0) {
            toast.success(`${subidas} foto${subidas === 1 ? '' : 's'} agregada${subidas === 1 ? '' : 's'}`)
            onCambio()
        }
    }

    const borrar = async (ev: Evidencia) => {
        if (!confirm('¿Borrar esta foto? No se puede recuperar.')) return
        setBorrando(ev.id)
        try {
            const { error } = await supabase.from('auditoria_evidencias').delete().eq('id', ev.id)
            if (error) throw error
            await supabase.storage.from(BUCKET).remove([ev.ruta, ev.ruta_miniatura])
            setAbierta(null)
            onCambio()
        } catch (err: any) {
            toast.error("No se pudo borrar", { description: err.message })
        } finally {
            setBorrando(null)
        }
    }

    const guardarDescripcion = async (ev: Evidencia, texto: string) => {
        const { error } = await supabase
            .from('auditoria_evidencias')
            .update({ descripcion: texto || null })
            .eq('id', ev.id)
        if (error) toast.error("No se pudo guardar el pie de foto", { description: error.message })
        else onCambio()
    }

    return (
        <div className="flex flex-wrap items-start gap-2">
            {evidencias.map(ev => (
                <button
                    key={ev.id}
                    type="button"
                    onClick={() => setAbierta(ev)}
                    className="relative group h-20 w-20 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800"
                >
                    {ev.urlMiniatura ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={ev.urlMiniatura} alt={ev.descripcion || 'Evidencia'} className="h-full w-full object-cover" />
                    ) : (
                        <Loader2 className="h-4 w-4 animate-spin text-slate-400 m-auto" />
                    )}
                    {ev.numero !== undefined && (
                        <span className="absolute top-0.5 left-0.5 px-1.5 rounded-full bg-black/70 text-white text-[10px] font-bold">
                            {ev.numero}
                        </span>
                    )}
                </button>
            ))}

            {editable && !lleno && (
                <>
                    <button
                        type="button"
                        onClick={() => inputRef.current?.click()}
                        disabled={subiendo}
                        className="h-20 w-20 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 flex flex-col items-center justify-center gap-1 text-slate-400 hover:border-blue-500 hover:text-blue-600 transition-colors disabled:opacity-50"
                    >
                        {subiendo
                            ? <Loader2 className="h-5 w-5 animate-spin" />
                            : <><Camera className="h-5 w-5" /><span className="text-[10px]">Agregar</span></>}
                    </button>
                    <input
                        ref={inputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={subir}
                        className="hidden"
                    />
                </>
            )}

            {evidencias.length === 0 && !editable && (
                <span className="text-xs text-slate-400">Sin fotos</span>
            )}

            <Dialog open={!!abierta} onOpenChange={o => !o && setAbierta(null)}>
                <DialogContent className="max-w-3xl">
                    {abierta && (
                        <>
                            <DialogHeader>
                                <DialogTitle>
                                    Foto {abierta.numero ?? ''}
                                </DialogTitle>
                                <DialogDescription>{pesoLegible(abierta.bytes)}</DialogDescription>
                            </DialogHeader>

                            {abierta.urlCompleta && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={abierta.urlCompleta}
                                    alt={abierta.descripcion || 'Evidencia'}
                                    className="w-full max-h-[60vh] object-contain rounded-xl bg-slate-100 dark:bg-slate-800"
                                />
                            )}

                            <div className="space-y-2">
                                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                                    Pie de foto
                                </label>
                                <Input
                                    defaultValue={abierta.descripcion || ''}
                                    disabled={!editable}
                                    placeholder="Qué se ve en la foto"
                                    className="rounded-full"
                                    onBlur={e => {
                                        if (e.target.value !== (abierta.descripcion || '')) {
                                            guardarDescripcion(abierta, e.target.value.trim())
                                        }
                                    }}
                                />
                                <p className="text-[11px] text-slate-400">
                                    Aparece debajo de la foto en el anexo del reporte.
                                </p>
                            </div>

                            <div className="flex gap-2">
                                {editable && (
                                    <Button
                                        variant="ghost"
                                        className="rounded-full gap-2 text-red-600 hover:text-red-700"
                                        onClick={() => borrar(abierta)}
                                        disabled={borrando === abierta.id}
                                    >
                                        {borrando === abierta.id
                                            ? <Loader2 className="h-4 w-4 animate-spin" />
                                            : <Trash2 className="h-4 w-4" />}
                                        Borrar foto
                                    </Button>
                                )}
                                <Button variant="outline" className="rounded-full ml-auto gap-2" onClick={() => setAbierta(null)}>
                                    <X className="h-4 w-4" /> Cerrar
                                </Button>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
