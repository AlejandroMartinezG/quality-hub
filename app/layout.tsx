import type { Metadata } from "next"
import "./globals.css"
import { AppShell } from "@/components/AppShell"

import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/components/AuthProvider"
import { Toaster } from "sonner"

// CSP policy — static export can't use HTTP headers, so we use meta tags
const cspContent = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.supabase.co",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
].join("; ")

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
            <head>
                {/* Content Security Policy */}
                <meta httpEquiv="Content-Security-Policy" content={cspContent} />
                {/* Prevent MIME-type sniffing */}
                <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
                {/* Control referrer information */}
                <meta name="referrer" content="strict-origin-when-cross-origin" />
                {/* Restrict browser features */}
                <meta httpEquiv="Permissions-Policy" content="camera=(), microphone=(), geolocation=(), payment=()" />
            </head>
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
