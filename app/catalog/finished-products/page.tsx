"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Breadcrumbs } from "@/components/Breadcrumbs"
import { Card, CardContent } from "@/components/ui/card"
import {
    Home,
    Shirt,
    Car,
    Shield,
    User,
    Search,
    ChevronRight,
    Sparkles,
    Filter,
    X,
    ArrowRight
} from "lucide-react"
import { FinishedProductsData, FamilyGroup, CategoryGroup, FinishedProduct } from "@/lib/types"
import { getBasePath, cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"

import finishedProductsData from "@/data/finished-products.json"

const data: FinishedProductsData = finishedProductsData as FinishedProductsData

const familyIcons: Record<string, any> = {
    "cuidado-del-hogar": Home,
    "lavanderia": Shirt,
    "linea-automotriz": Car,
    "linea-antibacterial": Shield,
    "cuidado-personal": User,
}

const familyColors: Record<string, string> = {
    "cuidado-del-hogar": "#ff8000",
    "lavanderia": "#0b109f",
    "linea-automotriz": "#000000",
    "linea-antibacterial": "#00b0f0",
    "cuidado-personal": "#00b050",
}

export default function FinishedProductsPage() {
    const router = useRouter()
    const basePath = getBasePath()

    // Filter States
    const [selectedFamily, setSelectedFamily] = useState<FamilyGroup | null>(null)
    const [selectedCategory, setSelectedCategory] = useState<CategoryGroup | null>(null)
    const [selectedProduct, setSelectedProduct] = useState<FinishedProduct | null>(null)

    // Derived Data
    const availableCategories = useMemo(() => {
        if (!selectedFamily) return []
        return selectedFamily.categories
    }, [selectedFamily])

    const availableProducts = useMemo(() => {
        if (!selectedCategory) return []
        return selectedCategory.products
    }, [selectedCategory])

    // Handlers
    const handleFamilySelect = (family: FamilyGroup) => {
        setSelectedFamily(family)
        setSelectedCategory(null)
        setSelectedProduct(null)

        // Auto-select category if there is only one
        if (family.categories.length === 1) {
            setSelectedCategory(family.categories[0])
        }
    }

    const handleCategorySelect = (category: CategoryGroup) => {
        setSelectedCategory(category)
        setSelectedProduct(null)
    }

    const handleProductSelect = (product: FinishedProduct) => {
        setSelectedProduct(product)
        // Auto-navigate if needed or show the "Go" button
    }

    const goToProduct = () => {
        if (selectedProduct && selectedFamily && selectedCategory) {
            router.push(`${basePath}/catalog/finished-products/${selectedFamily.slug}/${selectedCategory.slug}/${selectedProduct.sku_code}`)
        }
    }

    const clearFilters = () => {
        setSelectedFamily(null)
        setSelectedCategory(null)
        setSelectedProduct(null)
    }

    return (
        <div className="space-y-8">
            <Breadcrumbs
                items={[
                    { label: "Catálogo", href: "/catalog" },
                    { label: "Productos Terminados" },
                ]}
            />

            <div className="text-center space-y-4">
                <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-700 to-red-600 bg-clip-text text-transparent">
                    Productos Terminados
                </h1>
                <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
                    Explora nuestro catálogo por familias o usa el buscador rápido para saltar directamente a un producto.
                </p>
            </div>

            {/* Quick Search Bar */}
            <div className="max-w-4xl mx-auto w-full">
                <div className="p-3 bg-card border rounded-[2rem] shadow-xl space-y-4 md:space-y-0 md:flex items-center gap-3">
                    {/* Family Selector */}
                    <div className="flex-1">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="ghost"
                                    className={cn(
                                        "w-full justify-start h-14 text-left font-normal border-none hover:bg-muted/50 rounded-[1.5rem] px-6",
                                        !selectedFamily && "text-muted-foreground"
                                    )}
                                >
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className={cn(
                                            "p-2 rounded-lg transition-colors",
                                            selectedFamily ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                                        )}>
                                            <Filter className="h-4 w-4" />
                                        </div>
                                        <div className="flex flex-col text-left truncate">
                                            <span className="text-[10px] uppercase font-bold tracking-wider opacity-50">Familia</span>
                                            <span className="truncate font-medium">{selectedFamily?.name || "Seleccionar..."}</span>
                                        </div>
                                    </div>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[280px] p-2 rounded-xl" align="start">
                                <div className="space-y-1">
                                    {data.families.map((f) => (
                                        <Button
                                            key={f.slug}
                                            variant="ghost"
                                            className="w-full justify-start font-normal h-10 px-2 rounded-lg"
                                            onClick={() => handleFamilySelect(f)}
                                        >
                                            <div className="w-6 h-6 rounded bg-muted flex items-center justify-center mr-2">
                                                {(() => {
                                                    const Icon = familyIcons[f.slug] || Home
                                                    return <Icon className="h-3 w-3" />
                                                })()}
                                            </div>
                                            {f.name}
                                        </Button>
                                    ))}
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div className="hidden md:block w-px h-8 bg-border" />

                    {/* Category Selector */}
                    <div className="flex-1">
                        <Popover>
                            <PopoverTrigger asChild disabled={!selectedFamily}>
                                <Button
                                    variant="ghost"
                                    className={cn(
                                        "w-full justify-start h-14 text-left font-normal border-none hover:bg-muted/50 rounded-[1.5rem] px-6 disabled:opacity-30",
                                        !selectedCategory && "text-muted-foreground"
                                    )}
                                >
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className={cn(
                                            "p-2 rounded-lg transition-colors",
                                            selectedCategory ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                                        )}>
                                            <ChevronRight className="h-4 w-4" />
                                        </div>
                                        <div className="flex flex-col text-left truncate">
                                            <span className="text-[10px] uppercase font-bold tracking-wider opacity-50">Categoría</span>
                                            <span className="truncate font-medium">{selectedCategory?.name || "Seleccionar..."}</span>
                                        </div>
                                    </div>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[320px] p-2 rounded-xl" align="start">
                                <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
                                    {availableCategories.length > 0 ? (
                                        availableCategories.map((c) => (
                                            <Button
                                                key={c.slug}
                                                variant="ghost"
                                                className="w-full justify-start font-normal h-10 px-2 rounded-lg"
                                                onClick={() => handleCategorySelect(c)}
                                            >
                                                {c.name}
                                                <Badge variant="secondary" className="ml-auto text-[10px] h-4">
                                                    {c.products.length}
                                                </Badge>
                                            </Button>
                                        ))
                                    ) : (
                                        <p className="text-xs text-muted-foreground p-4 text-center">Selecciona una familia primero</p>
                                    )}
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div className="hidden md:block w-px h-8 bg-border" />

                    {/* Product Selector */}
                    <div className="flex-1">
                        <Popover>
                            <PopoverTrigger asChild disabled={!selectedCategory}>
                                <Button
                                    variant="ghost"
                                    className={cn(
                                        "w-full justify-start h-14 text-left font-normal border-none hover:bg-muted/50 rounded-[1.5rem] px-6 disabled:opacity-30",
                                        !selectedProduct && "text-muted-foreground"
                                    )}
                                >
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className={cn(
                                            "p-2 rounded-lg transition-colors",
                                            selectedProduct ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                                        )}>
                                            <Sparkles className="h-4 w-4" />
                                        </div>
                                        <div className="flex flex-col text-left truncate">
                                            <span className="text-[10px] uppercase font-bold tracking-wider opacity-50">Variante</span>
                                            <span className="truncate font-medium">{selectedProduct?.variant || "Seleccionar..."}</span>
                                        </div>
                                    </div>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[350px] p-2 rounded-xl" align="start">
                                <div className="max-h-80 overflow-y-auto space-y-1 pr-1">
                                    {availableProducts.length > 0 ? (
                                        availableProducts.map((p) => (
                                            <Button
                                                key={p.sku_code}
                                                variant="ghost"
                                                className="w-full justify-start font-normal h-auto py-2 px-2 rounded-lg text-left"
                                                onClick={() => handleProductSelect(p)}
                                            >
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-mono text-muted-foreground">{p.sku_code}</span>
                                                    <span className="font-medium leading-tight">{p.variant}</span>
                                                </div>
                                            </Button>
                                        ))
                                    ) : (
                                        <p className="text-xs text-muted-foreground p-4 text-center">Selecciona una categoría primero</p>
                                    )}
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1 pl-2">
                        {selectedFamily && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 text-muted-foreground hover:text-destructive rounded-xl"
                                onClick={clearFilters}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                        <Button
                            disabled={!selectedProduct}
                            onClick={goToProduct}
                            className="h-14 px-8 rounded-[1.5rem] bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 transition-all active:scale-95 disabled:grayscale"
                        >
                            <span className="mr-2">Ir</span>
                            <ArrowRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Families Grid */}
            <div className="space-y-6 pt-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold px-1">Navegar por Familia</h2>
                </div>
                <div className="flex flex-wrap justify-center gap-6">
                    {data.families.map((family) => {
                        const Icon = familyIcons[family.slug] || Home
                        const iconColor = familyColors[family.slug]
                        const productCount = (family.products?.length || 0) + family.categories.reduce(
                            (acc, cat) => acc + cat.products.length,
                            0
                        )

                        const categoryCount = family.categories.length || (family.products && family.products.length > 0 ? 1 : 0)

                        return (
                            <Link
                                key={family.slug}
                                href={`${basePath}/catalog/finished-products/${family.slug}`}
                                className="group block h-full w-full md:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)]"
                            >
                                <Card className="h-full border-2 border-slate-200 dark:border-slate-800 rounded-[2.5rem] shadow-sm hover:shadow-lg hover:border-primary/50 transition-all bg-white dark:bg-slate-900 group-hover:-translate-y-1">
                                    <CardContent className="p-8 flex flex-col items-center text-center h-full relative overflow-hidden">
                                        {/* Decorative Background Element - Dynamic Color */}
                                        <div
                                            className="absolute top-0 right-0 w-32 h-32 rounded-bl-[100%] z-0 opacity-10"
                                            style={{ backgroundColor: iconColor }}
                                        />

                                        <div className="relative z-10 flex flex-col items-center h-full w-full">
                                            <div
                                                className="h-20 w-20 rounded-full flex items-center justify-center mb-6 shadow-sm border border-slate-100 dark:border-slate-800 group-hover:scale-110 transition-transform duration-300"
                                                style={{ backgroundColor: `${iconColor}20` }} // 20 hex = 12% opacity roughly
                                            >
                                                <Icon
                                                    className="h-10 w-10"
                                                    style={{ color: iconColor }}
                                                />
                                            </div>

                                            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2 group-hover:text-primary transition-colors">
                                                {family.name}
                                            </h3>

                                            <p className="text-slate-500 text-sm leading-relaxed mb-6">
                                                {categoryCount} categoría{categoryCount !== 1 ? 's' : ''} · {productCount} producto{productCount !== 1 ? 's' : ''}
                                            </p>

                                            <div className="mt-auto w-full pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                                <Badge variant="secondary" className="bg-slate-100 text-slate-700 hover:bg-slate-200 border-none px-3 py-1">
                                                    Explorar
                                                </Badge>
                                                <ArrowRight className="h-4 w-4 text-primary transition-transform group-hover:translate-x-1" />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
