import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getBasePath() {
  return process.env.NEXT_PUBLIC_BASE_PATH || ""
}

/**
 * Convierte una fecha 'YYYY-MM-DD' de la base a un Date seguro para mostrar.
 *
 * `new Date('2026-09-11')` se interpreta como medianoche UTC; al formatearla
 * en hora de México (UTC-6) retrocede al día anterior. Anclarla al mediodía
 * local evita ese corrimiento en cualquier huso.
 */
export function parseFechaLocal(fecha: string | null | undefined): Date | null {
  if (!fecha) return null
  const solo = String(fecha).split('T')[0]
  const d = new Date(`${solo}T12:00:00`)
  return isNaN(d.getTime()) ? null : d
}

/** Fecha de la base formateada para mostrar, sin corrimiento de huso. */
export function formatFecha(fecha: string | null | undefined): string {
  const d = parseFechaLocal(fecha)
  return d ? d.toLocaleDateString('es-MX') : '—'
}

/** Solo la parte 'YYYY-MM-DD'. Comparar estas cadenas evita todo problema de huso. */
export function soloFecha(fecha: string | null | undefined): string {
  return fecha ? String(fecha).split('T')[0] : ''
}
