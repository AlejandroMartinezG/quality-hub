"use client"

import * as React from "react"
import { Filter, X, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

export interface FilterOption {
    value: string
    label: string
    count?: number
}

export interface FilterConfig {
    id: string
    label: string
    options: FilterOption[]
}

interface FiltersProps {
    filters: FilterConfig[]
    activeFilters: Record<string, string[]>
    onFilterChange: (filterId: string, values: string[]) => void
    onClearAll: () => void
}

export function Filters({
    filters,
    activeFilters,
    onFilterChange,
    onClearAll
}: FiltersProps) {
    const totalActiveFilters = Object.values(activeFilters).flat().length

    return (
        <div className="flex flex-wrap items-center gap-2">
            {filters.map((filter) => {
                const activeValues = activeFilters[filter.id] || []
                const hasActive = activeValues.length > 0

                return (
                    <Popover key={filter.id}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className={cn(
                                    "h-9",
                                    hasActive && "border-primary bg-primary/5"
                                )}
                            >
                                <Filter className="h-4 w-4 mr-2" />
                                {filter.label}
                                {hasActive && (
                                    <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                                        {activeValues.length}
                                    </Badge>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-0" align="start">
                            <div className="p-3 border-b">
                                <h4 className="font-semibold text-sm">{filter.label}</h4>
                            </div>
                            <div className="max-h-64 overflow-y-auto p-2">
                                {filter.options.map((option) => {
                                    const isSelected = activeValues.includes(option.value)
                                    return (
                                        <div
                                            key={option.value}
                                            className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted cursor-pointer"
                                            onClick={() => {
                                                const newValues = isSelected
                                                    ? activeValues.filter(v => v !== option.value)
                                                    : [...activeValues, option.value]
                                                onFilterChange(filter.id, newValues)
                                            }}
                                        >
                                            <Checkbox checked={isSelected} />
                                            <span className="flex-1 text-sm">{option.label}</span>
                                            {option.count !== undefined && (
                                                <span className="text-xs text-muted-foreground">
                                                    ({option.count})
                                                </span>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                            {hasActive && (
                                <>
                                    <Separator />
                                    <div className="p-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="w-full justify-center"
                                            onClick={() => onFilterChange(filter.id, [])}
                                        >
                                            <X className="h-4 w-4 mr-1" />
                                            Limpiar filtro
                                        </Button>
                                    </div>
                                </>
                            )}
                        </PopoverContent>
                    </Popover>
                )
            })}

            {totalActiveFilters > 0 && (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClearAll}
                    className="h-9 text-muted-foreground hover:text-foreground"
                >
                    <X className="h-4 w-4 mr-1" />
                    Limpiar todo ({totalActiveFilters})
                </Button>
            )}
        </div>
    )
}
