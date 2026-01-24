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
import Fuse from "fuse.js"

// Import data - will be generated at build time
import rawMaterialsData from "@/data/raw-materials.json"

const data: RawMaterial[] = rawMaterialsData as RawMaterial[]

const columns: ColumnDef<RawMaterial>[] = [
    {
        accessorKey: "code",
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                >
                    Código
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            )
        },
        cell: ({ row }) => (
            <span className="font-mono font-medium">{row.getValue("code")}</span>
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
                    Nombre
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            )
        },
        cell: ({ row }) => (
            <span className="font-bold">{row.getValue("name")}</span>
        ),
    },
    {
        accessorKey: "transport_name",
        header: "Nombre de Transporte",
    },
    {
        accessorKey: "functional_category",
        header: "Categoría Funcional",
        cell: ({ row }) => (
            <Badge variant="secondary">{row.getValue("functional_category")}</Badge>
        ),
    },
    {
        accessorKey: "chemical_family",
        header: "Familia Química",
    },
    {
        accessorKey: "disposition",
        header: "Disposición",
        cell: ({ row }) => {
            const disposition = row.getValue("disposition") as string
            const variant = disposition === "Aprobado" ? "success" :
                disposition === "Rechazado" ? "destructive" : "warning"
            return <Badge variant={variant}>{disposition}</Badge>
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
                            <a href={viewUrl} target="_blank" rel="noopener noreferrer">
                                <Eye className="h-4 w-4 text-[#16149a]" />
                            </a>
                        ) : (
                            <Eye className="h-4 w-4 text-[#16149a]/30" />
                        )}
                    </Button>
                    <Button variant="ghost" size="icon" asChild={!!downloadUrl} title="Descargar TDS" disabled={!downloadUrl}>
                        {downloadUrl ? (
                            <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
                                <Download className="h-4 w-4 text-slate-600" />
                            </a>
                        ) : (
                            <Download className="h-4 w-4 text-slate-400/30" />
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
                            <a href={viewUrl} target="_blank" rel="noopener noreferrer">
                                <ShieldAlert className="h-4 w-4 text-[#c32420]" />
                            </a>
                        ) : (
                            <ShieldAlert className="h-4 w-4 text-[#c32420]/30" />
                        )}
                    </Button>
                    <Button variant="ghost" size="icon" asChild={!!downloadUrl} title="Descargar SDS" disabled={!downloadUrl}>
                        {downloadUrl ? (
                            <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
                                <Download className="h-4 w-4 text-slate-600" />
                            </a>
                        ) : (
                            <Download className="h-4 w-4 text-slate-400/30" />
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
                <h1 className="text-3xl font-bold" style={{ textShadow: '2px 2px 4px rgba(0, 0, 0, 0.1)' }}>Materias Primas</h1>
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
