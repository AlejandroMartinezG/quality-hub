import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LucideIcon } from "lucide-react"

interface InfoItem {
    label: string
    value: string | number | null | undefined
}

interface InfoCardProps {
    title: string
    icon?: LucideIcon
    items: InfoItem[]
}

export function InfoCard({ title, icon: Icon, items }: InfoCardProps) {
    const validItems = items.filter(item => item.value !== null && item.value !== undefined && item.value !== "")

    if (validItems.length === 0) {
        return null
    }

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                    {Icon && <Icon className="h-5 w-5 text-primary" />}
                    {title}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <dl className="grid gap-2">
                    {validItems.map((item, index) => (
                        <div key={index} className="flex justify-between items-center py-1.5 border-b last:border-0">
                            <dt className="text-sm text-muted-foreground">{item.label}</dt>
                            <dd className="text-sm font-medium">{item.value}</dd>
                        </div>
                    ))}
                </dl>
            </CardContent>
        </Card>
    )
}
