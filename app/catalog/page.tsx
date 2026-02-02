import { Breadcrumbs } from "@/components/Breadcrumbs"
import { ModuleCard } from "@/components/ModuleCard"
import { FlaskConical, Package } from "lucide-react"
import rawMaterialsData from "@/data/raw-materials.json"
import finishedProductsData from "@/data/finished-products.json"

export default function CatalogPage() {
    // Calcular conteos
    const mpCount = rawMaterialsData.length

    // Contar todos los productos en todas las familias y categorías
    const ptCount = finishedProductsData.families.reduce((acc: number, family: any) => {
        const productsInCategory = family.categories?.reduce((catAcc: number, category: any) => {
            return catAcc + (category.products?.length || 0)
        }, 0) || 0

        const directProducts = family.products?.length || 0

        return acc + productsInCategory + directProducts
    }, 0)

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
                    iconColor="#16149a"
                    href="/catalog/raw-materials"
                    badge={`${mpCount} registros`}
                />
                <ModuleCard
                    title="Productos Terminados"
                    description="Documentación técnica y de calidad de productos terminados."
                    icon={Package}
                    iconColor="#c32420"
                    href="/catalog/finished-products"
                    badge={`${ptCount} registros`}
                />
            </div>
        </div>
    )
}
