import { Breadcrumbs } from "@/components/Breadcrumbs"
import { ModuleCard } from "@/components/ModuleCard"
import {
    Home,
    Shirt,
    Car,
    Shield,
    User
} from "lucide-react"
import { FinishedProductsData } from "@/lib/types"
import { slugify } from "@/lib/utils"

import finishedProductsData from "@/data/finished-products.json"

const data: FinishedProductsData = finishedProductsData as FinishedProductsData

const familyIcons: Record<string, any> = {
    "cuidado-del-hogar": Home,
    "lavanderia": Shirt,
    "linea-automotriz": Car,
    "linea-antibacterial": Shield,
    "cuidado-personal": User,
}

export default function FinishedProductsPage() {
    return (
        <div className="space-y-8">
            <Breadcrumbs
                items={[
                    { label: "Catálogo", href: "/catalog" },
                    { label: "Productos Terminados" },
                ]}
            />

            <div className="text-center space-y-4">
                <h1 className="text-3xl font-bold">Productos Terminados</h1>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                    Selecciona una familia de productos para ver sus categorías y documentación.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {data.families.map((family) => {
                    const Icon = familyIcons[family.slug] || Home
                    const productCount = family.categories.reduce(
                        (acc, cat) => acc + cat.products.length,
                        0
                    )

                    return (
                        <ModuleCard
                            key={family.slug}
                            title={family.name}
                            description={`${family.categories.length} categorías · ${productCount} productos`}
                            icon={Icon}
                            href={`/catalog/finished-products/${family.slug}`}
                        />
                    )
                })}
            </div>
        </div>
    )
}
