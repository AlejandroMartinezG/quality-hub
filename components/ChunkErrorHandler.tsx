"use client"

import { useEffect } from "react"

const isChunkError = (msg: string) =>
    msg.includes("ChunkLoadError") ||
    msg.includes("Loading chunk") ||
    msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("Importing a module script failed")

export function ChunkErrorHandler() {
    useEffect(() => {
        // If this component mounted, the app loaded fine — clear the retry flag
        // Use a short delay to ensure it's a genuine successful load, not a partial one
        const clearTimer = setTimeout(() => {
            sessionStorage.removeItem("chunk_reload")
        }, 3000)

        const handleError = (event: ErrorEvent) => {
            if (!isChunkError(event.message || "")) return
            const alreadyRetried = sessionStorage.getItem("chunk_reload")
            if (!alreadyRetried) {
                sessionStorage.setItem("chunk_reload", "1")
                // Hard reload bypassing cache to get fresh chunks
                window.location.href = window.location.href
            }
        }

        const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
            const msg = String(event.reason?.message || event.reason || "")
            if (!isChunkError(msg)) return
            const alreadyRetried = sessionStorage.getItem("chunk_reload")
            if (!alreadyRetried) {
                sessionStorage.setItem("chunk_reload", "1")
                window.location.href = window.location.href
            }
        }

        window.addEventListener("error", handleError)
        window.addEventListener("unhandledrejection", handleUnhandledRejection)

        return () => {
            clearTimeout(clearTimer)
            window.removeEventListener("error", handleError)
            window.removeEventListener("unhandledrejection", handleUnhandledRejection)
        }
    }, [])

    return null
}
