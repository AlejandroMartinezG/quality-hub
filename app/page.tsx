import { ModuleCard } from "@/components/ModuleCard"
import {
    BookOpen,
    ClipboardList,
    Microscope,
    Package,
    BarChart3,
    Settings
} from "lucide-react"

export default function HomePage() {
    return (
        <div className="space-y-8">
            {/* Hero Section */}
            <div className="text-center space-y-4">
                <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                    Panel Principal
                </h1>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                    Bienvenido al Sistema de Gestión de Calidad y Documentación de GINEZ.
                    Selecciona un módulo para comenzar.
                </p>
            </div>

            {/* Modules Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <ModuleCard
                    title="Catálogo"
                    description="Consulta y descarga documentación de materias primas y productos terminados."
                    icon={BookOpen}
                    href="/catalog"
                />
                <ModuleCard
                    title="Bitácora de Producción"
                    description="Registro y seguimiento de actividades de producción."
                    icon={ClipboardList}
                    disabled
                    badge="Próximamente"
                />
                <ModuleCard
                    title="Control de Calidad"
                    description="Gestión de controles y análisis de calidad."
                    icon={Microscope}
                    disabled
                    badge="Próximamente"
                />
                <ModuleCard
                    title="Inventarios"
                    description="Control y seguimiento de inventarios de materiales."
                    icon={Package}
                    disabled
                    badge="Próximamente"
                />
                <ModuleCard
                    title="Reportes"
                    description="Generación de reportes y estadísticas."
                    icon={BarChart3}
                    disabled
                    badge="Próximamente"
                />
                <ModuleCard
                    title="Configuración"
                    description="Ajustes y configuración del sistema."
                    icon={Settings}
                    disabled
                    badge="Próximamente"
                />
            </div>
        </div>
    )
}
