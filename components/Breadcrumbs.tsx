import * as React from "react"
import { ChevronRight, Home } from "lucide-react"
import Link from "next/link"
import { getBasePath } from "@/lib/utils"

export interface BreadcrumbItem {
    label: string
    href?: string
}

interface BreadcrumbsProps {
    items: BreadcrumbItem[]
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
    const basePath = getBasePath()

    return (
        <nav className="flex items-center space-x-1 text-sm text-muted-foreground mb-6">
            <Link
                href={`${basePath}/`}
                className="flex items-center hover:text-foreground transition-colors"
            >
                <Home className="h-4 w-4" />
            </Link>
            {items.map((item, index) => (
                <React.Fragment key={index}>
                    <ChevronRight className="h-4 w-4" />
                    {item.href ? (
                        <Link
                            href={`${basePath}${item.href}`}
                            className="hover:text-foreground transition-colors"
                        >
                            {item.label}
                        </Link>
                    ) : (
                        <span className="text-foreground font-medium">{item.label}</span>
                    )}
                </React.Fragment>
            ))}
        </nav>
    )
}
