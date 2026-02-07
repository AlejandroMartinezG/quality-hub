import { Breadcrumbs } from "@/components/Breadcrumbs"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { FlaskConical, Package, ArrowRight } from "lucide-react"
import Link from "next/link"
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
        <div className="space-y-8 pb-12">
            <Breadcrumbs items={[{ label: "Catálogo" }]} />

            <div className="text-center space-y-4">
                <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-700 to-red-600 bg-clip-text text-transparent">
                    Catálogo
                </h1>
                <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
                    Selecciona el tipo de producto para consultar su documentación.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto mt-8">
                {/* Materias Primas */}
                <Link href="/catalog/raw-materials" className="group block h-full">
                    <Card className="h-full border-2 border-slate-200 dark:border-slate-800 rounded-[2.5rem] shadow-sm hover:shadow-lg hover:border-blue-500/50 transition-all bg-white dark:bg-slate-900 group-hover:-translate-y-1">
                        <CardContent className="p-8 md:p-10 flex flex-col items-center text-center h-full relative overflow-hidden">
                            {/* Decorative Background Element */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 dark:bg-blue-900/10 rounded-bl-[100%] z-0" />

                            <div className="relative z-10 flex flex-col items-center h-full w-full">
                                <div className="h-24 w-24 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mb-6 shadow-sm border border-blue-100 dark:border-blue-800 group-hover:scale-110 transition-transform duration-300">
                                    <FlaskConical className="h-10 w-10 text-blue-800 dark:text-blue-400" />
                                </div>

                                <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-3 group-hover:text-blue-800 transition-colors">
                                    Materias Primas
                                </h3>

                                <p className="text-slate-500 text-base leading-relaxed mb-8 max-w-xs">
                                    Fichas técnicas, hojas de seguridad y certificados de análisis de materias primas.
                                </p>

                                <div className="mt-auto w-full pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                    <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-100 px-3 py-1">
                                        {mpCount} registros
                                    </Badge>
                                    <span className="text-blue-700 font-bold text-sm flex items-center">
                                        Explorar <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                                    </span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </Link>

                {/* Productos Terminados */}
                <Link href="/catalog/finished-products" className="group block h-full">
                    <Card className="h-full border-2 border-slate-200 dark:border-slate-800 rounded-[2.5rem] shadow-sm hover:shadow-lg hover:border-red-500/50 transition-all bg-white dark:bg-slate-900 group-hover:-translate-y-1">
                        <CardContent className="p-8 md:p-10 flex flex-col items-center text-center h-full relative overflow-hidden">
                            {/* Decorative Background Element */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 dark:bg-red-900/10 rounded-bl-[100%] z-0" />

                            <div className="relative z-10 flex flex-col items-center h-full w-full">
                                <div className="h-24 w-24 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-6 shadow-sm border border-red-100 dark:border-red-800 group-hover:scale-110 transition-transform duration-300">
                                    <Package className="h-10 w-10 text-red-700 dark:text-red-400" />
                                </div>

                                <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-3 group-hover:text-red-700 transition-colors">
                                    Productos Terminados
                                </h3>

                                <p className="text-slate-500 text-base leading-relaxed mb-8 max-w-xs">
                                    Documentación técnica y de calidad de productos terminados.
                                </p>

                                <div className="mt-auto w-full pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                    <Badge variant="secondary" className="bg-red-50 text-red-700 hover:bg-red-100 border-red-100 px-3 py-1">
                                        {ptCount} registros
                                    </Badge>
                                    <span className="text-red-700 font-bold text-sm flex items-center">
                                        Explorar <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                                    </span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </Link>
            </div>
        </div>
    )
}
