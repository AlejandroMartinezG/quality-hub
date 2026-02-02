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

export default function ProductDetailPage({ params }: PageProps) {
    const family = data.families.find(f => f.slug === params.family)
    const category = family?.categories.find(c => c.slug === params.category)
    const product = category?.products.find(p => p.sku_code === params.sku)

    if (!family || !category || !product) {
        notFound()
    }

    const statusVariant = product.status === "Activo" ? "success" : "secondary"

    return (
        <div className="space-y-8">
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
            <div className="flex flex-col md:flex-row md:items-start gap-6 bg-card p-6 rounded-2xl border shadow-sm transition-colors duration-300">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-700 text-white shadow-lg shrink-0">
                    <Package className="h-10 w-10 text-white/90" />
                </div>
                <div className="space-y-3 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-muted-foreground font-mono tracking-wider bg-muted px-2 py-0.5 rounded-md">
                            {product.sku_code}
                        </span>
                        <Badge variant="outline" className="text-muted-foreground font-medium">
                            {category.name}
                        </Badge>
                        <Badge variant={statusVariant} className="px-3">
                            {product.status}
                        </Badge>
                    </div>
                    <div className="space-y-1">
                        <h1 className="text-3xl font-bold text-foreground truncate">
                            {product.variant || product.base_product}
                        </h1>
                        {product.variant && (
                            <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 border-indigo-100 gap-1.5 px-3 py-1 text-sm font-medium">
                                <Beaker className="h-4 w-4" />
                                {product.base_product}
                            </Badge>
                        )}
                    </div>
                </div>
            </div>

            {/* Info Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="rounded-2xl border shadow-sm">
                    <CardHeader className="pb-3 border-b bg-muted/30 rounded-t-2xl">
                        <CardTitle className="text-lg flex items-center gap-2 text-foreground">
                            <Info className="h-5 w-5 text-indigo-600" />
                            Información General
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                        <dl className="space-y-4">
                            {[
                                { label: "Estado", value: <Badge variant={statusVariant}>{product.status}</Badge> },
                                { label: "Fecha de Alta", value: "12/02/2021" },
                                {
                                    label: "Última Actualización",
                                    value: product.updated_at ? new Date(product.updated_at).toLocaleDateString("es-MX") : "N/A"
                                },
                                { label: "Categoría", value: category.name },
                            ].map((item, i) => (
                                <div key={i} className="flex justify-between items-center text-sm border-b border-border pb-2 last:border-0 last:pb-0">
                                    <dt className="text-muted-foreground">{item.label}:</dt>
                                    <dd className="font-semibold text-foreground/80">{item.value}</dd>
                                </div>
                            ))}
                        </dl>
                    </CardContent>
                </Card>

                <Card className="rounded-2xl border shadow-sm">
                    <CardHeader className="pb-3 border-b bg-muted/30 rounded-t-2xl">
                        <CardTitle className="text-lg flex items-center gap-2 text-foreground">
                            <Beaker className="h-5 w-5 text-indigo-600" />
                            Formulación
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                        <dl className="space-y-4">
                            {[
                                { label: "Versión Formulación", value: "v2.0" },
                                { label: "Versión Manual", value: "Manual de Calidad v4.1" },
                                { label: "Páginas del Manual", value: "23-30" },
                            ].map((item, i) => (
                                <div key={i} className="flex justify-between items-center text-sm border-b border-border pb-2 last:border-0 last:pb-0">
                                    <dt className="text-muted-foreground">{item.label}:</dt>
                                    <dd className="font-semibold text-foreground/80">{item.value}</dd>
                                </div>
                            ))}
                        </dl>
                    </CardContent>
                </Card>
            </div>

            {/* Documentation Section */}
            <div className="space-y-6">
                <div className="space-y-1">
                    <h2 className="text-2xl font-bold text-foreground">Documentación del Producto</h2>
                    <p className="text-muted-foreground text-sm">
                        Documentos disponibles para {product.variant || product.base_product}
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                        {
                            label: "Ficha Técnica (TDS)",
                            desc: "Especificaciones técnicas del producto",
                            icon: <FileText className="h-6 w-6 text-blue-600" />,
                            viewUrl: product.tds_view_url,
                            downloadUrl: product.tds_download_url
                        },
                        {
                            label: "Hoja de Seguridad (SDS)",
                            desc: "Información de seguridad y manejo",
                            icon: <ShieldAlert className="h-6 w-6 text-red-600" />,
                            viewUrl: product.sds_view_url,
                            downloadUrl: product.sds_download_url
                        },
                        {
                            label: "Parámetros de Calidad Internos",
                            desc: "Estándares de calidad y control",
                            icon: <BadgeCheck className="h-6 w-6 text-green-600" />,
                            viewUrl: product.coa_view_url,
                            downloadUrl: product.coa_download_url
                        },
                        {
                            label: "Información de Etiquetado",
                            desc: "Diseño y contenido de etiquetas",
                            icon: <div className="p-1 rounded-md bg-muted text-foreground/70"><FileText className="h-6 w-6" /></div>,
                            viewUrl: product.label_view_url,
                            downloadUrl: product.label_download_url
                        },
                    ].map((doc, i) => (
                        <Card key={i} className="rounded-xl border shadow-sm">
                            <CardContent className="p-5">
                                <div className="flex items-start gap-4 mb-4">
                                    <div className="shrink-0 p-3 rounded-xl bg-muted/50 border border-border">
                                        {doc.icon}
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="font-bold text-foreground">{doc.label}</h3>
                                        <p className="text-xs text-muted-foreground">{doc.desc}</p>
                                    </div>
                                </div>
                                <div className="flex gap-2 pt-2">
                                    <Button variant="outline" size="sm" className="flex-1 gap-1.5" disabled={!doc.viewUrl} asChild>
                                        <TrackedLink
                                            href={doc.viewUrl || "#"}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            fileName={product.variant || product.base_product}
                                            fileType={`${doc.label} (Vista)`}
                                            skuCode={product.sku_code}
                                        >
                                            <Eye className="h-3.5 w-3.5" />
                                            Ver
                                        </TrackedLink>
                                    </Button>
                                    <Button size="sm" className="flex-1 gap-1.5" disabled={!doc.downloadUrl} asChild>
                                        <TrackedLink
                                            href={doc.downloadUrl || "#"}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            fileName={product.variant || product.base_product}
                                            fileType={`${doc.label} (Descarga)`}
                                            skuCode={product.sku_code}
                                        >
                                            <Download className="h-3.5 w-3.5" />
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
