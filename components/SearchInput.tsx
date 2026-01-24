"use client"

import * as React from "react"
import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import Fuse from "fuse.js"

interface SearchInputProps<T> {
    data: T[]
    searchKeys: string[]
    onResults: (results: T[]) => void
    placeholder?: string
}

export function SearchInput<T>({
    data,
    searchKeys,
    onResults,
    placeholder = "Buscar..."
}: SearchInputProps<T>) {
    const [query, setQuery] = React.useState("")

    const fuse = React.useMemo(() => {
        return new Fuse(data, {
            keys: searchKeys,
            threshold: 0.3,
            ignoreLocation: true,
        })
    }, [data, searchKeys])

    React.useEffect(() => {
        if (query.trim() === "") {
            onResults(data)
        } else {
            const results = fuse.search(query).map(result => result.item)
            onResults(results)
        }
    }, [query, data, fuse, onResults])

    return (
        <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
                type="text"
                placeholder={placeholder}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9 pr-9"
            />
            {query && (
                <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 p-0"
                    onClick={() => setQuery("")}
                >
                    <X className="h-4 w-4" />
                </Button>
            )}
        </div>
    )
}

// Simple controlled search input
interface SimpleSearchInputProps {
    value: string
    onChange: (value: string) => void
    placeholder?: string
}

export function SimpleSearchInput({
    value,
    onChange,
    placeholder = "Buscar..."
}: SimpleSearchInputProps) {
    return (
        <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
                type="text"
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="pl-9 pr-9"
            />
            {value && (
                <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 p-0"
                    onClick={() => onChange("")}
                >
                    <X className="h-4 w-4" />
                </Button>
            )}
        </div>
    )
}
