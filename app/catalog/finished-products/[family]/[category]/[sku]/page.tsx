import { notFound } from "next/navigation"
import { Breadcrumbs } from "@/components/Breadcrumbs"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FinishedProduct, FinishedProductsData } from "@/lib/types"
import { TrackedLink } from "@/components/TrackedLink"
import { Package, Info, Calendar, Beaker, FileText, ShieldAlert, BadgeCheck, Eye, Download, Sparkles } from "lucide-react"

import finishedProductsData from "@/data/finished-products.json"

const data: FinishedProductsData = finishedProductsData as FinishedProductsData

export function generateStaticParams() {
    const params: { family: string; category: string; sku: string }[] = []

    data.families.forEach((family) => {
        family.categories.forEach((category) => {
            category.products.forEach((product) => {
                params.push({
                    family: family.slug,
                    category: category.slug,
                    sku: product.sku_code,
                })
            })
        })
    })

    return params
}

interface PageProps {
    params: { family: string; category: string; sku: string }
}

// Helper for status badge
const getStatusColor = (status: string) => {
    if (status === "Activo") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800";
    if (status === "Inactivo") return "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-400 border-slate-200 dark:border-slate-800";
    return "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-400 border-slate-200 dark:border-slate-800";
};

import { cn } from "@/lib/utils"

export default function ProductDetailPage({ params }: PageProps) {
    const family = data.families.find(f => f.slug === params.family)
    const category = family?.categories.find(c => c.slug === params.category)
    const product = category?.products.find(p => p.sku_code === params.sku)

    if (!family || !category || !product) {
        notFound()
    }

    return (
        <div className="space-y-8 pb-10">
            <Breadcrumbs
                items={[
                    { label: "Catálogo", href: "/catalog" },
                    { label: "Productos Terminados", href: "/catalog/finished-products" },
                    { label: family.name, href: `/catalog/finished-products/${family.slug}` },
                    { label: category.name, href: `/catalog/finished-products/${family.slug}/${category.slug}` },
                    { label: product.sku_code },
                ]}
            />

            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-start gap-6 bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                    <Package className="h-64 w-64 transform -rotate-12" />
                </div>

                <div className="flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-gradient-to-br from-[#0e0c9b] to-[#2a28b5] text-white shadow-lg shrink-0 z-10">
                    <Package className="h-10 w-10 text-white/90" />
                </div>
                <div className="space-y-4 flex-1 min-w-0 z-10">
                    <div className="flex flex-wrap items-center gap-3">
                        <span className="text-sm font-bold text-slate-500 font-mono tracking-wider bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700">
                            {product.sku_code}
                        </span>
                        <Badge variant="outline" className="rounded-full px-3 py-0.5 text-sm font-medium border bg-slate-50 text-slate-600">
                            {category.name}
                        </Badge>
                        <Badge variant="outline" className={cn("rounded-full px-3 py-0.5 text-sm font-medium border", getStatusColor(product.status))}>
                            {product.status}
                        </Badge>
                    </div>
                    <div className="space-y-1">
                        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white tracking-tight break-words">
                            {product.variant || product.base_product}
                        </h1>
                        {product.variant && (
                            <div className="flex items-center gap-2 text-muted-foreground pt-1">
                                <Beaker className="h-4 w-4" />
                                <span className="font-medium">Base: {product.base_product}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Info Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="rounded-[2rem] border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
                    <CardHeader className="pb-4 bg-muted/30 border-b border-border/50">
                        <CardTitle className="text-lg font-bold flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-[#0e0c9b] dark:text-blue-400">
                                <Info className="h-5 w-5" />
                            </div>
                            Información General
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <dl className="grid gap-4">
                            {[
                                { label: "Estado", value: <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold border", getStatusColor(product.status))}>{product.status}</Badge> },
                                { label: "Fecha de Alta", value: "12/02/2021" },
                                {
                                    label: "Última Actualización",
                                    value: product.updated_at ? new Date(product.updated_at).toLocaleDateString("es-MX") : "N/A"
                                },
                                { label: "Categoría", value: category.name },
                            ].map((item, i) => (
                                <div key={i} className="flex justify-between items-center py-1 border-b border-border/50 last:border-0 last:pb-0">
                                    <dt className="text-sm font-medium text-muted-foreground">{item.label}</dt>
                                    <dd className="text-sm font-semibold text-right">{item.value}</dd>
                                </div>
                            ))}
                        </dl>
                    </CardContent>
                </Card>

                <Card className="rounded-[2rem] border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
                    <CardHeader className="pb-4 bg-muted/30 border-b border-border/50">
                        <CardTitle className="text-lg font-bold flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-[#0e0c9b] dark:text-blue-400">
                                <Beaker className="h-5 w-5" />
                            </div>
                            Formulación
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <dl className="grid gap-4">
                            {[
                                { label: "Versión Formulación", value: "v2.0" },
                                { label: "Versión Manual", value: "Manual de Calidad v4.1" },
                                { label: "Páginas del Manual", value: "23-30" },
                            ].map((item, i) => (
                                <div key={i} className="flex justify-between items-center py-1 border-b border-border/50 last:border-0 last:pb-0">
                                    <dt className="text-sm font-medium text-muted-foreground">{item.label}</dt>
                                    <dd className="text-sm font-semibold text-right">{item.value}</dd>
                                </div>
                            ))}
                        </dl>
                    </CardContent>
                </Card>
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
                            viewUrl: product.tds_view_url,
                            downloadUrl: product.tds_download_url
                        },
                        {
                            label: "Hoja de Seguridad (SDS)",
                            desc: "Información de seguridad y manejo",
                            icon: <ShieldAlert className="h-6 w-6 text-[#c41f1a]" />,
                            viewUrl: product.sds_view_url,
                            downloadUrl: product.sds_download_url
                        },
                        {
                            label: "Parámetros de Calidad Internos",
                            desc: "Estándares de calidad y control",
                            icon: <BadgeCheck className="h-6 w-6 text-emerald-600" />,
                            viewUrl: product.coa_view_url,
                            downloadUrl: product.coa_download_url
                        },
                        {
                            label: "Información de Etiquetado",
                            desc: "Diseño y contenido de etiquetas",
                            icon: <div className="text-slate-600"><FileText className="h-6 w-6" /></div>,
                            viewUrl: product.label_view_url,
                            downloadUrl: product.label_download_url
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
                                        <TrackedLink
                                            href={doc.viewUrl || "#"}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            fileName={product.variant || product.base_product}
                                            fileType={`${doc.label} (Vista)`}
                                            skuCode={product.sku_code}
                                        >
                                            <Eye className="h-4 w-4" />
                                            Ver
                                        </TrackedLink>
                                    </Button>
                                    <Button size="sm" className="flex-1 gap-2 rounded-full font-medium bg-[#0e0c9b] hover:bg-[#0e0c9b]/90 text-white shadow-md hover:shadow-lg transition-all" disabled={!doc.downloadUrl} asChild>
                                        <TrackedLink
                                            href={doc.downloadUrl || "#"}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            fileName={product.variant || product.base_product}
                                            fileType={`${doc.label} (Descarga)`}
                                            skuCode={product.sku_code}
                                        >
                                            <Download className="h-4 w-4" />
                                            Descargar
                                        </TrackedLink>
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
