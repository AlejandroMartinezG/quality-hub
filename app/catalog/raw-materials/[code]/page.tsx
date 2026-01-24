import { notFound } from "next/navigation"
import { Breadcrumbs } from "@/components/Breadcrumbs"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { InfoCard } from "@/components/InfoCard"
import { RawMaterial } from "@/lib/types"
import { FlaskConical, Truck, Warehouse, FileText, ShieldAlert, BadgeCheck, Eye, Download } from "lucide-react"

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
            <div className="space-y-6">
                <div className="space-y-1">
                    <h2 className="text-2xl font-bold text-slate-900">Documentación del Producto</h2>
                    <p className="text-slate-500 text-sm">
                        Documentos disponibles para {material.name}
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                        {
                            label: "Ficha Técnica (TDS)",
                            desc: "Especificaciones técnicas del producto",
                            icon: <FileText className="h-6 w-6 text-blue-600" />,
                            viewUrl: material.tds_view_url,
                            downloadUrl: material.tds_download_url
                        },
                        {
                            label: "Hoja de Seguridad (SDS)",
                            desc: "Información de seguridad y manejo",
                            icon: <ShieldAlert className="h-6 w-6 text-red-600" />,
                            viewUrl: material.sds_view_url,
                            downloadUrl: material.sds_download_url
                        },
                        {
                            label: "Certificado de Análisis — CEDIS",
                            desc: "Certificado de análisis del centro de distribución",
                            icon: <BadgeCheck className="h-6 w-6 text-green-600" />,
                            viewUrl: material.coa_cedis_view_url,
                            downloadUrl: material.coa_cedis_download_url
                        },
                        {
                            label: "Certificado de Análisis — Sucursales",
                            desc: "Certificado de análisis de sucursales",
                            icon: <BadgeCheck className="h-6 w-6 text-green-600" />,
                            viewUrl: material.coa_branches_view_url,
                            downloadUrl: material.coa_branches_download_url
                        },
                        {
                            label: "Información de Etiquetado",
                            desc: "Diseño y contenido de etiquetas",
                            icon: <div className="p-1 rounded-md bg-slate-100 text-slate-600"><FileText className="h-6 w-6" /></div>,
                            viewUrl: material.label_view_url,
                            downloadUrl: material.label_download_url
                        },
                    ].map((doc, i) => (
                        <Card key={i} className="rounded-xl border shadow-sm">
                            <CardContent className="p-5">
                                <div className="flex items-start gap-4 mb-4">
                                    <div className="shrink-0 p-3 rounded-xl bg-slate-50 border border-slate-100">
                                        {doc.icon}
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="font-bold text-slate-800">{doc.label}</h3>
                                        <p className="text-xs text-slate-500">{doc.desc}</p>
                                    </div>
                                </div>
                                <div className="flex gap-2 pt-2">
                                    <Button variant="outline" size="sm" className="flex-1 gap-1.5" disabled={!doc.viewUrl} asChild>
                                        <a href={doc.viewUrl || "#"} target="_blank" rel="noopener noreferrer">
                                            <Eye className="h-3.5 w-3.5" />
                                            Ver
                                        </a>
                                    </Button>
                                    <Button size="sm" className="flex-1 gap-1.5" disabled={!doc.downloadUrl} asChild>
                                        <a href={doc.downloadUrl || "#"} target="_blank" rel="noopener noreferrer">
                                            <Download className="h-3.5 w-3.5" />
                                            Descargar
                                        </a>
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    )
}
