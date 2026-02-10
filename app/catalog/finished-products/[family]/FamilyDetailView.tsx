"use client"

import { useState, useMemo, useCallback, useDeferredValue } from "react"
import { useRouter } from "next/navigation"
import { notFound } from "next/navigation"
import { Breadcrumbs } from "@/components/Breadcrumbs"
import { ModuleCard } from "@/components/ModuleCard"
import { DataTable } from "@/components/DataTable"
import { SimpleSearchInput } from "@/components/SearchInput"
import { Filters, FilterConfig } from "@/components/Filters"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { ColumnDef } from "@tanstack/react-table"
import {
    ArrowUpDown,
    Package,
    Eye,
    Download,
    FileText,
    ShieldAlert,
    BadgeCheck,
    Sparkles,
    SprayCan as Spray, // Using SprayCan as Spray might not be exported directly in all versions, checking generic 'Spray'
    Droplets,
    Wind,
    FlaskConical,
    FlaskRound,
    Star,
    Waves,
    Feather,
    Flower2,
    Hand,
    Droplet,
    Smile,
    ArrowRight
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { FinishedProduct, FamilyGroup } from "@/lib/types"
import { getBasePath, cn } from "@/lib/utils"
import { TrackedLink } from "@/components/TrackedLink"
import Fuse from "fuse.js"

const columns: ColumnDef<FinishedProduct>[] = [
    {
        accessorKey: "sku_code",
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                >
                    SKU
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            )
        },
        cell: ({ row }) => (
            <span className="font-mono font-medium text-foreground/80">{row.getValue("sku_code")}</span>
        ),
    },
    {
        accessorKey: "name",
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                >
                    Producto
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            )
        },
        cell: ({ row }) => (
            <span className="font-medium text-foreground">{row.getValue("name")}</span>
        ),
    },

    {
        accessorKey: "status",
        header: "Estado",
        cell: ({ row }) => {
            const status = row.getValue("status") as string
            const variant = status === "Activo" ? "success" : "secondary"
            return <Badge variant={variant}>{status}</Badge>
        },
    },
    {
        accessorKey: "updated_at",
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                >
                    Actualizado
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            )
        },
        cell: ({ row }) => {
            const date = row.getValue("updated_at") as string
            try {
                return new Date(date).toLocaleDateString("es-MX")
            } catch {
                return date
            }
        },
    },
    {
        id: "tds",
        header: "TDS",
        cell: ({ row }) => {
            const p = row.original
            return (
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" asChild={!!p.tds_view_url} title="Ver TDS" disabled={!p.tds_view_url}>
                        {p.tds_view_url ? (
                            <TrackedLink
                                href={p.tds_view_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                fileName={p.variant || p.base_product}
                                fileType="TDS (Vista)"
                                skuCode={p.sku_code}
                            >
                                <Eye className="h-4 w-4 text-primary" />
                            </TrackedLink>
                        ) : (
                            <Eye className="h-4 w-4 text-primary/30" />
                        )}
                    </Button>
                    <Button variant="ghost" size="icon" asChild={!!p.tds_download_url} title="Descargar TDS" disabled={!p.tds_download_url}>
                        {p.tds_download_url ? (
                            <TrackedLink
                                href={p.tds_download_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                fileName={p.variant || p.base_product}
                                fileType="TDS (Descarga)"
                                skuCode={p.sku_code}
                            >
                                <Download className="h-4 w-4 text-muted-foreground" />
                            </TrackedLink>
                        ) : (
                            <Download className="h-4 w-4 text-muted-foreground/30" />
                        )}
                    </Button>
                </div>
            )
        }
    },
    {
        id: "sds",
        header: "SDS",
        cell: ({ row }) => {
            const p = row.original
            return (
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" asChild={!!p.sds_view_url} title="Ver SDS" disabled={!p.sds_view_url}>
                        {p.sds_view_url ? (
                            <TrackedLink
                                href={p.sds_view_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                fileName={p.variant || p.base_product}
                                fileType="SDS (Vista)"
                                skuCode={p.sku_code}
                            >
                                <ShieldAlert className="h-4 w-4 text-destructive" />
                            </TrackedLink>
                        ) : (
                            <ShieldAlert className="h-4 w-4 text-destructive/30" />
                        )}
                    </Button>
                    <Button variant="ghost" size="icon" asChild={!!p.sds_download_url} title="Descargar SDS" disabled={!p.sds_download_url}>
                        {p.sds_download_url ? (
                            <TrackedLink
                                href={p.sds_download_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                fileName={p.variant || p.base_product}
                                fileType="SDS (Descarga)"
                                skuCode={p.sku_code}
                            >
                                <Download className="h-4 w-4 text-muted-foreground" />
                            </TrackedLink>
                        ) : (
                            <Download className="h-4 w-4 text-muted-foreground/30" />
                        )}
                    </Button>
                </div>
            )
        }
    },
    {
        id: "coa",
        header: "COA",
        cell: ({ row }) => {
            const p = row.original
            return (
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" asChild={!!p.coa_view_url} title="Ver COA" disabled={!p.coa_view_url}>
                        {p.coa_view_url ? (
                            <TrackedLink
                                href={p.coa_view_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                fileName={p.variant || p.base_product}
                                fileType="COA (Vista)"
                                skuCode={p.sku_code}
                            >
                                <BadgeCheck className="h-4 w-4 text-green-500" />
                            </TrackedLink>
                        ) : (
                            <BadgeCheck className="h-4 w-4 text-green-500/30" />
                        )}
                    </Button>
                    <Button variant="ghost" size="icon" asChild={!!p.coa_download_url} title="Descargar COA" disabled={!p.coa_download_url}>
                        {p.coa_download_url ? (
                            <TrackedLink
                                href={p.coa_download_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                fileName={p.variant || p.base_product}
                                fileType="COA (Descarga)"
                                skuCode={p.sku_code}
                            >
                                <Download className="h-4 w-4 text-muted-foreground" />
                            </TrackedLink>
                        ) : (
                            <Download className="h-4 w-4 text-muted-foreground/30" />
                        )}
                    </Button>
                </div>
            )
        }
    }
]

const SEARCH_KEYS = ["sku_code", "name"]

interface FamilyDetailViewProps {
    family: FamilyGroup
}

const familyColors: Record<string, string> = {
    "cuidado-del-hogar": "#ff8000",
    "lavanderia": "#0b109f",
    "linea-automotriz": "#000000",
    "linea-antibacterial": "#00b0f0",
    "cuidado-personal": "#00b050",
}

const categoryIcons: Record<string, any> = {
    // Cuidado del Hogar
    "limpiador-liquido-multiusos": Spray,
    "detergente-liquido-para-trates": Droplets,
    "aromatizantes-ambientales": Wind,
    "base-de-limpiador-liquido-multiusos": FlaskConical,
    "base-de-aromatizantes-ambientales": FlaskRound,
    "especialidad-cuidado-del-hogar": Star,

    // Lavandería
    "detergente-liquido-para-ropa": Waves,
    "suavizantes-liquidos-para-telas": Feather,
    "reforzador-de-aroma": Flower2,
    "especialidad-lavanderia": Star,

    // Cuidado Personal
    "jabon-liquido-para-manos": Hand,
    "shampoo-capilar": Droplet,
    "enjuague-capilar": Waves,
    "crema-corporal": Smile,
}

export function FamilyDetailView({ family }: FamilyDetailViewProps) {
    const router = useRouter()
    const basePath = getBasePath()
    const [searchQuery, setSearchQuery] = useState("")
    const deferredSearchQuery = useDeferredValue(searchQuery)
    const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({})

    const isDirectTable = family.slug === "linea-automotriz" || family.slug === "linea-antibacterial"
    const hasCategories = family.categories.length > 0 && !isDirectTable

    const iconColor = familyColors[family.slug] || "#16149a"

    // Collect all products for the table view
    const products = useMemo(() => {
        if (family.products && family.products.length > 0) return family.products
        // If it's a direct table but we have products in categories, flatten them
        return family.categories.flatMap(c => c.products)
    }, [family])

    // Build filter options
    const filterConfigs: FilterConfig[] = useMemo(() => {
        if (hasCategories) return []
        const statuses = Array.from(new Set(products.map(p => p.status)))
        const uniqueProducts = Array.from(new Set(products.map(p => p.name))).sort()

        const configs: FilterConfig[] = [
            {
                id: "status",
                label: "Estado",
                options: statuses.map(s => ({
                    value: s,
                    label: s,
                    count: products.filter(p => p.status === s).length,
                })),
            },
            {
                id: "name",
                label: "Producto",
                options: uniqueProducts.map(name => ({
                    value: name,
                    label: name,
                    count: products.filter(p => p.name === name).length,
                })),
            },
        ]

        return configs
    }, [products, hasCategories])

    // Fuse instance
    const fuse = useMemo(() => {
        return new Fuse(products, {
            keys: SEARCH_KEYS,
            threshold: 0.3,
            ignoreLocation: true,
        })
    }, [products])

    // Filter data
    const filteredData = useMemo(() => {
        let result = products

        if (deferredSearchQuery.trim()) {
            result = fuse.search(deferredSearchQuery).map(r => r.item)
        }

        Object.entries(activeFilters).forEach(([key, values]) => {
            if (values.length > 0) {
                result = result.filter(item => values.includes((item as any)[key]))
            }
        })

        return result
    }, [deferredSearchQuery, activeFilters, fuse, products])

    const handleFilterChange = useCallback((filterId: string, values: string[]) => {
        setActiveFilters(prev => ({
            ...prev,
            [filterId]: values,
        }))
    }, [])

    const handleClearAllFilters = useCallback(() => {
        setActiveFilters({})
    }, [])

    const handleRowClick = useCallback((row: FinishedProduct) => {
        router.push(`${basePath}/catalog/finished-products/${family.slug}/${row.category_slug}/${row.sku_code}/`)
    }, [router, basePath, family.slug])

    return (
        <div className="space-y-8">
            <Breadcrumbs
                items={[
                    { label: "Catálogo", href: "/catalog" },
                    { label: "Productos Terminados", href: "/catalog/finished-products" },
                    { label: family.name },
                ]}
            />

            <div className="space-y-4">
                <h1 className="text-3xl font-bold">{family.name}</h1>
                {!hasCategories && products.length > 0 && (
                    <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider -mt-2">
                        {products.length} variantes disponibles
                    </p>
                )}
                <p className="text-muted-foreground">
                    {hasCategories
                        ? "Selecciona una categoría para ver los productos disponibles."
                        : `Listado de productos disponibles en ${family.name}.`
                    }
                </p>
            </div>

            {hasCategories ? (
                <div className="flex flex-wrap justify-center gap-6">
                    {
                        family.categories.map((category) => {
                            const Icon = categoryIcons[category.slug] || Package

                            return (
                                <Link
                                    key={category.slug}
                                    href={`${basePath}/catalog/finished-products/${family.slug}/${category.slug}`}
                                    className="group block h-full w-full md:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)]"
                                >
                                    <Card className="h-full border-2 border-slate-200 dark:border-slate-800 rounded-[2.5rem] shadow-sm hover:shadow-lg hover:border-primary/50 transition-all bg-white dark:bg-slate-900 group-hover:-translate-y-1">
                                        <CardContent className="p-8 flex flex-col items-center text-center h-full relative overflow-hidden">
                                            {/* Decorative Background Element */}
                                            <div
                                                className="absolute top-0 right-0 w-24 h-24 rounded-bl-[100%] z-0 opacity-10"
                                                style={{ backgroundColor: iconColor }}
                                            />

                                            <div className="relative z-10 flex flex-col items-center h-full w-full">
                                                <div
                                                    className="h-16 w-16 rounded-full flex items-center justify-center mb-4 shadow-sm border border-slate-100 dark:border-slate-800 group-hover:scale-110 transition-transform duration-300"
                                                    style={{ backgroundColor: `${iconColor}20` }}
                                                >
                                                    <Icon
                                                        className="h-8 w-8"
                                                        style={{ color: iconColor }}
                                                    />
                                                </div>

                                                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2 group-hover:text-primary transition-colors">
                                                    {category.name}
                                                </h3>

                                                <p className="text-slate-500 text-sm leading-relaxed mb-6">
                                                    {category.products.length} producto{category.products.length !== 1 ? 's' : ''}
                                                </p>

                                                <div className="mt-auto w-full pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Ver productos</span>
                                                    <ArrowRight className="h-4 w-4 text-primary transition-transform group-hover:translate-x-1" />
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </Link>
                            )
                        })
                    }
                </div>
            ) : products.length > 0 ? (
                <div className="space-y-6">
                    {/* Search and Filters */}
                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row gap-4">
                            <SimpleSearchInput
                                value={searchQuery}
                                onChange={setSearchQuery}
                                placeholder="Buscar por producto"
                            />
                        </div>
                        <Filters
                            filters={filterConfigs}
                            activeFilters={activeFilters}
                            onFilterChange={handleFilterChange}
                            onClearAll={handleClearAllFilters}
                        />
                    </div>

                    {/* Data Table */}
                    <DataTable
                        columns={columns}
                        data={filteredData}
                        onRowClick={handleRowClick}
                    />
                </div>
            ) : (
                <div className="text-center py-12 border rounded-xl bg-muted/20">
                    <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-20" />
                    <p className="text-muted-foreground font-medium">
                        No hay productos disponibles en esta familia actualmente.
                    </p>
                </div>
            )
            }
        </div >
    )
}
