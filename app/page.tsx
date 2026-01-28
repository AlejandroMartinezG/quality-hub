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
                <h1 className="text-4xl font-bold text-[#16149a]">
                    Panel Principal
                </h1>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                    Bienvenido al Sistema de Gestión Documental del Laboratorio de Calidad y Desarrollo de GINEZ.
                    Selecciona un módulo para comenzar.
                </p>
            </div>

            {/* Modules Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <ModuleCard
                    title="Catálogo"
                    description="Consulta y descarga documentación de materias primas y productos terminados."
                    icon={BookOpen}
                    iconColor="#c32420"
                    href="/catalog"
                />
                <ModuleCard
                    title="Bitácora de Producción"
                    description="Registro y seguimiento de actividades de producción."
                    icon={ClipboardList}
                    iconColor="#c32420"
                    disabled
                    badge="Próximamente"
                />
                <ModuleCard
                    title="Control de Calidad"
                    description="Gestión de controles y análisis de calidad."
                    icon={Microscope}
                    iconColor="#c32420"
                    disabled
                    badge="Próximamente"
                />
                <ModuleCard
                    title="Inventarios"
                    description="Control y seguimiento de inventarios de materiales."
                    icon={Package}
                    iconColor="#c32420"
                    disabled
                    badge="Próximamente"
                />
                <ModuleCard
                    title="Reportes"
                    description="Generación de reportes y estadísticas."
                    icon={BarChart3}
                    iconColor="#c32420"
                    disabled
                    badge="Próximamente"
                />
                <ModuleCard
                    title="Configuración"
                    description="Ajustes y configuración del sistema."
                    icon={Settings}
                    iconColor="#c32420"
                    disabled
                    badge="Próximamente"
                />
            </div>
        </div>
    )
}
