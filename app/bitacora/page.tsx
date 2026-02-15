"use client"

import { useState, useEffect } from "react"
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
import { Loader2, CheckCircle2, AlertCircle, Info, FlaskConical, Beaker, Eye, Droplets, ClipboardCheck, ArrowRight, ArrowLeft, ChevronDown, WashingMachine, Home, Sparkles, Car, ShieldCheck, Factory, Wind, FlaskRound, SprayCan, Star, Waves, Feather, Flower2, Hand, Droplet, Smile, Package, Shield } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { BitacoraSchema, validateForm, getFirstError } from "@/lib/validations"
import { sanitizeFormData } from "@/lib/sanitize"

export default function BitacoraPage() {
    const { user, profile } = useAuth()
    const [step, setStep] = useState(1) // 1: Category, 2: Form
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
    const [expandedGroups, setExpandedGroups] = useState<string[]>([])
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        sucursal: "",
        nombre_preparador: "",
        fecha_fabricacion: new Date().toISOString().split('T')[0],
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
    })

    useEffect(() => {
        if (profile) {
            setFormData(prev => ({
                ...prev,
                sucursal: profile.sucursal || "",
                nombre_preparador: profile.full_name || ""
            }))
        }
    }, [profile])

    const handleCategorySelect = (categoryId: string) => {
        const category = PRODUCT_CATEGORIES.find(c => c.id === categoryId)
        if (category) {
            setSelectedCategory(category.name)
            setStep(2)
        }
    }

    const toggleGroup = (title: string) => {
        setExpandedGroups(prev =>
            prev.includes(title)
                ? prev.filter(t => t !== title)
                : [...prev, title]
        )
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target

        // pH validation: only integers 0-14
        if (name === "ph") {
            // Allow empty string for clearing
            if (value === "") {
                setFormData(prev => ({ ...prev, [name]: value }))
                return
            }

            const numValue = parseInt(value)
            // Only accept integers between 0-14
            if (!isNaN(numValue) && numValue >= 0 && numValue <= 14 && value === numValue.toString()) {
                setFormData(prev => ({ ...prev, [name]: value }))
            }
            return
        }

        setFormData(prev => ({ ...prev, [name]: value }))
    }

    const handleSelectChange = (name: string, value: string) => {
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    const calculateLotNumber = async (data: typeof formData) => {
        if (!data.sucursal || !data.codigo_producto || !data.fecha_fabricacion) return ""

        const datePart = data.fecha_fabricacion.replace(/-/g, "").slice(2) // YYMMDD
        const acronym = SUCURSAL_ACRONYMS[data.sucursal] || "NA"
        const productCode = data.codigo_producto
        const size = Math.round(parseFloat(data.tamano_lote)).toString()

        // Count existing records
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
        } catch (err) {
            console.error("calculateLotNumber error")
            return null
        }
    }

    // ... inside component ...
    const getEvaluation = () => evaluateRecord(formData)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        // Zod schema validation
        const validation = validateForm(BitacoraSchema, formData)
        if (!validation.success) {
            toast.error("Datos inválidos", {
                description: getFirstError(validation.errors)
            })
            return
        }

        // Applicability checks
        const applicability = PARAMETER_APPLICABILITY[formData.codigo_producto] || { solidos: false, ph: false }

        // Solids validation
        if (applicability.solidos) {
            if (!formData.solidos_medicion_1 || !formData.temp_med1 || !formData.solidos_medicion_2 || !formData.temp_med2) {
                toast.error("Faltan mediciones de Sólidos", {
                    description: "Para este producto, debes registrar M1, T1, M2 y T2."
                })
                return
            }
        }

        // pH validation
        if (applicability.ph) {
            if (!formData.ph) {
                toast.error("Falta medición de pH", {
                    description: "Para este producto, el pH es obligatorio."
                })
                return
            }
        }

        setLoading(true)

        try {
            const lotNumber = await calculateLotNumber(formData)

            if (!lotNumber) {
                throw new Error("No se pudo generar el número de lote. Verifica los datos básicos.")
            }

            if (!user?.id) {
                toast.error("Sesión no válida", { description: "No se detectó usuario autenticado. Recarga la página." })
                setLoading(false)
                return
            }

            // Determine Quality Status
            const evaluations = evaluateRecord(formData)
            let estado_calidad = 'CONFORME'

            if (evaluations.some(e => e.status === 'error')) {
                estado_calidad = 'NO CONFORME'
            } else if (evaluations.some(e => e.status === 'warning')) {
                estado_calidad = 'RETENER'
            }

            const { error: insertError } = await supabase
                .from('bitacora_produccion_calidad')
                .insert([{
                    ...sanitizeFormData(formData, ['observaciones']),
                    user_id: user.id,
                    lote_producto: lotNumber,
                    familia_producto: selectedCategory,
                    tamano_lote: parseFloat(formData.tamano_lote) || 0,
                    ph: parseFloat(formData.ph) || null,
                    solidos_medicion_1: parseFloat(formData.solidos_medicion_1) || null,
                    temp_med1: parseFloat(formData.temp_med1) || null,
                    solidos_medicion_2: parseFloat(formData.solidos_medicion_2) || null,
                    temp_med2: parseFloat(formData.temp_med2) || null,
                    viscosidad_seg: null,
                    temperatura: null,
                    contaminacion_microbiologica: "SIN PRESENCIA",
                    estado_calidad: estado_calidad // Insert status
                }])

            if (insertError) throw insertError

            // Custom Toast based on Status
            if (estado_calidad === 'NO CONFORME') {
                toast.error('⚠️ Producto No Conforme', {
                    description: `Lote ${lotNumber} requiere revisión inmediata.`,
                    duration: 8000,
                    action: { label: 'Ver detalles', onClick: () => window.location.href = "/calidad" }
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

            setStep(1)
            setFormData(prev => ({
                ...prev,
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
            }))
        } catch (error: any) {
            console.error(error)
            toast.error("Error al guardar el registro", {
                description: "Ocurrió un problema al guardar. Intenta de nuevo."
            })
        } finally {
            setLoading(false)
        }
    }


    // Iconos por categoría (Matching Catalog style)
    const CATEGORY_ICONS: Record<string, any> = {
        "aro-amb": Wind,
        "antibac": Shield,
        "bs-aro-amb": FlaskRound,
        "bs-lim-mult": FlaskConical,
        "crem-corp": Smile,
        "det-trastes": Droplets,
        "det-ropa": Waves,
        "enj-cap": Waves,
        "esp-hogar": Star,
        "esp-lavand": Star,
        "jab-manos": Hand,
        "automotriz": Car,
        "lim-mult": SprayCan,
        "prod-interm": Factory,
        "refaro": Flower2,
        "shampoo": Droplet,
        "suavizante": Feather,
        "especial": Star,
        "disoluciones": FlaskConical
    }

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

            <AnimatePresence mode="wait">
                {step === 1 ? (

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="space-y-8"
                    >
                        <div className="space-y-6">
                            {/* Accordion Groups */}
                            {PRODUCT_GROUPS.map((group) => {
                                const isExpanded = expandedGroups.includes(group.title)
                                const groupCategories = PRODUCT_CATEGORIES.filter(c => group.ids.includes(c.id))

                                // Skip empty groups
                                if (groupCategories.length === 0) return null

                                return (
                                    <Card key={group.title} className="border-none shadow-sm bg-white/50 dark:bg-slate-900/50 overflow-hidden rounded-[2.5rem]">
                                        <div
                                            onClick={() => toggleGroup(group.title)}
                                            className={cn(
                                                "w-full flex items-center justify-between p-4 cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 select-none",
                                                isExpanded && "bg-slate-50 dark:bg-slate-800/50"
                                            )}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={cn("p-3 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700")}>
                                                    {(() => {
                                                        const iconProps = { className: cn("h-6 w-6", group.color.split(" ")[0]) }
                                                        switch (group.title) {
                                                            case "Cuidado del Hogar": return <Home {...iconProps} />
                                                            case "Cuidado Personal": return <Sparkles {...iconProps} />
                                                            case "Lavandería": return <WashingMachine {...iconProps} />
                                                            case "Línea Automotriz": return <Car {...iconProps} />
                                                            case "Línea Antibacterial": return <ShieldCheck {...iconProps} />
                                                            case "Productos Intermedios": return <Factory {...iconProps} />
                                                            default: return <span className="text-2xl">{group.icon}</span>
                                                        }
                                                    })()}
                                                </div>
                                                <div className="flex flex-col gap-0.5">
                                                    <h3 className={cn("text-lg font-bold", group.color)}>
                                                        {group.title}
                                                    </h3>
                                                    <span className="text-xs text-muted-foreground ml-0.5">
                                                        {groupCategories.length} {groupCategories.length === 1 ? 'Categoría' : 'Categorías'}
                                                    </span>
                                                </div>
                                            </div>
                                            <motion.div
                                                animate={{ rotate: isExpanded ? 180 : 0 }}
                                                transition={{ duration: 0.2 }}
                                            >
                                                <ChevronDown className="h-5 w-5 text-muted-foreground" />
                                            </motion.div>
                                        </div>

                                        <AnimatePresence>
                                            {isExpanded && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: "auto", opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.3, ease: "easeInOut" }}
                                                >
                                                    <div className="p-4 pt-0 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 border-t border-slate-100 dark:border-slate-800 mt-2">
                                                        {groupCategories.map((cat) => {
                                                            const Icon = CATEGORY_ICONS[cat.id] || Package
                                                            return (
                                                                <Card
                                                                    key={cat.id}
                                                                    className="group cursor-pointer hover:shadow-xl hover:border-primary/50 transition-all duration-300 overflow-hidden bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-[2rem]"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        handleCategorySelect(cat.id)
                                                                    }}
                                                                >
                                                                    <CardContent className="p-4 flex flex-col items-center text-center gap-3">
                                                                        <div className={cn(
                                                                            "h-16 w-16 rounded-full flex items-center justify-center mb-1 shadow-sm border transition-transform duration-300 group-hover:scale-110",
                                                                            selectedCategory === cat.name ? "bg-white border-blue-200" : "bg-slate-50 border-slate-100 dark:bg-slate-800 dark:border-slate-700"
                                                                        )}>
                                                                            <Icon className={cn(
                                                                                "h-8 w-8",
                                                                                group.color.split(" ")[0] // Use group color for icon
                                                                            )} />
                                                                        </div>
                                                                        <CardTitle className="text-xs font-bold uppercase tracking-wide line-clamp-2 min-h-[2.5rem] flex items-center justify-center">
                                                                            {cat.name}
                                                                        </CardTitle>
                                                                    </CardContent>
                                                                </Card>
                                                            )
                                                        })}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </Card>
                                )
                            })}
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -50 }}
                        className="space-y-6"
                    >
                        <Button
                            variant="ghost"
                            onClick={() => setStep(1)}
                            className="mb-2 group hover:text-primary transition-colors"
                        >
                            <ArrowLeft className="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                            Cambiar Categoría ({selectedCategory})
                        </Button>

                        <form onSubmit={handleSubmit} className="space-y-8">
                            <Card className="border-primary/5 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800/50 rounded-[2rem]">
                                <CardHeader className="pb-2">
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <FlaskConical className="h-4 w-4" />
                                        <h3 className="font-semibold text-sm uppercase tracking-wide">Kit de medición de parametros</h3>
                                    </div>
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
                                            <CardDescription className="text-blue-200">Datos básicos del lote y sucursal</CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="sucursal">Sucursal</Label>
                                        <Select
                                            value={formData.sucursal}
                                            onValueChange={(val) => handleSelectChange("sucursal", val)}
                                            required
                                        >
                                            <SelectTrigger id="sucursal" className={cn("rounded-full", !formData.sucursal ? "border-red-500" : "")}>
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
                                            value={formData.nombre_preparador}
                                            onChange={handleInputChange}
                                            required
                                            className={cn("rounded-full", !formData.nombre_preparador ? "border-red-500" : "font-semibold")}
                                            placeholder="Nombre del preparador"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="fecha_fabricacion">Fecha de Elaboración</Label>
                                        <Input
                                            id="fecha_fabricacion"
                                            name="fecha_fabricacion"
                                            type="date"
                                            value={formData.fecha_fabricacion}
                                            onChange={handleInputChange}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="codigo_producto">Código del Producto</Label>
                                        <Select
                                            value={formData.codigo_producto}
                                            onValueChange={(val) => handleSelectChange("codigo_producto", val)}
                                            required
                                        >
                                            <SelectTrigger id="codigo_producto" className={cn("rounded-full", !formData.codigo_producto ? "border-red-500" : "")}>
                                                <SelectValue placeholder="Selecciona el producto" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {(CATEGORY_PRODUCTS[selectedCategory || ""] || []).map((code) => (
                                                    <SelectItem key={code} value={code}>{code}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="tamano_lote">
                                            Tamaño de Lote ({selectedCategory?.includes("aromatizante") || selectedCategory?.includes("limpiadores") ? "Piezas" : "Litros"})
                                        </Label>
                                        <Input
                                            id="tamano_lote"
                                            name="tamano_lote"
                                            type="number"
                                            step="0.1"
                                            placeholder={selectedCategory?.includes("aromatizante") || selectedCategory?.includes("limpiadores") ? "Ej: 500" : "Ej: 100"}
                                            value={formData.tamano_lote}
                                            onChange={handleInputChange}
                                            required
                                            className={cn("rounded-full", !formData.tamano_lote ? "border-red-500" : "")}
                                        />
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Parámetros de Calidad */}
                            <Card className="border-primary/10 shadow-lg overflow-hidden rounded-[2rem]">
                                <CardHeader className="bg-gradient-to-r from-[#0e0c9b] to-[#2a28b5] border-b border-blue-900">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-white/10 rounded-xl text-white backdrop-blur-sm">
                                            <FlaskConical className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-white">Parámetros Físico-Químicos</CardTitle>
                                            <CardDescription className="text-blue-200">Mediciones de los distintos parámetros de calidad internos.</CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-8 pt-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        {/* Sólidos Column */}
                                        <div className="space-y-4 p-6 rounded-[2rem] bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/20">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-bold">
                                                    <Beaker className="h-5 w-5" />
                                                    % Sólidos (Brix)
                                                </div>
                                                {/* Badge removed */}
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label>% Sólidos - M1</Label>
                                                    <Input
                                                        name="solidos_medicion_1"
                                                        type="number"
                                                        step="0.01"
                                                        value={formData.solidos_medicion_1}
                                                        onChange={handleInputChange}
                                                        disabled={!PARAMETER_APPLICABILITY[formData.codigo_producto]?.solidos}
                                                        className="bg-white/50 dark:bg-slate-900/50 rounded-full"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Temp - M1 (°C)</Label>
                                                    <Input
                                                        name="temp_med1"
                                                        type="number"
                                                        step="0.1"
                                                        value={formData.temp_med1}
                                                        onChange={handleInputChange}
                                                        disabled={!PARAMETER_APPLICABILITY[formData.codigo_producto]?.solidos}
                                                        className="bg-white/50 dark:bg-slate-900/50 rounded-full"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>% Sólidos - M2</Label>
                                                    <Input
                                                        name="solidos_medicion_2"
                                                        type="number"
                                                        step="0.01"
                                                        value={formData.solidos_medicion_2}
                                                        onChange={handleInputChange}
                                                        disabled={!PARAMETER_APPLICABILITY[formData.codigo_producto]?.solidos}
                                                        className="bg-white/50 dark:bg-slate-900/50 rounded-full"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Temp - M2 (°C)</Label>
                                                    <Input
                                                        name="temp_med2"
                                                        type="number"
                                                        step="0.1"
                                                        value={formData.temp_med2}
                                                        onChange={handleInputChange}
                                                        disabled={!PARAMETER_APPLICABILITY[formData.codigo_producto]?.solidos}
                                                        className="bg-white/50 dark:bg-slate-900/50 rounded-full"
                                                    />
                                                </div>
                                            </div>
                                            <div className="p-3 bg-white/50 dark:bg-slate-900/50 rounded-lg border text-[11px] text-muted-foreground italic leading-tight">
                                                Usar refractómetro digital de acuerdo a IO-DOP-OP-002
                                            </div>
                                        </div>

                                        {/* pH Column */}
                                        <div className="space-y-4 p-6 rounded-[2rem] bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-800/20">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-bold">
                                                    <Droplets className="h-5 w-5" />
                                                    Valor de pH
                                                </div>
                                                {/* Badge removed */}
                                            </div>
                                            <div className="space-y-4">
                                                <div className="space-y-2">
                                                    <Label>Valor medido de pH</Label>
                                                    <Input
                                                        name="ph"
                                                        type="number"
                                                        min="0"
                                                        max="14"
                                                        step="1"
                                                        placeholder="Ej: 7"
                                                        value={formData.ph}
                                                        onChange={handleInputChange}
                                                        disabled={!PARAMETER_APPLICABILITY[formData.codigo_producto]?.ph}
                                                        className="bg-white/50 dark:bg-slate-900/50 font-bold text-lg rounded-full"
                                                    />
                                                </div>
                                                <div className="p-3 bg-white/50 dark:bg-slate-900/50 rounded-lg border text-[11px] text-muted-foreground italic leading-tight">
                                                    Usar tiras reactivas de acuerdo a IO-DOP-OP-001
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Organoleptic Row */}
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
                                                <Select
                                                    value={formData.apariencia}
                                                    onValueChange={(val) => handleSelectChange("apariencia", val)}
                                                >
                                                    <SelectTrigger className="rounded-full">
                                                        <SelectValue placeholder="Selecciona" />
                                                    </SelectTrigger>
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
                                                <Select
                                                    value={formData.color}
                                                    onValueChange={(val) => handleSelectChange("color", val)}
                                                >
                                                    <SelectTrigger className="rounded-full">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="CONFORME">CONFORME</SelectItem>
                                                        <SelectItem value="NO CONFORME">NO CONFORME</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Aroma</Label>
                                                <Select
                                                    value={formData.aroma}
                                                    onValueChange={(val) => handleSelectChange("aroma", val)}
                                                >
                                                    <SelectTrigger className="rounded-full">
                                                        <SelectValue />
                                                    </SelectTrigger>
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
                                        <Textarea
                                            id="observaciones"
                                            name="observaciones"
                                            placeholder="Cualquier desviación o nota relevante..."
                                            value={formData.observaciones}
                                            onChange={handleInputChange}
                                            className="min-h-[100px] rounded-[1.5rem]"
                                        />
                                    </div>
                                </CardContent>
                                <CardFooter className="bg-muted/30 border-t py-4 flex flex-col gap-4">
                                    <div className="w-full flex flex-wrap justify-center gap-3">
                                        {/* Badges removed from footer */}
                                    </div>
                                    <Button
                                        type="submit"
                                        className="w-full md:w-auto md:min-w-[200px] h-12 text-lg font-bold gap-2 rounded-full"
                                        disabled={loading || !formData.codigo_producto}
                                    >
                                        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ClipboardCheck className="h-5 w-5" />}
                                        Finalizar y Generar Lote
                                    </Button>
                                </CardFooter>
                            </Card>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>
        </div >
    )
}

// Helper function for logic reuse (placed outside component scope)
function evaluateRecord(formData: any) {
    const product = formData.codigo_producto
    const applicability = PARAMETER_APPLICABILITY[product] || { solidos: false, ph: false }

    const evaluations = []

    // Solids evaluation
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
                evaluations.push({ type: "Sólidos", status: "warning", text: `En tolerancia (${avg.toFixed(2)}%) - Liberable` })
            } else {
                evaluations.push({ type: "Sólidos", status: "error", text: `Fuera de rango (${avg.toFixed(2)}%) - Retener` })
            }
        }
    }

    // pH evaluation
    if (applicability.ph) {
        const phVal = parseFloat(formData.ph)
        const standard = PH_STANDARDS[product]
        if (!isNaN(phVal) && standard) {
            if (phVal >= standard.min && phVal <= standard.max) {
                evaluations.push({ type: "pH", status: "success", text: `Conforme (${phVal})` })
            } else {
                evaluations.push({ type: "pH", status: "error", text: `Fuera de rango (${phVal})` })
            }
        }
    }

    // Appearance evaluation
    if (formData.apariencia) {
        const expected = APPEARANCE_STANDARDS[product]
        if (expected) {
            if (formData.apariencia.toUpperCase() === expected.toUpperCase()) {
                evaluations.push({ type: "Apariencia", status: "success", text: `Conforme (${formData.apariencia})` })
            } else {
                evaluations.push({ type: "Apariencia", status: "error", text: `No conforme (Esperado: ${expected})` })
            }
        }
    }

    return evaluations
}
