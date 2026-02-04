import type { Metadata } from "next"
import "./globals.css"
import { AppShell } from "@/components/AppShell"

import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/components/AuthProvider"
import { Toaster } from "sonner"

export const metadata: Metadata = {
    title: "Quality Hub GINEZ",
    description: "Sistema de Gestión: Calidad y Documentación",
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="es" suppressHydrationWarning>
            <body className="font-sans antialiased">
                <ThemeProvider
                    attribute="class"
                    defaultTheme="system"
                    enableSystem
                    disableTransitionOnChange
                >
                    <AuthProvider>
                        <AppShell>{children}</AppShell>
                        <Toaster position="top-right" richColors />
                    </AuthProvider>
                </ThemeProvider>
            </body>
        </html>
    )
}
