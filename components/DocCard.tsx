import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Eye, Download, FileText } from "lucide-react"

interface DocItem {
    label: string
    viewUrl: string | null
    downloadUrl: string | null
}

interface DocCardProps {
    title: string
    documents: DocItem[]
}

export function DocCard({ title, documents }: DocCardProps) {
    const availableDocs = documents.filter(doc => doc.viewUrl || doc.downloadUrl)

    if (availableDocs.length === 0) {
        return null
    }

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    {title}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {documents.map((doc, index) => (
                    <div
                        key={index}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                        <span className="text-sm font-medium">{doc.label}</span>
                        <div className="flex items-center gap-2">
                            {doc.viewUrl ? (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    asChild
                                >
                                    <a href={doc.viewUrl} target="_blank" rel="noopener noreferrer">
                                        <Eye className="h-4 w-4 mr-1" />
                                        Ver
                                    </a>
                                </Button>
                            ) : (
                                <Button variant="outline" size="sm" disabled>
                                    <Eye className="h-4 w-4 mr-1" />
                                    Ver
                                </Button>
                            )}
                            {doc.downloadUrl ? (
                                <Button
                                    variant="default"
                                    size="sm"
                                    asChild
                                >
                                    <a href={doc.downloadUrl} target="_blank" rel="noopener noreferrer">
                                        <Download className="h-4 w-4 mr-1" />
                                        Descargar
                                    </a>
                                </Button>
                            ) : (
                                <Button variant="default" size="sm" disabled>
                                    <Download className="h-4 w-4 mr-1" />
                                    Descargar
                                </Button>
                            )}
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
    )
}
