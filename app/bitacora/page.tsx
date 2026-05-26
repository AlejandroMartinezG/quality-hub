"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/AuthProvider"
import { Breadcrumbs } from "@/components/Breadcrumbs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select"
import {
    SUCURSALES,
    PRODUCT_CATEGORIES,
    CATEGORY_PRODUCTS,
    SUCURSAL_ACRONYMS,
    PRODUCT_STANDARDS,
    PH_STANDARDS,
    APPEARANCE_STANDARDS,
    PARAMETER_APPLICABILITY,
    PRODUCT_GROUPS
} from "@/lib/production-constants"

import { supabase } from "@/lib/supabase"
import { Loader2, Info, FlaskConical, Beaker, Eye, Droplets, ClipboardCheck, Plus, CheckCircle2, AlertTriangle, XCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { BitacoraSchema, validateForm, getFirstError } from "@/lib/validations"

type SessionRecord = {
    lote: string
    codigo: string
    estado: string
    tamano: string
    categoria: string
}

const EMPTY_FORM = {
    codigo_producto: "",
    tamano_lote: "",
    ph: "",
    solidos_medicion_1: "",
    temp_med1: "",
    solidos_medicion_2: "",
    temp_med2: "",
    viscosidad_seg: "",
    temperatura: "",
    color: "CONFORME",
    apariencia: "",
    aroma: "CONFORME",
    contaminacion_microbiologica: "SIN PRESENCIA",
    observaciones: ""
}

export default function BitacoraPage() {
    const { user, profile, loading: authLoading } = useAuth()
    const router = useRouter()

    useEffect(() => {
        if (!authLoading && profile) {
            const role = profile.role?.toLowerCase()
            const forbiddenRoles = ['gerente_sucursal', 'gerente', 'director_operaciones', 'mostrador', 'cajera', 'vendedor', 'director_compras']
            if (forbiddenRoles.includes(role)) {
                toast.error("Acceso restringido", {
                    description: "No tienes permisos para acceder al módulo de Bitácora."
                })
                router.push('/')
            }
        }
    }, [profile, authLoading, router])

    const [generalInfo, setGeneralInfo] = useState({
        sucursal: "",
        nombre_preparador: "",
        fecha_fabricacion: new Date().toISOString().split('T')[0],
    })

    useEffect(() => {
        if (profile) {
            setGeneralInfo(prev => ({
                ...prev,
                sucursal: profile.sucursal || "",
                nombre_preparador: profile.full_name || ""
            }))
        }
    }, [profile])

    const [sessionLog, setSessionLog] = useState<SessionRecord[]>([])
    const [hasOpenRecord, setHasOpenRecord] = useState(false)
    const [loading, setLoading] = useState(false)
    const [isFlexibleBatch, setIsFlexibleBatch] = useState(false)
    const [selectedFamilia, setSelectedFamilia] = useState<string | null>(null)
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
    const [formData, setFormData] = useState({ ...EMPTY_FORM })

    const resetRecord = () => {
        setSelectedFamilia(null)
        setSelectedCategory(null)
        setIsFlexibleBatch(false)
        setFormData({ ...EMPTY_FORM })
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target
        if (name === "ph") {
            if (value === "") { setFormData(prev => ({ ...prev, [name]: value })); return }
            if (/^\d*\.?\d*$/.test(value)) {
                const num = parseFloat(value)
                if (value === "." || (!isNaN(num) && num >= 0 && num <= 14)) {
                    setFormData(prev => ({ ...prev, [name]: value }))
                }
            }
            return
        }
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    const handleGeneralInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target
        setGeneralInfo(prev => ({ ...prev, [name]: value }))
    }

    const handleSelectChange = (name: string, value: string) => {
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    const calculateLotNumber = async (data: typeof formData & typeof generalInfo) => {
        if (!data.sucursal || !data.codigo_producto || !data.fecha_fabricacion) return ""
        const datePart = data.fecha_fabricacion.replace(/-/g, "").slice(2)
        const acronym = SUCURSAL_ACRONYMS[data.sucursal] || "NA"
        const productCode = data.codigo_producto
        const size = Math.round(parseFloat(data.tamano_lote)).toString()
        try {
            const { count, error } = await supabase
                .from('bitacora_produccion_calidad')
                .select('*', { count: 'exact', head: true })
                .eq('sucursal', data.sucursal)
                .eq('codigo_producto', productCode)
                .eq('fecha_fabricacion', data.fecha_fabricacion)
                .not('lote_producto', 'is', null)
                .neq('lote_producto', '')
                .neq('lote_producto', 'EMPTY')
            if (error) throw error
            const sequence = String((count || 0) + 1).padStart(2, "0")
            return `${datePart}-${acronym}-${productCode}${size}-${sequence}`
        } catch {
            return null
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        const combinedData = { ...generalInfo, ...formData }

        const validation = validateForm(BitacoraSchema, combinedData)
        if (!validation.success) {
            toast.error("Datos inválidos", { description: getFirstError(validation.errors) })
            return
        }

        const applicability = PARAMETER_APPLICABILITY[formData.codigo_producto] || { solidos: false, ph: false }

        if (applicability.solidos) {
            if (!formData.solidos_medicion_1 || !formData.temp_med1 || !formData.solidos_medicion_2 || !formData.temp_med2) {
                toast.error("Faltan mediciones de Sólidos", { description: "Para este producto, debes registrar M1, T1, M2 y T2." })
                return
            }
        }

        if (applicability.ph && !formData.ph) {
            toast.error("Falta medición de pH", { description: "Para este producto, el pH es obligatorio." })
            return
        }

        setLoading(true)

        try {
            const lotNumber = await calculateLotNumber(combinedData)
            if (!lotNumber) throw new Error("No se pudo generar el número de lote. Verifica los datos básicos.")

            if (!user?.id) {
                toast.error("Sesión no válida", { description: "No se detectó usuario autenticado. Recarga la página." })
                setLoading(false)
                return
            }

            const evaluations = evaluateRecord(combinedData)
            let estado_calidad = 'CONFORME'
            if (evaluations.some(e => e.status === 'error')) estado_calidad = 'NO CONFORME'
            else if (evaluations.some(e => e.status === 'warning')) estado_calidad = 'RETENER'

            const parseNum = (val: any) => { const n = parseFloat(val); return isNaN(n) ? null : n }

            const recordToInsert = {
                sucursal: generalInfo.sucursal,
                nombre_preparador: generalInfo.nombre_preparador,
                fecha_fabricacion: generalInfo.fecha_fabricacion,
                codigo_producto: formData.codigo_producto,
                lote_producto: lotNumber,
                familia_producto: selectedCategory,
                tamano_lote: parseNum(formData.tamano_lote) || 0,
                ph: parseNum(formData.ph),
                solidos_medicion_1: parseNum(formData.solidos_medicion_1),
                temp_med1: parseNum(formData.temp_med1),
                solidos_medicion_2: parseNum(formData.solidos_medicion_2),
                temp_med2: parseNum(formData.temp_med2),
                apariencia: formData.apariencia,
                color: formData.color,
                aroma: formData.aroma,
                user_id: user.id,
                estado_calidad: estado_calidad,
                observaciones: formData.observaciones,
                observaciones_calidad: evaluations
                    .filter(e => e.status !== 'success')
                    .map(e => `${e.type}: ${e.text}`)
                    .join('. ')
            }

            const { data: insertedRecord, error: insertError } = await supabase
                .from('bitacora_produccion_calidad')
                .insert([recordToInsert])
                .select()
                .single()

            if (insertError) throw insertError

            if (estado_calidad === 'NO CONFORME' && insertedRecord) {
                const failedParams = evaluations.filter(e => e.status === 'error').map(e => e.type).join(', ')
                const { error: ncrError } = await supabase.from('quality_ncr').insert({
                    measurement_id: insertedRecord.id,
                    batch_code: lotNumber,
                    sucursal: generalInfo.sucursal,
                    product_id: formData.codigo_producto,
                    preparer_user_id: user?.id ?? null,
                    nombre_preparador: generalInfo.nombre_preparador,
                    defect_parameter: failedParams,
                    severity: 'MAYOR',
                    defect_detail: recordToInsert.observaciones_calidad,
                    liters_involved: parseNum(formData.tamano_lote) || 0,
                    status: 'ABIERTO',
                    author_user_id: user.id
                })
                if (ncrError) console.error('Error creating auto NCR:', ncrError.message)
            }

            setSessionLog(prev => [...prev, {
                lote: lotNumber,
                codigo: formData.codigo_producto,
                estado: estado_calidad,
                tamano: formData.tamano_lote,
                categoria: selectedCategory || ""
            }])

            if (estado_calidad === 'NO CONFORME') {
                toast.error('⚠️ Producto No Conforme — NCR Abierto', {
                    description: `Lote ${lotNumber} requiere revisión inmediata. Se abrió un caso NCR automáticamente.`,
                    duration: 8000,
                })
            } else if (estado_calidad === 'RETENER') {
                toast.warning('⚠️ Producto en Tolerancia (Retener)', {
                    description: `Lote ${lotNumber} liberable con precaución.`,
                    duration: 6000
                })
            } else {
                toast.success('✅ Producto Conforme', {
                    description: `Lote ${lotNumber} registrado exitosamente.`,
                    duration: 4000
                })
            }

            resetRecord()
            setHasOpenRecord(false)

        } catch (error: any) {
            console.error("Submission error:", error)
            toast.error("Error al guardar el registro", {
                description: error.message || "Ocurrió un problema al guardar. Intenta de nuevo."
            })
        } finally {
            setLoading(false)
        }
    }

    const selectedGroup = PRODUCT_GROUPS.find(g => g.title === selectedFamilia)
    const availableCategories = selectedGroup
        ? PRODUCT_CATEGORIES.filter(c => selectedGroup.ids.includes(c.id))
        : []
    const isPieceFamily = selectedCategory?.toLowerCase().includes("aromatizante") || selectedCategory?.toLowerCase().includes("limpiadores")

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-12">
            <Breadcrumbs items={[{ label: "Bitácora de Producción" }]} />

            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-[#0e0c9b] to-[#c41f1a] bg-clip-text text-transparent">
                    Bitácora de Producción y Calidad
                </h1>
                <p className="text-muted-foreground">
                    Registro de parámetros de calidad para productos terminados Ginez®
                </p>
            </div>

            {/* Kit de Medición */}
            <Card className="border-primary/5 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800/50 rounded-[2rem]">
                <CardHeader className="pb-2">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <FlaskConical className="h-4 w-4" />
                        <h3 className="font-semibold text-sm uppercase tracking-wide">Kit de medición de parámetros</h3>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 max-w-xl">
                        Antes de iniciar el registro, asegúrate de contar con estos equipos. Son indispensables para obtener lecturas precisas de pH y % Sólidos en cada lote.
                    </p>
                </CardHeader>
                <CardContent className="flex justify-center gap-12 pb-6">
                    <div className="flex flex-col items-center group cursor-help transition-transform hover:scale-105">
                        <img src="/images/tiras-ph.jpeg" alt="Tiras de pH" className="h-24 w-auto rounded-xl shadow-md mb-3 group-hover:shadow-lg transition-shadow" />
                        <Badge variant="secondary" className="font-bold text-[10px]">TIRAS pH</Badge>
                    </div>
                    <div className="flex flex-col items-center group cursor-help transition-transform hover:scale-105">
                        <img src="/images/refractometro.png" alt="Refractómetro" className="h-24 w-auto rounded-xl shadow-md mb-3 group-hover:shadow-lg transition-shadow" />
                        <Badge variant="secondary" className="font-bold text-[10px]">REFRACTÓMETRO</Badge>
                    </div>
                </CardContent>
            </Card>

            {/* Información General */}
            <Card className="border-primary/10 shadow-lg overflow-hidden rounded-[2rem]">
                <CardHeader className="bg-gradient-to-r from-[#0e0c9b] to-[#2a28b5] border-b border-blue-900">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/10 rounded-xl text-white backdrop-blur-sm">
                            <Info className="h-5 w-5" />
                        </div>
                        <div>
                            <CardTitle className="text-white">Información General</CardTitle>
                            <CardDescription className="text-blue-200">Aplica a todos los registros de esta sesión</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
                    <div className="space-y-2">
                        <Label htmlFor="sucursal">Sucursal</Label>
                        <Select
                            value={generalInfo.sucursal}
                            onValueChange={(val) => setGeneralInfo(prev => ({ ...prev, sucursal: val }))}
                        >
                            <SelectTrigger id="sucursal" className={cn("rounded-full", !generalInfo.sucursal ? "border-red-500" : "")}>
                                <SelectValue placeholder="Selecciona sucursal" />
                            </SelectTrigger>
                            <SelectContent>
                                {SUCURSALES.map((suc) => (
                                    <SelectItem key={suc} value={suc}>{suc}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="nombre_preparador">Preparador</Label>
                        <Input
                            id="nombre_preparador"
                            name="nombre_preparador"
                            value={generalInfo.nombre_preparador}
                            onChange={handleGeneralInputChange}
                            className={cn("rounded-full", !generalInfo.nombre_preparador ? "border-red-500" : "font-semibold")}
                            placeholder="Nombre del preparador"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="fecha_fabricacion">Fecha de Elaboración</Label>
                        <Input
                            id="fecha_fabricacion"
                            name="fecha_fabricacion"
                            type="date"
                            value={generalInfo.fecha_fabricacion}
                            onChange={handleGeneralInputChange}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Session Log */}
            <AnimatePresence>
                {sessionLog.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-2"
                    >
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1">
                            Registros de esta sesión ({sessionLog.length})
                        </h3>
                        {sessionLog.map((rec, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className={cn(
                                    "flex items-center justify-between px-4 py-3 rounded-2xl border text-sm",
                                    rec.estado === 'CONFORME' && "bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-800/30",
                                    rec.estado === 'RETENER' && "bg-yellow-50 border-yellow-200 dark:bg-yellow-900/10 dark:border-yellow-800/30",
                                    rec.estado === 'NO CONFORME' && "bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-800/30",
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    {rec.estado === 'CONFORME' && <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />}
                                    {rec.estado === 'RETENER' && <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0" />}
                                    {rec.estado === 'NO CONFORME' && <XCircle className="h-4 w-4 text-red-600 shrink-0" />}
                                    <span className="font-mono font-semibold text-xs">{rec.lote}</span>
                                    <span className="text-muted-foreground hidden sm:inline">·</span>
                                    <span className="text-muted-foreground text-xs hidden sm:inline">{rec.categoria}</span>
                                </div>
                                <Badge
                                    variant={rec.estado === 'CONFORME' ? 'default' : rec.estado === 'RETENER' ? 'outline' : 'destructive'}
                                    className="text-[10px] shrink-0"
                                >
                                    {rec.estado === 'RETENER' ? 'SEMI-CONFORME' : rec.estado}
                                </Badge>
                            </motion.div>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Open Record Form */}
            <AnimatePresence>
                {hasOpenRecord && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                    >
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <Card className="border-primary/10 shadow-lg overflow-hidden rounded-[2rem]">
                                <CardHeader className="bg-gradient-to-r from-slate-700 to-slate-800 border-b border-slate-700">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-white/10 rounded-xl text-white backdrop-blur-sm">
                                            <FlaskConical className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-white">Nuevo Registro</CardTitle>
                                            <CardDescription className="text-slate-300">Selecciona el producto y captura los parámetros</CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-6 pt-6">

                                    {/* Cascading Selects */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="space-y-2">
                                            <Label>Familia de Producto</Label>
                                            <Select
                                                value={selectedFamilia || ""}
                                                onValueChange={(val) => {
                                                    setSelectedFamilia(val)
                                                    setSelectedCategory(null)
                                                    setFormData(prev => ({ ...prev, codigo_producto: "", tamano_lote: "" }))
                                                    setIsFlexibleBatch(false)
                                                }}
                                            >
                                                <SelectTrigger className="rounded-full">
                                                    <SelectValue placeholder="Selecciona familia" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {PRODUCT_GROUPS.map(g => (
                                                        <SelectItem key={g.title} value={g.title}>{g.title}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Categoría</Label>
                                            <Select
                                                value={selectedCategory || ""}
                                                onValueChange={(val) => {
                                                    setSelectedCategory(val)
                                                    setFormData(prev => ({ ...prev, codigo_producto: "", tamano_lote: "" }))
                                                    setIsFlexibleBatch(false)
                                                }}
                                                disabled={!selectedFamilia}
                                            >
                                                <SelectTrigger className="rounded-full">
                                                    <SelectValue placeholder={selectedFamilia ? "Selecciona categoría" : "Primero elige familia"} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {availableCategories.map(cat => (
                                                        <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Código del Producto</Label>
                                            {selectedCategory === "Producto especial" ? (
                                                <Input
                                                    type="text"
                                                    placeholder="Ej: ESPECIAL"
                                                    value={formData.codigo_producto}
                                                    maxLength={8}
                                                    onChange={(e) => {
                                                        const rawVal = e.target.value.toUpperCase();
                                                        const cleanVal = rawVal.replace(/[^A-Z0-9-]/g, "").slice(0, 8);
                                                        handleSelectChange("codigo_producto", cleanVal);
                                                    }}
                                                    className={cn("rounded-full", !formData.codigo_producto ? "border-red-500" : "font-bold")}
                                                />
                                            ) : (
                                                <Select
                                                    value={formData.codigo_producto}
                                                    onValueChange={(val) => handleSelectChange("codigo_producto", val)}
                                                    disabled={!selectedCategory}
                                                >
                                                    <SelectTrigger className={cn("rounded-full", selectedCategory && !formData.codigo_producto ? "border-red-500" : "")}>
                                                        <SelectValue placeholder={selectedCategory ? "Selecciona código" : "Primero elige categoría"} />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {(CATEGORY_PRODUCTS[selectedCategory || ""] || []).map((code) => (
                                                            <SelectItem key={code} value={code}>{code}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        </div>
                                    </div>

                                    {/* Tamaño de Lote */}
                                    <div className="space-y-2 max-w-xs">
                                        <Label>
                                            Tamaño de Lote ({isPieceFamily ? "Piezas" : "Litros"})
                                        </Label>
                                        <Select
                                            value={isFlexibleBatch ? "Flexible" : (["2", "5", "10", "15", "20", "50", "100", "200", "1000"].includes(formData.tamano_lote) ? formData.tamano_lote : (formData.tamano_lote ? "Flexible" : ""))}
                                            onValueChange={(val) => {
                                                if (val === "Flexible") {
                                                    setIsFlexibleBatch(true)
                                                    setFormData(prev => ({ ...prev, tamano_lote: "" }))
                                                } else {
                                                    setIsFlexibleBatch(false)
                                                    setFormData(prev => ({ ...prev, tamano_lote: val }))
                                                }
                                            }}
                                            disabled={!formData.codigo_producto}
                                        >
                                            <SelectTrigger className={cn("rounded-full", formData.codigo_producto && !formData.tamano_lote && !isFlexibleBatch ? "border-red-500" : "")}>
                                                <SelectValue placeholder="Selecciona tamaño" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {selectedCategory?.toLowerCase().includes("bases") && (
                                                    <>
                                                        <SelectItem value="2">2</SelectItem>
                                                        <SelectItem value="5">5</SelectItem>
                                                        <SelectItem value="10">10</SelectItem>
                                                        <SelectItem value="15">15</SelectItem>
                                                    </>
                                                )}
                                                <SelectItem value="20">20</SelectItem>
                                                <SelectItem value="50">50</SelectItem>
                                                <SelectItem value="100">100</SelectItem>
                                                <SelectItem value="200">200</SelectItem>
                                                <SelectItem value="1000">1000</SelectItem>
                                                <SelectItem value="Flexible">Flexible (Manual)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        {isFlexibleBatch && (
                                            <Input
                                                name="tamano_lote"
                                                type="number"
                                                step="0.1"
                                                placeholder={isPieceFamily ? "Ej: 500" : "Ej: 150"}
                                                value={formData.tamano_lote}
                                                onChange={handleInputChange}
                                                className={cn("rounded-full mt-2", !formData.tamano_lote ? "border-red-500" : "")}
                                            />
                                        )}
                                    </div>

                                    {/* Parámetros Físico-Químicos */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        {/* Sólidos */}
                                        <div className="space-y-4 p-6 rounded-[2rem] bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/20">
                                            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-bold mb-2">
                                                <Beaker className="h-5 w-5" />
                                                % Sólidos (Brix)
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label>% Sólidos - M1</Label>
                                                    <Input name="solidos_medicion_1" type="number" step="0.01" value={formData.solidos_medicion_1} onChange={handleInputChange} disabled={!PARAMETER_APPLICABILITY[formData.codigo_producto]?.solidos} className="bg-white/50 dark:bg-slate-900/50 rounded-full" />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Temp - M1 (°C)</Label>
                                                    <Input name="temp_med1" type="number" step="0.1" value={formData.temp_med1} onChange={handleInputChange} disabled={!PARAMETER_APPLICABILITY[formData.codigo_producto]?.solidos} className="bg-white/50 dark:bg-slate-900/50 rounded-full" />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>% Sólidos - M2</Label>
                                                    <Input name="solidos_medicion_2" type="number" step="0.01" value={formData.solidos_medicion_2} onChange={handleInputChange} disabled={!PARAMETER_APPLICABILITY[formData.codigo_producto]?.solidos} className="bg-white/50 dark:bg-slate-900/50 rounded-full" />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Temp - M2 (°C)</Label>
                                                    <Input name="temp_med2" type="number" step="0.1" value={formData.temp_med2} onChange={handleInputChange} disabled={!PARAMETER_APPLICABILITY[formData.codigo_producto]?.solidos} className="bg-white/50 dark:bg-slate-900/50 rounded-full" />
                                                </div>
                                            </div>
                                            <div className="p-3 bg-white/50 dark:bg-slate-900/50 rounded-lg border text-[11px] text-muted-foreground italic leading-tight">
                                                Usar refractómetro digital de acuerdo a IO-DOP-OP-002
                                            </div>
                                        </div>

                                        {/* pH */}
                                        <div className="space-y-4 p-6 rounded-[2rem] bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-800/20">
                                            <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-bold mb-2">
                                                <Droplets className="h-5 w-5" />
                                                Valor de pH
                                            </div>
                                            <div className="space-y-4">
                                                <div className="space-y-2">
                                                    <Label>Valor medido de pH</Label>
                                                    <Input name="ph" type="number" min="0" max="14" step="1" placeholder="Ej: 7" value={formData.ph} onChange={handleInputChange} disabled={!PARAMETER_APPLICABILITY[formData.codigo_producto]?.ph} className="bg-white/50 dark:bg-slate-900/50 font-bold text-lg rounded-full" />
                                                </div>
                                                <div className="p-3 bg-white/50 dark:bg-slate-900/50 rounded-lg border text-[11px] text-muted-foreground italic leading-tight">
                                                    Usar tiras reactivas de acuerdo a IO-DOP-OP-001
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Mediciones Adicionales */}
                                    <div className="pt-4 border-t border-dashed space-y-6">
                                        <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-bold">
                                            <Droplets className="h-5 w-5" />
                                            Mediciones Adicionales
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <div className="space-y-2">
                                                <Label className="flex items-center gap-2">
                                                    <Eye className="h-4 w-4" /> Apariencia
                                                </Label>
                                                <Select value={formData.apariencia} onValueChange={(val) => handleSelectChange("apariencia", val)}>
                                                    <SelectTrigger className="rounded-full"><SelectValue placeholder="Selecciona" /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="CRISTALINO">CRISTALINO</SelectItem>
                                                        <SelectItem value="OPACO">OPACO</SelectItem>
                                                        <SelectItem value="APERLADO">APERLADO</SelectItem>
                                                        <SelectItem value="TURBIO">TURBIO</SelectItem>
                                                        <SelectItem value="PARTICULAS SUSPENDIDAS">PARTICULAS SUSPENDIDAS</SelectItem>
                                                        <SelectItem value="SEPARACION DE COMPONENTES">SEPARACION DE COMPONENTES</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Color</Label>
                                                <Select value={formData.color} onValueChange={(val) => handleSelectChange("color", val)}>
                                                    <SelectTrigger className="rounded-full"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="CONFORME">CONFORME</SelectItem>
                                                        <SelectItem value="NO CONFORME">NO CONFORME</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Aroma</Label>
                                                <Select value={formData.aroma} onValueChange={(val) => handleSelectChange("aroma", val)}>
                                                    <SelectTrigger className="rounded-full"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="CONFORME">CONFORME</SelectItem>
                                                        <SelectItem value="NO CONFORME">NO CONFORME</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="observaciones">Observaciones adicionales</Label>
                                        <Textarea id="observaciones" name="observaciones" placeholder="Cualquier desviación o nota relevante..." value={formData.observaciones} onChange={handleInputChange} className="min-h-[100px] rounded-[1.5rem]" />
                                    </div>
                                </CardContent>
                                <CardFooter className="bg-muted/30 border-t py-4">
                                    <Button
                                        type="submit"
                                        className="w-full md:w-auto md:min-w-[200px] h-12 text-lg font-bold gap-2 rounded-full"
                                        disabled={loading || !formData.codigo_producto}
                                    >
                                        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ClipboardCheck className="h-5 w-5" />}
                                        Guardar Registro
                                    </Button>
                                </CardFooter>
                            </Card>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Add Record Button */}
            <div className="flex flex-col items-center gap-2 pt-2">
                <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="gap-2 rounded-full border-dashed border-2 h-14 px-8 text-base font-semibold"
                    onClick={() => setHasOpenRecord(true)}
                    disabled={hasOpenRecord}
                >
                    <Plus className="h-5 w-5" />
                    {sessionLog.length === 0 ? "Agregar registro" : "Agregar otro registro"}
                </Button>
                {hasOpenRecord && (
                    <p className="text-xs text-muted-foreground">
                        Guarda el registro actual antes de agregar uno nuevo
                    </p>
                )}
            </div>
        </div>
    )
}

function evaluateRecord(formData: any) {
    const product = formData.codigo_producto
    const applicability = PARAMETER_APPLICABILITY[product] || { solidos: false, ph: false }
    const evaluations = []

    if (applicability.solidos) {
        const s1 = parseFloat(formData.solidos_medicion_1)
        const s2 = parseFloat(formData.solidos_medicion_2)
        const avg = (!isNaN(s1) && !isNaN(s2)) ? (s1 + s2) / 2 : null
        const standard = PRODUCT_STANDARDS[product]
        if (avg !== null && standard) {
            const min = standard.min || 0
            const max = standard.max || 0
            const minTol = min * 0.95
            const maxTol = max * 1.05
            if (avg >= min && avg <= max) {
                evaluations.push({ type: "Sólidos", status: "success", text: `Conforme (${avg.toFixed(2)}%)` })
            } else if (avg >= minTol && avg <= maxTol) {
                evaluations.push({ type: "Sólidos", status: "warning", text: `En tolerancia (${avg.toFixed(2)}%) [Std: ${min}-${max} | Tol (+/- 5%): ${minTol.toFixed(2)}-${maxTol.toFixed(2)}] - Liberable` })
            } else {
                evaluations.push({ type: "Sólidos", status: "error", text: `Fuera de rango (${avg.toFixed(2)}%) [Std: ${min}-${max} | Tol (+/- 5%): ${minTol.toFixed(2)}-${maxTol.toFixed(2)}] - Retener` })
            }
        }
    }

    if (applicability.ph) {
        const phVal = parseFloat(formData.ph)
        const standard = PH_STANDARDS[product]
        if (!isNaN(phVal) && standard) {
            if (phVal >= standard.min && phVal <= standard.max) {
                evaluations.push({ type: "pH", status: "success", text: `Conforme (${phVal})` })
            } else {
                evaluations.push({ type: "pH", status: "error", text: `Fuera de rango (${phVal}) [Std: ${standard.min}-${standard.max}]` })
            }
        }
    }

    if (formData.apariencia) {
        const expected = APPEARANCE_STANDARDS[product]
        if (expected) {
            if (formData.apariencia.toUpperCase() === expected.toUpperCase()) {
                evaluations.push({ type: "Apariencia", status: "success", text: `Conforme (${formData.apariencia})` })
            } else {
                evaluations.push({ type: "Apariencia", status: "error", text: `Fuera de especificación (${formData.apariencia}) [Esperado: ${expected}]` })
            }
        }
    }

    if (formData.color === 'NO CONFORME') evaluations.push({ type: "Color", status: "error", text: "No Conforme" })
    if (formData.aroma === 'NO CONFORME') evaluations.push({ type: "Aroma", status: "error", text: "No Conforme" })

    return evaluations
}
