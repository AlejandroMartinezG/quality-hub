"use client"

import { logDownload } from "@/lib/audit"
import React from "react"

interface TrackedLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
    fileName: string
    fileType: string
    skuCode?: string
    children: React.ReactNode
}

export function TrackedLink({
    fileName,
    fileType,
    skuCode,
    children,
    onClick,
    ...props
}: TrackedLinkProps) {
    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
        // Log the action asynchronously
        logDownload({ fileName, fileType, skuCode })

        // Continue with the original onClick if any
        if (onClick) onClick(e)
    }

    return (
        <a {...props} onClick={handleClick}>
            {children}
        </a>
    )
}
