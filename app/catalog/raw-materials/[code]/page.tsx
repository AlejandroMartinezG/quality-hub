import { notFound } from "next/navigation"
import { Breadcrumbs } from "@/components/Breadcrumbs"
import { Badge } from "@/components/ui/badge"
import { InfoCard } from "@/components/InfoCard"
import { DocCard } from "@/components/DocCard"
import { RawMaterial } from "@/lib/types"
import { FlaskConical, Shield, Truck, Warehouse } from "lucide-react"

import rawMaterialsData from "@/data/raw-materials.json"

const data: RawMaterial[] = rawMaterialsData as RawMaterial[]

export function generateStaticParams() {
    return data.map((item) => ({
        code: item.code,
    }))
}

interface PageProps {
    params: { code: string }
}

export default function RawMaterialDetailPage({ params }: PageProps) {
    const material = data.find(m => m.code === params.code)

    if (!material) {
        notFound()
    }

    const dispositionVariant =
        material.disposition === "Aprobado" ? "success" :
            material.disposition === "Rechazado" ? "destructive" : "warning"

    return (
        <div className="space-y-8">
            <Breadcrumbs
                items={[
                    { label: "Catálogo", href: "/catalog" },
                    { label: "Materias Primas", href: "/catalog/raw-materials" },
                    { label: material.code },
                ]}
            />

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-start gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg">
                    <FlaskConical className="h-8 w-8" />
                </div>
                <div className="space-y-3 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-slate-500 font-mono tracking-wider bg-slate-100 px-2 py-0.5 rounded-md">
                            {material.code}
                        </span>
                        <Badge variant="secondary" className="font-medium text-slate-600">
                            {material.functional_category}
                        </Badge>
                        <Badge variant={dispositionVariant} className="px-3">
                            {material.disposition}
                        </Badge>
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
                        {material.name}
                    </h1>
                </div>
            </div>

            {/* Info Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <InfoCard
                    title="Clasificación Química"
                    icon={FlaskConical}
                    items={[
                        { label: "CAS", value: material.cas },
                        { label: "Familia Química", value: material.chemical_family },
                        { label: "Categoría Funcional", value: material.functional_category },
                    ]}
                />
                <InfoCard
                    title="Seguridad y Transporte"
                    icon={Truck}
                    items={[
                        { label: "Nombre de Transporte", value: material.transport_name },
                        { label: "Disposición", value: material.disposition },
                    ]}
                />
                <InfoCard
                    title="Información de Almacén"
                    icon={Warehouse}
                    items={[
                        { label: "Proveedor", value: material.provider },
                        { label: "Código Proveedor", value: material.provider_code },
                        { label: "Tiempo de Entrega", value: material.lead_time_days ? `${material.lead_time_days} días` : null },
                    ]}
                />
            </div>

            {/* Documentation Section */}
            <DocCard
                title="Documentación"
                documents={[
                    {
                        label: "Ficha Técnica (TDS)",
                        viewUrl: material.tds_view_url,
                        downloadUrl: material.tds_download_url,
                    },
                    {
                        label: "Hoja de Seguridad (SDS)",
                        viewUrl: material.sds_view_url,
                        downloadUrl: material.sds_download_url,
                    },
                    {
                        label: "Certificado de Análisis — CEDIS",
                        viewUrl: material.coa_cedis_view_url,
                        downloadUrl: material.coa_cedis_download_url,
                    },
                    {
                        label: "Certificado de Análisis — Sucursales",
                        viewUrl: material.coa_branches_view_url,
                        downloadUrl: material.coa_branches_download_url,
                    },
                    {
                        label: "Información de Etiquetado",
                        viewUrl: material.label_view_url,
                        downloadUrl: material.label_download_url,
                    },
                ]}
            />
        </div>
    )
}
