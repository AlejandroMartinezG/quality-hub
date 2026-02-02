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
import { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, Package, Eye, Download, FileText, ShieldAlert, BadgeCheck, Sparkles } from "lucide-react"
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
        accessorKey: "variant",
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                >
                    Variante / Aroma
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            )
        },
        cell: ({ row }) => (
            <Badge variant="secondary" className="bg-muted text-foreground border-none gap-1.5 px-2.5 py-1">
                <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                {row.getValue("variant")}
            </Badge>
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

const SEARCH_KEYS = ["sku_code", "base_product", "variant"]

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
        const variants = Array.from(new Set(products.map(p => p.variant).filter(Boolean)))

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
        ]

        if (variants.length > 0) {
            configs.push({
                id: "variant",
                label: "Variante",
                options: variants.map(v => ({
                    value: v,
                    label: v,
                    count: products.filter(p => p.status === "Activo" ? true : true).filter(p => p.variant === v).length,
                })),
            })
        }

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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {family.categories.map((category) => (
                        <ModuleCard
                            key={category.slug}
                            title={category.name}
                            description={`${category.products.length} producto(s)`}
                            icon={Package}
                            iconColor={iconColor}
                            href={`/catalog/finished-products/${family.slug}/${category.slug}`}
                        />
                    ))}
                </div>
            ) : products.length > 0 ? (
                <div className="space-y-6">
                    {/* Search and Filters */}
                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row gap-4">
                            <SimpleSearchInput
                                value={searchQuery}
                                onChange={setSearchQuery}
                                placeholder="Buscar por SKU, producto base, variante..."
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
            )}
        </div>
    )
}
