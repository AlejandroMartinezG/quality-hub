"use client"

import { useEffect } from "react"

export function ChunkErrorHandler() {
    useEffect(() => {
        const handleError = (event: ErrorEvent) => {
            const isChunkError =
                event.message?.includes("ChunkLoadError") ||
                event.message?.includes("Loading chunk") ||
                event.message?.includes("Failed to fetch dynamically imported module")

            if (isChunkError) {
                const alreadyRetried = sessionStorage.getItem("chunk_reload")
                if (!alreadyRetried) {
                    sessionStorage.setItem("chunk_reload", "1")
                    window.location.reload()
                }
            }
        }

        const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
            const msg = event.reason?.message || event.reason || ""
            const isChunkError =
                msg.includes("ChunkLoadError") ||
                msg.includes("Loading chunk") ||
                msg.includes("Failed to fetch dynamically imported module")

            if (isChunkError) {
                const alreadyRetried = sessionStorage.getItem("chunk_reload")
                if (!alreadyRetried) {
                    sessionStorage.setItem("chunk_reload", "1")
                    window.location.reload()
                }
            }
        }

        // Clear the retry flag on successful load
        sessionStorage.removeItem("chunk_reload")

        window.addEventListener("error", handleError)
        window.addEventListener("unhandledrejection", handleUnhandledRejection)

        return () => {
            window.removeEventListener("error", handleError)
            window.removeEventListener("unhandledrejection", handleUnhandledRejection)
        }
    }, [])

    return null
}
