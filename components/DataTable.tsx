"use client"

import * as React from "react"
import {
    ColumnDef,
    ColumnFiltersState,
    SortingState,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

interface DataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[]
    data: TData[]
    onRowClick?: (row: TData) => void
    renderMobileItem?: (row: TData) => React.ReactNode
    globalFilter?: string
    columnFilters?: ColumnFiltersState
}

const DEFAULT_COLUMN_FILTERS: ColumnFiltersState = []
const DEFAULT_GLOBAL_FILTER = ""

export function DataTable<TData, TValue>({
    columns,
    data,
    onRowClick,
    renderMobileItem,
    globalFilter = DEFAULT_GLOBAL_FILTER,
    columnFilters = DEFAULT_COLUMN_FILTERS,
}: DataTableProps<TData, TValue>) {
    const [sorting, setSorting] = React.useState<SortingState>([])

    const table = useReactTable({
        data,
        columns,
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        state: {
            sorting,
            globalFilter,
            columnFilters,
        },
        initialState: {
            pagination: {
                pageSize: 10,
            },
        },
    })

    return (
        <div className="space-y-4">
            {/* Desktop Table View */}
            <div className={cn(
                "rounded-[2.5rem] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm transition-all duration-300 hover:shadow-md",
                renderMobileItem ? "hidden md:block" : "block overflow-x-auto"
            )}>
                <Table>
                    <TableHeader className="bg-[#0e0c9b]">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id} className="hover:bg-[#0e0c9b]/90 border-b-0">
                                {headerGroup.headers.map((header) => (
                                    <TableHead key={header.id} className="text-white font-bold h-12 first:pl-6 last:pr-6 text-nowrap">
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(
                                                header.column.columnDef.header,
                                                header.getContext()
                                            )}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    data-state={row.getIsSelected() && "selected"}
                                    className={cn(
                                        "transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 border-slate-100 dark:border-slate-800",
                                        onRowClick && "cursor-pointer"
                                    )}
                                    onClick={() => onRowClick?.(row.original)}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id} className="first:pl-6 last:pr-6 py-4">
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext()
                                            )}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell
                                    colSpan={columns.length}
                                    className="h-24 text-center text-muted-foreground"
                                >
                                    No se encontraron resultados.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Mobile Card View */}
            {renderMobileItem && (
                <div className="md:hidden space-y-4">
                    {table.getRowModel().rows?.length ? (
                        table.getRowModel().rows.map((row) => (
                            <div
                                key={row.id}
                                onClick={() => onRowClick?.(row.original)}
                                className={cn(
                                    "p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm transition-all active:scale-[0.98]",
                                    onRowClick && "cursor-pointer"
                                )}
                            >
                                {renderMobileItem(row.original)}
                            </div>
                        ))
                    ) : (
                        <div className="p-8 text-center bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-muted-foreground">
                            No se encontraron resultados.
                        </div>
                    )}
                </div>
            )}

            {/* Pagination Controls (Shared) */}
            <div className="flex flex-col sm:flex-row items-center justify-between px-2 gap-4 mt-2">
                <div className="text-sm text-muted-foreground order-2 sm:order-1">
                    {table.getFilteredRowModel().rows.length} registro(s) encontrado(s)
                </div>
                <div className="flex items-center space-x-2 order-1 sm:order-2">
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-lg"
                        onClick={() => table.setPageIndex(0)}
                        disabled={!table.getCanPreviousPage()}
                    >
                        <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-lg"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="px-2 py-1 bg-muted/50 rounded-md text-xs font-medium">
                        {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
                    </div>
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-lg"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-lg"
                        onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                        disabled={!table.getCanNextPage()}
                    >
                        <ChevronsRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    )
}
