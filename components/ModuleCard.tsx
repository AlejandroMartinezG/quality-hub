import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn, getBasePath } from "@/lib/utils"
import { LucideIcon } from "lucide-react"

interface ModuleCardProps {
    title: string
    description: string
    icon: LucideIcon
    href?: string
    disabled?: boolean
    badge?: string
    iconColor?: string
}

export function ModuleCard({
    title,
    description,
    icon: Icon,
    href,
    disabled = false,
    badge,
    iconColor
}: ModuleCardProps) {
    const basePath = getBasePath()
    const CardComponent = (
        <Card className={cn(
            "relative overflow-hidden transition-all duration-300",
            disabled
                ? "opacity-60 cursor-not-allowed"
                : "hover:shadow-lg hover:scale-[1.02] hover:border-primary/50 cursor-pointer"
        )}>
            {badge && (
                <div className="absolute top-3 right-3">
                    <Badge variant="secondary" className="text-xs">
                        {badge}
                    </Badge>
                </div>
            )}
            <CardHeader className="pb-2">
                <div className="flex items-center space-x-3">
                    <div
                        className={cn(
                            "flex h-12 w-12 items-center justify-center rounded-lg shadow-md",
                            disabled && "bg-muted"
                        )}
                        style={!disabled && iconColor ? { backgroundColor: iconColor } : undefined}
                    >
                        <Icon className="h-6 w-6 text-white" />
                    </div>
                    <CardTitle className="text-lg">{title}</CardTitle>
                </div>
            </CardHeader>
            <CardContent>
                <CardDescription className="text-sm">{description}</CardDescription>
            </CardContent>
        </Card>
    )

    if (disabled || !href) {
        return CardComponent
    }

    return (
        <Link href={`${basePath}${href}`} className="block">
            {CardComponent}
        </Link>
    )
}
