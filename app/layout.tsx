import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { AppShell } from "@/components/AppShell"

const inter = Inter({ subsets: ["latin"] })

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
        <html lang="es">
            <body className={inter.className}>
                <AppShell>{children}</AppShell>
            </body>
        </html>
    )
}
