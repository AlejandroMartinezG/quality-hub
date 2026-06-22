'use client'

import { useEffect, useRef, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/esm/Page/AnnotationLayer.css'
import 'react-pdf/dist/esm/Page/TextLayer.css'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Loader2, ZoomIn, ZoomOut } from 'lucide-react'
import { getBasePath } from '@/lib/utils'

pdfjs.GlobalWorkerOptions.workerSrc = `${getBasePath()}/pdf.worker.min.js`

interface PdfViewerProps {
    url: string
}

export function PdfViewer({ url }: PdfViewerProps) {
    const [numPages, setNumPages] = useState<number | null>(null)
    const [pageNumber, setPageNumber] = useState(1)
    const [containerWidth, setContainerWidth] = useState(800)
    const [zoom, setZoom] = useState(1)
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const el = containerRef.current
        if (!el) return
        const observer = new ResizeObserver(entries => {
            const width = entries[0]?.contentRect.width
            if (width) setContainerWidth(width)
        })
        observer.observe(el)
        return () => observer.disconnect()
    }, [])

    return (
        <div className="flex flex-col h-full">
            <div ref={containerRef} className="flex-1 overflow-auto bg-slate-100 dark:bg-slate-950 rounded-xl flex justify-center">
                <Document
                    file={url}
                    onLoadSuccess={({ numPages }) => { setNumPages(numPages); setPageNumber(1) }}
                    loading={
                        <div className="flex items-center justify-center h-full py-20 text-slate-400 gap-2">
                            <Loader2 className="h-5 w-5 animate-spin" /> Cargando catálogo...
                        </div>
                    }
                    error={
                        <div className="flex items-center justify-center h-full py-20 text-rose-500 text-sm">
                            No se pudo cargar el PDF.
                        </div>
                    }
                >
                    <Page
                        pageNumber={pageNumber}
                        width={Math.max(280, containerWidth - 32) * zoom}
                        className="shadow-md my-4"
                    />
                </Document>
            </div>

            <div className="flex items-center justify-between gap-3 pt-3 shrink-0">
                <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setZoom(z => Math.max(0.5, z - 0.15))} disabled={zoom <= 0.5}>
                        <ZoomOut className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setZoom(z => Math.min(2, z + 0.15))} disabled={zoom >= 2}>
                        <ZoomIn className="h-4 w-4" />
                    </Button>
                </div>

                <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" onClick={() => setPageNumber(p => Math.max(1, p - 1))} disabled={pageNumber <= 1} className="gap-1">
                        <ChevronLeft className="h-4 w-4" /> Anterior
                    </Button>
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-300 tabular-nums">
                        Página {pageNumber} {numPages ? `/ ${numPages}` : ''}
                    </span>
                    <Button variant="outline" size="sm" onClick={() => setPageNumber(p => Math.min(numPages || p, p + 1))} disabled={!numPages || pageNumber >= numPages} className="gap-1">
                        Siguiente <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>

                <div className="w-[88px]" />
            </div>
        </div>
    )
}
