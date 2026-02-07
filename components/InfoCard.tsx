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
        <Card className="overflow-hidden rounded-[2rem] border-slate-200 dark:border-slate-800 shadow-sm transition-all duration-300 hover:shadow-md">
            <CardHeader className="pb-4 bg-muted/30 border-b border-border/50">
                <CardTitle className="text-lg font-bold flex items-center gap-3">
                    {Icon && (
                        <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-[#0e0c9b] dark:text-blue-400">
                            <Icon className="h-5 w-5" />
                        </div>
                    )}
                    {title}
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
                <dl className="grid gap-4">
                    {validItems.map((item, index) => (
                        <div key={index} className="flex justify-between items-center py-1 border-b border-border/50 last:border-0 last:pb-0">
                            <dt className="text-sm font-medium text-muted-foreground">{item.label}</dt>
                            <dd className="text-sm font-semibold text-right">{item.value}</dd>
                        </div>
                    ))}
                </dl>
            </CardContent>
        </Card>
    )
}
