import { Breadcrumbs } from "@/components/Breadcrumbs"
import { ModuleCard } from "@/components/ModuleCard"
import { FlaskConical, Package } from "lucide-react"

export default function CatalogPage() {
    return (
        <div className="space-y-8">
            <Breadcrumbs items={[{ label: "Catálogo" }]} />

            <div className="text-center space-y-4">
                <h1 className="text-3xl font-bold">Catálogo</h1>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                    Selecciona el tipo de producto para consultar su documentación.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
                <ModuleCard
                    title="Materias Primas"
                    description="Fichas técnicas, hojas de seguridad y certificados de análisis de materias primas."
                    icon={FlaskConical}
                    href="/catalog/raw-materials"
                />
                <ModuleCard
                    title="Productos Terminados"
                    description="Documentación técnica y de calidad de productos terminados."
                    icon={Package}
                    href="/catalog/finished-products"
                />
            </div>
        </div>
    )
}
