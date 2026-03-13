'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { getBasePath } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import { Printer, X } from "lucide-react"

interface PrintReportWrapperProps {
    title: string
    dateFrom: string
    dateTo: string
    filters?: string
    userName?: string
    children: React.ReactNode
    onClose: () => void
}

export function PrintReportWrapper({
    title,
    dateFrom,
    dateTo,
    filters,
    userName,
    children,
    onClose
}: PrintReportWrapperProps) {
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    // Prevent scroll on body while print view is open
    useEffect(() => {
        if (!mounted) return
        const originalOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => {
            document.body.style.overflow = originalOverflow
        }
    }, [mounted])

    const formatDate = (d: string) => {
        try {
            return format(new Date(d + 'T12:00:00'), "dd 'de' MMMM yyyy", { locale: es })
        } catch {
            return d
        }
    }

    if (!mounted) return null

    const content = (
        <div className="print-overlay-root bg-slate-50 min-h-screen">
            {/* Screen-only Controls Overlay */}
            <div className="no-print sticky top-0 z-[10000] w-full bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 bg-[#0e0c9b] rounded-lg flex items-center justify-center">
                        <Printer className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-slate-900 leading-none">{title}</h2>
                        <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mt-1">Vista Previa de Impresión</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        size="sm"
                        className="bg-[#0e0c9b] hover:bg-[#0e0c9b]/90 text-white gap-2 shadow-md px-4"
                        onClick={() => window.print()}
                    >
                        <Printer className="h-4 w-4" />
                        Imprimir Ahora
                    </Button>
                    <div className="w-[1px] h-6 bg-slate-200 mx-1" />
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClose}
                        className="text-slate-500 hover:text-red-600 hover:bg-red-50 gap-2"
                    >
                        <X className="h-4 w-4" />
                        Cerrar Previsualización
                    </Button>
                </div>
            </div>

            <div
                className="print-content-container mx-auto bg-white shadow-2xl my-8 print:my-0 print:shadow-none"
                style={{
                    width: '21.59cm', // Letter width
                    minHeight: '27.94cm', // Letter height
                    padding: '1.5cm 2cm',
                    boxSizing: 'border-box'
                }}
            >
                {/* Header Section */}
                <div className="print-header" style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '30px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <img
                            src={`${getBasePath()}/logo.png`}
                            alt="GINEZ"
                            style={{ height: '48px', width: 'auto' }}
                            onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none'
                            }}
                        />
                        <div style={{ height: '40px', width: '2px', backgroundColor: '#e2e8f0' }} />
                        <div>
                            <h1 style={{
                                fontSize: '16pt',
                                fontWeight: 800,
                                color: '#0e0c9b',
                                margin: 0,
                                letterSpacing: '-0.02em'
                            }}>{title}</h1>
                            <p style={{
                                fontSize: '8pt',
                                color: '#64748b',
                                margin: 0,
                                textTransform: 'uppercase',
                                fontWeight: 600
                            }}>
                                Plataforma de Control de Calidad GINEZ® (PCC-GINEZ®)
                            </p>
                        </div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '8pt', color: '#64748b' }}>
                        <p style={{ fontWeight: 700, color: '#334155', margin: 0 }}>
                            {formatDate(dateFrom)} — {formatDate(dateTo)}
                        </p>
                        <p style={{ margin: '2px 0' }}>Generado: {format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })}</p>
                        {userName && <p style={{ margin: '2px 0' }}>Por: {userName}</p>}
                    </div>
                </div>

                {/* Report Content */}
                <div style={{ color: '#1e293b' }}>
                    {children}
                </div>

                {/* Fixed footer */}
                <div className="print-footer" style={{
                    position: 'fixed',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    textAlign: 'center',
                    fontSize: '7pt',
                    color: '#94a3b8',
                    borderTop: '1px solid #e2e8f0',
                    paddingTop: '4px',
                    background: 'white'
                }}>
                    Confidencial — Ginez® | Control de Calidad | {format(new Date(), "yyyy")}
                </div>
            </div>
        </div>
    )

    return createPortal(content, document.body)
}
