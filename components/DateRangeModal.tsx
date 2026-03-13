'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Calendar, Printer } from 'lucide-react'

interface DateRangeModalProps {
    open: boolean
    onClose: () => void
    onConfirm: (dateFrom: string, dateTo: string) => void
    title?: string
}

export function DateRangeModal({ open, onClose, onConfirm, title = "Generar Reporte" }: DateRangeModalProps) {
    // Default: last 30 days
    const today = new Date().toISOString().split('T')[0]
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const [dateFrom, setDateFrom] = useState(thirtyDaysAgo)
    const [dateTo, setDateTo] = useState(today)

    const handleConfirm = () => {
        if (!dateFrom || !dateTo) return
        if (new Date(dateFrom) > new Date(dateTo)) {
            // Swap if reversed
            onConfirm(dateTo, dateFrom)
        } else {
            onConfirm(dateFrom, dateTo)
        }
    }

    // Quick range presets
    const setPreset = (days: number) => {
        const to = new Date()
        const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        setDateFrom(from.toISOString().split('T')[0])
        setDateTo(to.toISOString().split('T')[0])
    }

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
            <DialogContent className="sm:max-w-[420px] rounded-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-[#0e0c9b]">
                        <Printer className="h-5 w-5" />
                        {title}
                    </DialogTitle>
                    <DialogDescription>
                        Selecciona el rango de fechas para el reporte imprimible
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 py-2">
                    {/* Quick presets */}
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" className="rounded-full text-xs" onClick={() => setPreset(7)}>
                            7 días
                        </Button>
                        <Button variant="outline" size="sm" className="rounded-full text-xs" onClick={() => setPreset(30)}>
                            30 días
                        </Button>
                        <Button variant="outline" size="sm" className="rounded-full text-xs" onClick={() => setPreset(90)}>
                            3 meses
                        </Button>
                        <Button variant="outline" size="sm" className="rounded-full text-xs" onClick={() => setPreset(180)}>
                            6 meses
                        </Button>
                        <Button variant="outline" size="sm" className="rounded-full text-xs" onClick={() => setPreset(365)}>
                            1 año
                        </Button>
                    </div>

                    {/* Date inputs */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="date-from" className="text-xs font-semibold flex items-center gap-1">
                                <Calendar className="h-3 w-3" /> Desde
                            </Label>
                            <Input
                                id="date-from"
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="rounded-lg"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="date-to" className="text-xs font-semibold flex items-center gap-1">
                                <Calendar className="h-3 w-3" /> Hasta
                            </Label>
                            <Input
                                id="date-to"
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                max={today}
                                className="rounded-lg"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={onClose} className="rounded-full">
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        className="rounded-full bg-[#0e0c9b] hover:bg-[#1a18b0] text-white"
                        disabled={!dateFrom || !dateTo}
                    >
                        <Printer className="h-4 w-4 mr-2" />
                        Generar e Imprimir
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
