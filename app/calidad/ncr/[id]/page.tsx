'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
    AlertTriangle,
    ArrowLeft,
    CheckCircle2,
    MessageSquare,
    Save,
    User,
    Clock,
    FileText,
    Beaker,
    Trash2
} from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useAuth } from '@/components/AuthProvider'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { DeleteConfirmationDialog } from '@/components/DeleteConfirmationDialog'

interface NCRDetailProps {
    params: {
        id: string
    }
}

export default function NCRDetailPage({ params }: NCRDetailProps) {
    const { profile } = useAuth()
    const router = useRouter()
    const [ncr, setNcr] = useState<any>(null)
    const [disposition, setDisposition] = useState<any>(null)
    const [history, setHistory] = useState<any[]>([])
    const [bitacoraObs, setBitacoraObs] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    // Form States
    const [newComment, setNewComment] = useState('')
    const [submittingComment, setSubmittingComment] = useState(false)

    // Disposition Form
    const [dispType, setDispType] = useState<string>('')
    const [litersInvolved, setLitersInvolved] = useState<string>('')
    const [dispNotes, setDispNotes] = useState('')
    const [submittingDisp, setSubmittingDisp] = useState(false)
    const [newStatus, setNewStatus] = useState<string>('ABIERTO')
    const [correctiveActions, setCorrectiveActions] = useState('')
    const [dispositionCustom, setDispositionCustom] = useState('')
    const [severity, setSeverity] = useState('')

    // Delete state
    const [showDeleteDialog, setShowDeleteDialog] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)

    // Refs for scrolling
    const commentsEndRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        fetchNCRDetail()

        const channel = supabase
            .channel(`ncr_detail_${params.id}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'quality_ncr_comments',
                filter: `ncr_id=eq.${params.id}`
            }, () => {
                fetchNCRDetail() // Refresh on new comment
            })
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'quality_disposition',
                filter: `ncr_id=eq.${params.id}`
            }, () => {
                fetchNCRDetail() // Refresh on disposition
            })
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [params.id])

    useEffect(() => {
        if (commentsEndRef.current) {
            commentsEndRef.current.scrollIntoView({ behavior: 'smooth' })
        }
    }, [history])

    async function fetchNCRDetail() {
        setLoading(true)
        try {
            const { data, error } = await supabase.rpc('rpc_ncr_detail', { p_ncr_id: params.id })

            if (error) throw error
            if (data) {
                setNcr(data.ncr)
                setDisposition(data.disposition)
                setHistory(data.history || [])
                // Initialize form defaults
                setSeverity(data.ncr.severity || '')
                setLitersInvolved(data.ncr.liters_involved?.toString() || '')
                setCorrectiveActions(data.ncr.corrective_actions || '')
                setNewStatus(data.ncr.status)
                if (data.disposition) {
                    setDispType(data.disposition.disposition_type)
                    setDispNotes(data.disposition.notes)
                    setDispositionCustom(data.ncr.disposition_custom || '')
                }

                // Fetch Bitacora Observation if linked
                if (data.ncr.measurement_id) {
                    const { data: bitacoraData } = await supabase
                        .from('bitacora_produccion_calidad')
                        .select('observaciones')
                        .eq('id', data.ncr.measurement_id)
                        .single()

                    if (bitacoraData?.observaciones) {
                        setBitacoraObs(bitacoraData.observaciones)
                    } else {
                        setBitacoraObs(null)
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching NCR detail:', error)
            toast.error('Error al cargar el detalle del NCR')
        } finally {
            setLoading(false)
        }
    }

    async function handleSubmitComment() {
        if (!newComment.trim() || !profile) return
        setSubmittingComment(true)
        try {
            const { error } = await supabase
                .from('quality_ncr_comments')
                .insert({
                    ncr_id: params.id,
                    author_user_id: profile.id,
                    message: newComment,
                    visibility: 'PUBLICO_NCR' // Default for now
                })

            if (error) throw error
            setNewComment('')
        } catch (error) {
            console.error('Error posting comment:', error)
            toast.error('Error al enviar comentario')
        } finally {
            setSubmittingComment(false)
        }
    }

    async function handleRegisterDisposition() {
        if (!dispType || !litersInvolved || !profile) {
            toast.error('Por favor completa los campos requeridos')
            return
        }

        setSubmittingDisp(true)
        try {
            // Save Disposition
            const { error } = await supabase
                .from('quality_disposition')
                .insert({
                    ncr_id: params.id,
                    disposition_type: dispType,
                    lot_liters_total: 0, // Should come from NCR/Batch info ideally, or prompt
                    liters_involved: parseFloat(litersInvolved),
                    notes: dispNotes,
                    closed_by: profile.id,
                    closed_at: new Date().toISOString()
                })

            if (error) throw error


            // Update NCR Status and Details
            const { error: statusError } = await supabase
                .from('quality_ncr')
                .update({
                    status: newStatus,
                    severity: severity,
                    liters_involved: parseFloat(litersInvolved), // Update NCR scope
                    corrective_actions: correctiveActions,
                    disposition_custom: dispType === 'OTRA' ? dispositionCustom : null
                })
                .eq('id', params.id)

            if (statusError) throw statusError

            toast.success('Disposición registrada exitosamente')
            setDispType('')
            setLitersInvolved('')
            setDispNotes('')
        } catch (error) {
            console.error('Error registering disposition:', error)
            toast.error('Error al registrar disposición')
        } finally {
            setSubmittingDisp(false)
        }
    }

    async function handleReopenCase() {
        if (!confirm('¿Estás seguro de que deseas reabrir este caso?')) return

        setLoading(true)
        try {
            // 1. Update NCR Status
            const { error: updateError } = await supabase
                .from('quality_ncr')
                .update({ status: 'ABIERTO' })
                .eq('id', params.id)

            if (updateError) throw updateError

            // 2. Add System Comment
            await supabase
                .from('quality_ncr_comments')
                .insert({
                    ncr_id: params.id,
                    author_user_id: profile?.id,
                    message: '🔄 Caso reabierto por administrador.',
                    visibility: 'PUBLICO_NCR'
                })

            // 3. Optional: Clear disposition or keep history? 
            // Keeping disposition as history but "unlinking" it from active status effectively reopens the flow.
            // We might want to "archive" the old disposition, but for now just reopening allows new actions.

            toast.success('Caso reabierto exitosamente')
            fetchNCRDetail() // Refresh data
        } catch (error) {
            console.error('Error reopening case:', error)
            toast.error('Error al reabrir el caso')
        } finally {
            setLoading(false)
        }
    }

    const confirmDelete = async () => {
        setIsDeleting(true)
        console.log("Starting deletion for NCR:", params.id)
        try {
            if (ncr?.measurement_id) {
                // Case A: Linked to Bitacora -> Delete Bitacora
                const { error: bitacoraError, count } = await supabase
                    .from('bitacora_produccion_calidad')
                    .delete({ count: 'exact' })
                    .eq('id', ncr.measurement_id)

                if (bitacoraError) throw bitacoraError

                if (count === 0) {
                    // Parent record missing - Orphaned NCR. Delete NCR manually.
                    const { error: ncrError } = await supabase
                        .from('quality_ncr')
                        .delete()
                        .eq('id', params.id)
                    if (ncrError) throw ncrError
                }

                toast.success("Registro y NCR eliminados exitosamente")
                router.push('/calidad/ncr')
            } else {
                // Case B: Standalone NCR -> Delete NCR
                const { error: ncrError } = await supabase
                    .from('quality_ncr')
                    .delete()
                    .eq('id', params.id)

                if (ncrError) throw ncrError
                toast.success("NCR eliminado exitosamente")
                router.push('/calidad/ncr')
            }
        } catch (error: any) {
            console.error('Error deleting NCR:', error)
            toast.error(`Error al eliminar: ${error.message || error.details || "Error desconocido"}`)
            setIsDeleting(false)
        }
    }

    if (loading) return <div className="p-8 text-center">Cargando detalle...</div>
    if (!ncr) return <div className="p-8 text-center">NCR no encontrado</div>

    const canManage = profile?.role === 'admin' || profile?.role === 'gerente_calidad' || profile?.role === 'coordinador'

    const formatDefectDetail = (text: string) => {
        if (!text) return 'Sin detalles adicionales.';

        // Separamos el texto por oraciones (normalmente terminadas por ". ")
        const sentences = text.split('. ').filter(s => s.trim().length > 0);

        return (
            <div className="space-y-3">
                {sentences.map((sentence, idx) => {
                    // Buscar el primer ":" para separar el nombre del parámetro del problema
                    const parts = sentence.split(/:\s(.+)/);
                    if (parts.length < 2) return <p key={idx} className="text-slate-700 dark:text-slate-300">{sentence}</p>;

                    const paramName = parts[0];
                    let rest = parts[1];

                    // Volver a poner el punto si se lo quitamos en el split (excepto tal vez al final)
                    if (idx < sentences.length - 1 && !rest.endsWith('.')) {
                        rest += '.';
                    }

                    // Resaltar valores medidos entre paréntesis () y estándares/tolerancias entre corchetes []
                    const formattedRest = rest.split(/(\([^)]+\)|\[[^\]]+\])/g).map((part, i) => {
                        if (part.startsWith('(') && part.endsWith(')')) {
                            return <span key={i} className="text-red-600 dark:text-red-400 font-bold">{part}</span>;
                        } else if (part.startsWith('[') && part.endsWith(']')) {
                            return <span key={i} className="text-blue-700 dark:text-blue-300 text-xs font-mono bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded ml-1 mr-1">{part}</span>;
                        }
                        return part;
                    });

                    return (
                        <div key={idx} className="pb-2 last:pb-0 border-slate-100 dark:border-slate-800 border-b last:border-0">
                            <span className="font-extrabold text-slate-900 dark:text-white mr-2">{paramName}:</span>
                            <span className="text-slate-600 dark:text-slate-300">{formattedRest}</span>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6 pb-12">
            <DeleteConfirmationDialog
                open={showDeleteDialog}
                onOpenChange={setShowDeleteDialog}
                onConfirm={confirmDelete}
                isDeleting={isDeleting}
            />

            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <Link href="/calidad?tab=ncr">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div className="flex-1">
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                            NCR: {ncr.batch_code}
                        </h1>
                        <Badge variant={ncr.status === 'CERRADO' ? 'secondary' : 'destructive'} className="rounded-full px-4 py-1 text-sm font-medium shadow-sm">
                            {ncr.status.replace('_', ' ')}
                        </Badge>
                    </div>
                    <p className="text-slate-500 text-sm flex items-center gap-2">
                        <span>{ncr.sucursal}</span>
                        <span>•</span>
                        <span>{ncr.product_id}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                            <User className="h-3 w-3" /> {ncr.preparer_name || 'Sin asignar'}
                        </span>
                    </p>
                </div>
                {profile?.role === 'admin' && (
                    <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setShowDeleteDialog(true)}
                        className="gap-2"
                    >
                        <Trash2 className="h-4 w-4" />
                        Eliminar NCR
                    </Button>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Content (Left 2/3) */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Defect Details */}
                    <Card className="rounded-[2rem] shadow-sm border-slate-200 dark:border-slate-800 overflow-hidden">
                        <CardHeader className="bg-gradient-to-r from-red-50 to-transparent dark:from-red-950/20 pb-4">
                            <CardTitle className="text-xl flex items-center gap-2 text-[#C1272D] dark:text-red-400">
                                <div className="h-8 w-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                    <AlertTriangle className="h-5 w-5" />
                                </div>
                                Detalle de No Conformidad
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6 pt-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-1.5">
                                    <Label className="text-slate-500 text-xs uppercase tracking-wider font-bold">Parámetro</Label>
                                    <p className="font-semibold text-lg text-slate-900 dark:text-slate-100">{ncr.defect_parameter}</p>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-slate-500 text-xs uppercase tracking-wider font-bold">Litros Inv.</Label>
                                    {canManage ? (
                                        <div className="flex items-center gap-2">
                                            <div className="relative">
                                                <Input
                                                    type="number"
                                                    value={litersInvolved}
                                                    onChange={(e) => setLitersInvolved(e.target.value)}
                                                    className="h-9 w-32 pr-8 font-mono"
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">L</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="font-semibold text-lg font-mono">{ncr.liters_involved?.toLocaleString()} L</p>
                                    )}
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-slate-500 text-xs uppercase tracking-wider font-bold">Gravedad</Label>
                                    {canManage ? (
                                        <Select value={severity} onValueChange={(val) => {
                                            setSeverity(val);
                                            // Optional: Auto-save severity or save with disposition
                                        }}>
                                            <SelectTrigger className="h-9 w-full">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="CRITICA">CRÍTICA (No Conforme)</SelectItem>
                                                <SelectItem value="MAYOR">MAYOR (Retener)</SelectItem>
                                                <SelectItem value="MENOR">MENOR (Semi-conforme)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        <Badge variant="outline" className="font-medium">
                                            {ncr.severity || 'No especificada'}
                                        </Badge>
                                    )}
                                </div>
                            </div>

                            <Separator className="bg-slate-100 dark:bg-slate-800" />

                            <div className="space-y-2">
                                <Label className="text-slate-500 text-xs uppercase tracking-wider font-bold">Detalle del Problema</Label>
                                <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-xl border border-slate-100 dark:border-slate-800 text-sm leading-relaxed shadow-sm">
                                    {formatDefectDetail(ncr.defect_detail)}
                                </div>
                            </div>

                            {ncr.containment_action && (
                                <div className="space-y-2">
                                    <Label className="text-slate-500 text-xs uppercase tracking-wider font-bold">Acción de Contención</Label>
                                    <div className="bg-orange-50 dark:bg-orange-950/10 p-4 rounded-xl border border-orange-100 dark:border-orange-900/20 text-sm text-orange-900 dark:text-orange-200">
                                        {ncr.containment_action}
                                    </div>
                                </div>
                            )}

                            {/* Bitacora Observation */}
                            {bitacoraObs && (
                                <div className="space-y-2">
                                    <Label className="text-slate-500 text-xs uppercase tracking-wider font-bold">Observación de Bitácora (Origen)</Label>
                                    <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900/20 text-sm text-blue-900 dark:text-blue-200 italic">
                                        "{bitacoraObs}"
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Disposition & Actions */}
                    {canManage && (
                        <Card className="rounded-[2rem] shadow-sm border-blue-200 dark:border-blue-900 bg-blue-50/10 overflow-hidden">
                            <CardHeader className="bg-gradient-to-r from-blue-50 to-transparent dark:from-blue-950/20 pb-4">
                                <CardTitle className="text-xl flex items-center gap-2 text-blue-800 dark:text-blue-300">
                                    <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                        <Beaker className="h-5 w-5" />
                                    </div>
                                    Gestión del estado y disposición final de cada NCR.
                                </CardTitle>
                                <CardDescription className="text-blue-400 dark:text-blue-300 ml-10 font-medium">
                                    Acciones correctivas/Disposición
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6 pt-6">
                                {/* 1. Estatus del NCR */}
                                <div className="space-y-2">
                                    <Label className="text-blue-900 dark:text-blue-200 font-semibold">Estatus del NCR</Label>
                                    <Select value={newStatus} onValueChange={setNewStatus}>
                                        <SelectTrigger className="bg-white dark:bg-slate-900 border-blue-200 dark:border-blue-800">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ABIERTO">Abierto</SelectItem>
                                            <SelectItem value="EN_MRB">En MRB (Investigación/Espera)</SelectItem>
                                            <SelectItem value="CERRADO">Cerrado</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* 2. Acciones Correctivas */}
                                <div className="space-y-2">
                                    <Label className="text-blue-900 dark:text-blue-200 font-semibold">Acciones Correctivas Realizadas</Label>
                                    <Textarea
                                        placeholder="Describa las acciones tomadas para corregir el problema..."
                                        value={correctiveActions}
                                        onChange={(e) => setCorrectiveActions(e.target.value)}
                                        className="min-h-[100px] bg-white dark:bg-slate-900 border-blue-200 dark:border-blue-800 resize-none"
                                    />
                                </div>

                                {/* 3. Notas Generales */}
                                <div className="space-y-2">
                                    <Label className="text-blue-900 dark:text-blue-200 font-semibold">Notas Generales / Instrucciones</Label>
                                    <Textarea
                                        placeholder="Notas adicionales..."
                                        value={dispNotes}
                                        onChange={(e) => setDispNotes(e.target.value)}
                                        className="bg-white dark:bg-slate-900 border-blue-200 dark:border-blue-800 resize-none"
                                    />
                                </div>

                                {/* 4. Tipo de Disposición */}
                                <div className="space-y-2">
                                    <Label className="text-blue-900 dark:text-blue-200 font-semibold">Tipo de Disposición</Label>
                                    <Select value={dispType} onValueChange={setDispType}>
                                        <SelectTrigger className="bg-white dark:bg-slate-900 border-blue-200 dark:border-blue-800">
                                            <SelectValue placeholder="Seleccionar acción..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="REPROCESO">Reproceso (Tipo A/B/C)</SelectItem>
                                            <SelectItem value="AJUSTE_FORMULA">Ajuste de fórmula / Corrección</SelectItem>
                                            <SelectItem value="REETIQUETADO_EMPAQUE">Re-etiquetado / Reproceso de empaque</SelectItem>
                                            <SelectItem value="HOLD_INVESTIGACION">Retención (Hold) por investigación</SelectItem>
                                            <SelectItem value="DOWNGRADE">Downgrade (Especificación alternativa)</SelectItem>
                                            <SelectItem value="SCRAP_DESTRUCCION">Scrap / Destrucción</SelectItem>
                                            <SelectItem value="DEVOLUCION">Devolución</SelectItem>
                                            <SelectItem value="CONCESION_USE_AS_IS">Concesión (Use As Is)</SelectItem>
                                            <SelectItem value="OTRA">Otra (Especificar)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {dispType === 'OTRA' && (
                                    <div className="space-y-2">
                                        <Label className="text-blue-900 dark:text-blue-200 font-semibold">Especificar Otra Disposición</Label>
                                        <Input
                                            value={dispositionCustom}
                                            onChange={(e) => setDispositionCustom(e.target.value)}
                                            placeholder="Detalle la disposición..."
                                            className="bg-white dark:bg-slate-900 border-blue-200"
                                        />
                                    </div>
                                )}

                                <div className="flex justify-end pt-2">
                                    <Button
                                        onClick={handleRegisterDisposition}
                                        disabled={submittingDisp}
                                        className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20 rounded-full px-8"
                                    >
                                        {submittingDisp ? 'Guardando...' : 'Guardar Acciones/Disposición'}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Sidebar - Comments (Right 1/3) */}
                <div className="space-y-6">
                    <Card className="rounded-[2rem] border-slate-200 dark:border-slate-800 h-[calc(100vh-12rem)] min-h-[500px] flex flex-col shadow-sm overflow-hidden sticky top-6">
                        <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 pb-4">
                            <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200">
                                <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
                                    <MessageSquare className="h-4 w-4" />
                                </div>
                                Comunicación
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30 dark:bg-slate-950/30">
                            {history.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                                    <MessageSquare className="h-8 w-8 opacity-20" />
                                    <p className="text-sm">No hay comentarios aún.</p>
                                </div>
                            ) : (
                                history.map((msg: any) => (
                                    <div key={msg.id} className={`flex flex-col ${msg.author === profile?.full_name ? 'items-end' : 'items-start'}`}>
                                        <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${msg.author === profile?.full_name
                                            ? 'bg-blue-600 text-white rounded-tr-sm'
                                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-tl-sm border border-slate-100 dark:border-slate-700'
                                            }`}>
                                            <p className={`font-bold text-[10px] mb-0.5 ${msg.author === profile?.full_name ? 'text-blue-100' : 'text-slate-400'}`}>
                                                {msg.author}
                                            </p>
                                            <p className="leading-relaxed">{msg.message}</p>
                                        </div>
                                        <span className="text-[10px] text-slate-400/70 mt-1 px-1">
                                            {format(new Date(msg.created_at), 'dd MMM HH:mm', { locale: es })}
                                        </span>
                                    </div>
                                ))
                            )}
                            <div ref={commentsEndRef} />
                        </CardContent>
                        <div className="p-3 border-t bg-white dark:bg-zinc-900">
                            <form
                                onSubmit={(e) => { e.preventDefault(); handleSubmitComment(); }}
                                className="flex gap-2 items-center"
                            >
                                <Input
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                    placeholder="Escribir comentario..."
                                    className="flex-1 text-sm rounded-full bg-slate-50 border-slate-200 focus:ring-0 focus:border-blue-400 transition-colors"
                                />
                                <Button
                                    type="submit"
                                    size="icon"
                                    disabled={submittingComment || !newComment.trim()}
                                    className="rounded-full h-10 w-10 shrink-0 bg-blue-600 hover:bg-blue-700"
                                >
                                    <Save className="h-4 w-4" />
                                </Button>
                            </form>
                        </div>
                    </Card>
                </div>
            </div>
        </div >
    )
}
