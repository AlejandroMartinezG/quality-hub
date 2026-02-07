import { notFound } from "next/navigation"
import { Breadcrumbs } from "@/components/Breadcrumbs"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { InfoCard } from "@/components/InfoCard"
import { RawMaterial } from "@/lib/types"
import { FlaskConical, Truck, Warehouse, FileText, ShieldAlert, BadgeCheck, Eye, Download } from "lucide-react"
import { TrackedLink } from "@/components/TrackedLink"

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

// Helper functions for badge colors
const getFunctionalCategoryColor = (category: string) => {
    const normalized = category.toLowerCase();
    if (normalized.includes("activo")) return "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 border-blue-200 dark:border-blue-800";
    if (normalized.includes("funcional")) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800";
    if (normalized.includes("control")) return "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400 border-orange-200 dark:border-orange-800";
    if (normalized.includes("proceso")) return "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-400 border-slate-200 dark:border-slate-800";
    return "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400 border-violet-200 dark:border-violet-800";
};

const getDispositionColor = (disposition: string) => {
    const normalized = disposition.toLowerCase();
    if (normalized.includes("general")) return "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400 border-green-200 dark:border-green-800";
    if (normalized.includes("restringido")) return "bg-[#c41f1a]/10 text-[#c41f1a] dark:bg-[#c41f1a]/20 dark:text-[#ff4d4d] border-[#c41f1a]/20 dark:border-[#c41f1a]/40";
    return "bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-400 border-gray-200 dark:border-gray-800";
};

import { cn } from "@/lib/utils"

export default function RawMaterialDetailPage({ params }: PageProps) {
    const material = data.find(m => m.code === params.code)

    if (!material) {
        notFound()
    }

    return (
        <div className="space-y-8 pb-10">
            <Breadcrumbs
                items={[
                    { label: "Catálogo", href: "/catalog" },
                    { label: "Materias Primas", href: "/catalog/raw-materials" },
                    { label: material.code },
                ]}
            />

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-start gap-6 bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                    <FlaskConical className="h-64 w-64 transform rotate-12" />
                </div>

                <div className="flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-gradient-to-br from-[#0e0c9b] to-[#2a28b5] text-white shadow-lg shrink-0 z-10">
                    <FlaskConical className="h-10 w-10 text-white/90" />
                </div>
                <div className="space-y-4 flex-1 min-w-0 z-10">
                    <div className="flex flex-wrap items-center gap-3">
                        <span className="text-sm font-bold text-slate-500 font-mono tracking-wider bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700">
                            {material.code}
                        </span>
                        <Badge variant="outline" className={cn("rounded-full px-3 py-0.5 text-sm font-medium border", getFunctionalCategoryColor(material.functional_category))}>
                            {material.functional_category}
                        </Badge>
                        <Badge variant="outline" className={cn("rounded-full px-3 py-0.5 text-sm font-medium border", getDispositionColor(material.disposition))}>
                            {material.disposition}
                        </Badge>
                    </div>
                    <div className="space-y-1">
                        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">
                            {material.name}
                        </h1>
                        <p className="text-muted-foreground text-lg">
                            {material.chemical_family}
                        </p>
                    </div>
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
                <div className="flex items-center gap-3 border-b pb-4">
                    <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl">
                        <FileText className="h-6 w-6 text-slate-600 dark:text-slate-400" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-foreground">Documentación del Producto</h2>
                        <p className="text-muted-foreground text-sm">
                            Documentos técnicos y de seguridad disponibles para descarga
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                        {
                            label: "Ficha Técnica (TDS)",
                            desc: "Especificaciones técnicas del producto",
                            icon: <FileText className="h-6 w-6 text-[#0e0c9b]" />,
                            viewUrl: material.tds_view_url,
                            downloadUrl: material.tds_download_url
                        },
                        {
                            label: "Hoja de Seguridad (SDS)",
                            desc: "Información de seguridad y manejo",
                            icon: <ShieldAlert className="h-6 w-6 text-[#c41f1a]" />,
                            viewUrl: material.sds_view_url,
                            downloadUrl: material.sds_download_url
                        },
                        {
                            label: "Certificado de Análisis — CEDIS",
                            desc: "Certificado de análisis del centro de distribución",
                            icon: <BadgeCheck className="h-6 w-6 text-emerald-600" />,
                            viewUrl: material.coa_cedis_view_url,
                            downloadUrl: material.coa_cedis_download_url
                        },
                        {
                            label: "Certificado de Análisis — Sucursales",
                            desc: "Certificado de análisis de sucursales",
                            icon: <BadgeCheck className="h-6 w-6 text-emerald-600" />,
                            viewUrl: material.coa_branches_view_url,
                            downloadUrl: material.coa_branches_download_url
                        },
                        {
                            label: "Información de Etiquetado",
                            desc: "Diseño y contenido de etiquetas",
                            icon: <div className="text-slate-600"><FileText className="h-6 w-6" /></div>,
                            viewUrl: material.label_view_url,
                            downloadUrl: material.label_download_url
                        },
                    ].map((doc, i) => (
                        <Card key={i} className="rounded-[2rem] border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden group">
                            <CardContent className="p-6">
                                <div className="flex items-start gap-4 mb-6">
                                    <div className="shrink-0 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 group-hover:scale-110 transition-transform duration-300">
                                        {doc.icon}
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="font-bold text-foreground text-lg">{doc.label}</h3>
                                        <p className="text-sm text-muted-foreground">{doc.desc}</p>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <Button variant="outline" size="sm" className="flex-1 gap-2 rounded-full font-medium border-slate-200 hover:bg-slate-50 hover:text-[#0e0c9b] transition-colors" disabled={!doc.viewUrl} asChild>
                                        {doc.viewUrl ? (
                                            <TrackedLink
                                                href={doc.viewUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                fileName={`${doc.label} - ${material.name}`}
                                                fileType={`${doc.label} (Vista)`}
                                                skuCode={material.code}
                                            >
                                                <Eye className="h-4 w-4" />
                                                Ver
                                            </TrackedLink>
                                        ) : (
                                            <span>
                                                <Eye className="h-4 w-4" />
                                                Ver
                                            </span>
                                        )}
                                    </Button>
                                    <Button size="sm" className="flex-1 gap-2 rounded-full font-medium bg-[#0e0c9b] hover:bg-[#0e0c9b]/90 text-white shadow-md hover:shadow-lg transition-all" disabled={!doc.downloadUrl} asChild>
                                        {doc.downloadUrl ? (
                                            <TrackedLink
                                                href={doc.downloadUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                fileName={`${doc.label} - ${material.name}`}
                                                fileType={`${doc.label} (Descarga)`}
                                                skuCode={material.code}
                                            >
                                                <Download className="h-4 w-4" />
                                                Descargar
                                            </TrackedLink>
                                        ) : (
                                            <span>
                                                <Download className="h-4 w-4" />
                                                Descargar
                                            </span>
                                        )}
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
