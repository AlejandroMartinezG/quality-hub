import { ModuleCard } from "@/components/ModuleCard"
import {
    BookOpen,
    ClipboardList,
    Microscope,
    BarChart3,
    Settings,
    Beaker,
    ArrowRight,
    CheckCircle2
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import Link from "next/link"

export default function HomePage() {
    return (
        <div className="space-y-8 pb-12">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b pb-6">
                <div className="-mt-2">
                    <h2 className="text-xl font-bold text-blue-900 uppercase tracking-wide mb-1">
                        SISTEMA DE CONTROL DE CALIDAD GINEZ
                    </h2>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                        Módulos de Operación
                    </h1>
                </div>
            </div>

            {/* Modules Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* 1. Catálogo */}
                <Link href="/catalog" className="group block">
                    <Card className="h-full border-none shadow-sm hover:shadow-md transition-all bg-[#FFFBF7] dark:bg-slate-900">
                        <CardContent className="p-8 flex flex-col items-start gap-4 h-full relative">
                            <Badge className="absolute top-6 right-6 bg-blue-100 text-blue-700 hover:bg-blue-200 border-none px-3 font-bold">
                                ACTIVO
                            </Badge>
                            <div className="h-14 w-14 rounded-full bg-blue-900 flex items-center justify-center mb-2 shadow-blue-900/20 shadow-lg group-hover:scale-110 transition-transform">
                                <BookOpen className="h-7 w-7 text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2 group-hover:text-blue-900 transition-colors">
                                    Catálogo
                                </h3>
                                <p className="text-slate-500 text-sm leading-relaxed mb-6">
                                    Consulta y descarga documentación de materias primas y productos terminados.
                                </p>
                            </div>
                            <div className="mt-auto flex items-center text-blue-700 font-bold text-sm">
                                Acceder al repositorio <ArrowRight className="ml-2 h-4 w-4" />
                            </div>
                        </CardContent>
                    </Card>
                </Link>

                {/* 2. Bitácora */}
                <Link href="/bitacora" className="group block">
                    <Card className="h-full border-none shadow-sm hover:shadow-md transition-all bg-[#FFFBF7] dark:bg-slate-900">
                        <CardContent className="p-8 flex flex-col items-start gap-4 h-full">
                            <div className="h-14 w-14 rounded-full bg-blue-900 flex items-center justify-center mb-2 shadow-blue-900/20 shadow-lg group-hover:scale-110 transition-transform">
                                <ClipboardList className="h-7 w-7 text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2 group-hover:text-blue-900 transition-colors">
                                    Bitácora de Producción
                                </h3>
                                <p className="text-slate-500 text-sm leading-relaxed mb-6">
                                    Registro y seguimiento de actividades de producción y parámetros de calidad.
                                </p>
                            </div>
                            <div className="mt-auto flex items-center text-blue-700 font-bold text-sm">
                                Acceder al módulo <ArrowRight className="ml-2 h-4 w-4" />
                            </div>
                        </CardContent>
                    </Card>
                </Link>

                {/* 3. Control de Calidad */}
                <Link href="/calidad" className="group block">
                    <Card className="h-full border-none shadow-sm hover:shadow-md transition-all bg-[#FFFBF7] dark:bg-slate-900">
                        <CardContent className="p-8 flex flex-col items-start gap-4 h-full relative">
                            <Badge className="absolute top-6 right-6 bg-slate-100 text-slate-500 border-none px-3 font-bold">
                                ESTÁNDARES
                            </Badge>
                            <div className="h-14 w-14 rounded-full bg-blue-900 flex items-center justify-center mb-2 shadow-blue-900/20 shadow-lg group-hover:scale-110 transition-transform">
                                <Microscope className="h-7 w-7 text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2 group-hover:text-blue-900 transition-colors">
                                    Control de Calidad
                                </h3>
                                <p className="text-slate-500 text-sm leading-relaxed mb-6">
                                    Resumen de mediciones y cumplimiento de límites de control registrados en bitácora.
                                </p>
                            </div>
                            <div className="mt-auto flex items-center text-blue-700 font-bold text-sm">
                                Acceder al tablero <ArrowRight className="ml-2 h-4 w-4" />
                            </div>
                        </CardContent>
                    </Card>
                </Link>

                {/* 4. Manual de Formulación (Disabled) */}
                <Card className="h-full border-none shadow-sm bg-[#FFFBF7] dark:bg-slate-900 opacity-60">
                    <CardContent className="p-8 flex flex-col items-start gap-4 h-full relative">
                        <Badge className="absolute top-6 right-6 bg-slate-200 text-slate-600 border-none px-3 font-bold">
                            DESARROLLO
                        </Badge>
                        <div className="h-14 w-14 rounded-full bg-slate-100 flex items-center justify-center mb-2">
                            <Beaker className="h-7 w-7 text-slate-400" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
                                Manual de Formulación Ginez
                            </h3>
                            <p className="text-slate-500 text-sm leading-relaxed mb-6">
                                Consulta de fórmulas y procedimientos técnicos de elaboración.
                            </p>
                        </div>
                        <div className="mt-auto w-12 h-1 bg-slate-200 rounded-full" />
                    </CardContent>
                </Card>

                {/* 5. Reportes (Disabled) */}
                <Card className="h-full border-none shadow-sm bg-[#FFFBF7] dark:bg-slate-900 opacity-60">
                    <CardContent className="p-8 flex flex-col items-start gap-4 h-full">
                        <div className="h-14 w-14 rounded-full bg-blue-50 flex items-center justify-center mb-2">
                            <BarChart3 className="h-7 w-7 text-blue-900" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
                                Reportes
                            </h3>
                            <p className="text-slate-500 text-sm leading-relaxed mb-6">
                                Generación de reportes y estadísticas.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* 6. Configuración */}
                <Link href="/configuracion" className="group block">
                    <Card className="h-full border-none shadow-sm hover:shadow-md transition-all bg-[#FFFBF7] dark:bg-slate-900">
                        <CardContent className="p-8 flex flex-col items-start gap-4 h-full">
                            <div className="h-14 w-14 rounded-full bg-blue-900 flex items-center justify-center mb-2 shadow-blue-900/20 shadow-lg group-hover:scale-110 transition-transform">
                                <Settings className="h-7 w-7 text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2 group-hover:text-blue-900 transition-colors">
                                    Configuración
                                </h3>
                                <p className="text-slate-500 text-sm leading-relaxed mb-6">
                                    Ajustes y configuración del sistema.
                                </p>
                            </div>
                            <div className="mt-auto flex items-center text-blue-700 font-bold text-sm">
                                Acceder a ajustes <ArrowRight className="ml-2 h-4 w-4" />
                            </div>
                        </CardContent>
                    </Card>
                </Link>
            </div>

            <div className="flex justify-between items-center text-xs text-slate-400 pt-8 border-t mt-8">
                <p>© 2026 GINEZ Corporate. División Industrial & Limpieza.</p>
                <div className="flex gap-6">
                    <div className="flex items-center gap-2 cursor-pointer hover:text-blue-900">
                        <CheckCircle2 className="h-3 w-3" /> Cumplimiento
                    </div>
                    <div className="flex items-center gap-2 cursor-pointer hover:text-blue-900">
                        <BookOpen className="h-3 w-3" /> Manual de Usuario
                    </div>
                </div>
            </div>
        </div>
    )
}
