"use client"

import { useState, useMemo, useCallback, useDeferredValue } from "react"
import { useRouter } from "next/navigation"
import { Breadcrumbs } from "@/components/Breadcrumbs"
import { DataTable } from "@/components/DataTable"
import { SimpleSearchInput } from "@/components/SearchInput"
import { Filters, FilterConfig, FilterOption } from "@/components/Filters"
import { Badge } from "@/components/ui/badge"
import { ColumnDef } from "@tanstack/react-table"
import { getBasePath, cn } from "@/lib/utils"
import { ArrowUpDown, Eye, Download, FileText, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { RawMaterial } from "@/lib/types"
import { TrackedLink } from "@/components/TrackedLink"
import Fuse from "fuse.js"

// Import data - will be generated at build time
import rawMaterialsData from "@/data/raw-materials.json"

const data: RawMaterial[] = rawMaterialsData as RawMaterial[]

// Helper function for Functional Category colors
const getFunctionalCategoryColor = (category: string) => {
    const normalized = category.toLowerCase();
    if (normalized.includes("activo")) return "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 border-blue-200 dark:border-blue-800";
    if (normalized.includes("funcional")) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800";
    if (normalized.includes("control")) return "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400 border-orange-200 dark:border-orange-800";
    if (normalized.includes("proceso")) return "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-400 border-slate-200 dark:border-slate-800";
    return "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400 border-violet-200 dark:border-violet-800";
};

// Helper function for Disposition colors
const getDispositionColor = (disposition: string) => {
    const normalized = disposition.toLowerCase();
    if (normalized.includes("general")) return "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400 border-green-200 dark:border-green-800";
    if (normalized.includes("restringido")) return "bg-[#c41f1a]/10 text-[#c41f1a] dark:bg-[#c41f1a]/20 dark:text-[#ff4d4d] border-[#c41f1a]/20 dark:border-[#c41f1a]/40";
    return "bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-400 border-gray-200 dark:border-gray-800";
};

const columns: ColumnDef<RawMaterial>[] = [
    {
        accessorKey: "code",
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="hover:bg-white/10 hover:text-white -ml-4"
                >
                    Código
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            )
        },
        cell: ({ row }) => <div className="font-medium">{row.getValue("code")}</div>,
    },
    {
        accessorKey: "name",
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="hover:bg-white/10 hover:text-white -ml-4"
                >
                    Nombre
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            )
        },
        cell: ({ row }) => <div className="font-medium max-w-[250px]">{row.getValue("name")}</div>,
    },
    {
        accessorKey: "transport_name",
        header: "Nombre de Transporte",
        cell: ({ row }) => <div className="text-muted-foreground">{row.getValue("transport_name")}</div>,
    },
    {
        accessorKey: "functional_category",
        header: "Categoría Funcional",
        cell: ({ row }) => {
            const val = row.getValue("functional_category") as string;
            return (
                <Badge
                    variant="outline"
                    className={cn("rounded-md font-normal text-nowrap max-w-[150px] truncate block", getFunctionalCategoryColor(val))}
                    title={val}
                >
                    {val}
                </Badge>
            )
        },
    },
    {
        accessorKey: "chemical_family",
        header: "Familia Química",
        cell: ({ row }) => <div className="text-muted-foreground">{row.getValue("chemical_family")}</div>,
    },
    {
        accessorKey: "disposition",
        header: "Disposición",
        cell: ({ row }) => {
            const val = row.getValue("disposition") as string;
            return (
                <Badge
                    variant="outline"
                    className={cn("rounded-md font-normal text-nowrap max-w-[150px] truncate block", getDispositionColor(val))}
                    title={val}
                >
                    {val}
                </Badge>
            )
        },
    },
    {
        id: "tds",
        header: "TDS",
        cell: ({ row }) => {
            const viewUrl = row.original.tds_view_url
            const downloadUrl = row.original.tds_download_url
            return (
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" asChild={!!viewUrl} title="Ver TDS" disabled={!viewUrl}>
                        {viewUrl ? (
                            <TrackedLink
                                href={viewUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                fileName={row.original.name}
                                fileType="TDS (Vista)"
                                skuCode={row.original.code}
                            >
                                <Eye className="h-4 w-4 text-primary" />
                            </TrackedLink>
                        ) : (
                            <Eye className="h-4 w-4 text-muted-foreground/30" />
                        )}
                    </Button>
                    <Button variant="ghost" size="icon" asChild={!!downloadUrl} title="Descargar TDS" disabled={!downloadUrl}>
                        {downloadUrl ? (
                            <TrackedLink
                                href={downloadUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                fileName={row.original.name}
                                fileType="TDS (Descarga)"
                                skuCode={row.original.code}
                            >
                                <Download className="h-4 w-4 text-muted-foreground" />
                            </TrackedLink>
                        ) : (
                            <Download className="h-4 w-4 text-muted-foreground/30" />
                        )}
                    </Button>
                </div>
            )
        },
    },
    {
        id: "sds",
        header: "SDS",
        cell: ({ row }) => {
            const viewUrl = row.original.sds_view_url
            const downloadUrl = row.original.sds_download_url
            return (
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" asChild={!!viewUrl} title="Ver SDS" disabled={!viewUrl}>
                        {viewUrl ? (
                            <TrackedLink
                                href={viewUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                fileName={row.original.name}
                                fileType="SDS (Vista)"
                                skuCode={row.original.code}
                            >
                                <ShieldAlert className="h-4 w-4 text-destructive" />
                            </TrackedLink>
                        ) : (
                            <ShieldAlert className="h-4 w-4 text-destructive/30" />
                        )}
                    </Button>
                    <Button variant="ghost" size="icon" asChild={!!downloadUrl} title="Descargar SDS" disabled={!downloadUrl}>
                        {downloadUrl ? (
                            <TrackedLink
                                href={downloadUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                fileName={row.original.name}
                                fileType="SDS (Descarga)"
                                skuCode={row.original.code}
                            >
                                <Download className="h-4 w-4 text-muted-foreground" />
                            </TrackedLink>
                        ) : (
                            <Download className="h-4 w-4 text-muted-foreground/30" />
                        )}
                    </Button>
                </div>
            )
        },
    },
]

// Search keys for Fuse.js
const SEARCH_KEYS = ["code", "name", "cas", "transport_name", "functional_category", "chemical_family", "disposition"]

export default function RawMaterialsPage() {
    const router = useRouter()
    const basePath = getBasePath()
    const [searchQuery, setSearchQuery] = useState("")
    const deferredSearchQuery = useDeferredValue(searchQuery)
    const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({})

    // Build filter options from data
    const filterConfigs: FilterConfig[] = useMemo(() => {
        const functionalCategories = Array.from(new Set(data.map(d => d.functional_category).filter(Boolean)))
        const transportNames = Array.from(new Set(data.map(d => d.transport_name).filter(Boolean))) as string[]
        const chemicalFamilies = Array.from(new Set(data.map(d => d.chemical_family).filter(Boolean)))
        const dispositions = Array.from(new Set(data.map(d => d.disposition).filter(Boolean)))

        return [
            {
                id: "functional_category",
                label: "Categoría Funcional",
                options: functionalCategories.map(c => ({
                    value: c,
                    label: c,
                    count: data.filter(d => d.functional_category === c).length,
                })),
            },
            {
                id: "transport_name",
                label: "Nombre de Transporte",
                options: transportNames.map(t => ({
                    value: t,
                    label: t,
                    count: data.filter(d => d.transport_name === t).length,
                })),
            },
            {
                id: "chemical_family",
                label: "Familia Química",
                options: chemicalFamilies.map(f => ({
                    value: f,
                    label: f,
                    count: data.filter(d => d.chemical_family === f).length,
                })),
            },
            {
                id: "disposition",
                label: "Disposición",
                options: dispositions.map(d => ({
                    value: d,
                    label: d,
                    count: data.filter(item => item.disposition === d).length,
                })),
            },
        ]
    }, [])

    // Fuse instance for fuzzy search
    const fuse = useMemo(() => {
        return new Fuse(data, {
            keys: SEARCH_KEYS,
            threshold: 0.3,
            ignoreLocation: true,
        })
    }, [])

    // Filter data based on search and filters
    const filteredData = useMemo(() => {
        let result = data

        // Apply search using deferred value
        if (deferredSearchQuery.trim()) {
            result = fuse.search(deferredSearchQuery).map(r => r.item)
        }

        // Apply filters
        Object.entries(activeFilters).forEach(([key, values]) => {
            if (values.length > 0) {
                result = result.filter(item => values.includes((item as any)[key]))
            }
        })

        return result
    }, [deferredSearchQuery, activeFilters, fuse])

    const handleFilterChange = useCallback((filterId: string, values: string[]) => {
        setActiveFilters(prev => ({
            ...prev,
            [filterId]: values,
        }))
    }, [])

    const handleClearAllFilters = useCallback(() => {
        setActiveFilters({})
    }, [])

    const handleRowClick = useCallback((row: RawMaterial) => {
        router.push(`${basePath}/catalog/raw-materials/${row.code}/`)
    }, [router, basePath])

    return (
        <div className="space-y-6">
            <Breadcrumbs
                items={[
                    { label: "Catálogo", href: "/catalog" },
                    { label: "Materias Primas" },
                ]}
            />

            <div className="space-y-2">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-[#0e0c9b] to-[#c41f1a] bg-clip-text text-transparent">
                    Materias Primas
                </h1>
                <p className="text-muted-foreground">
                    Consulta la documentación técnica y de seguridad de las materias primas.
                </p>
            </div>

            {/* Search and Filters */}
            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-4">
                    <SimpleSearchInput
                        value={searchQuery}
                        onChange={setSearchQuery}
                        placeholder="Buscar por código, nombre, CAS..."
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
    )
}
