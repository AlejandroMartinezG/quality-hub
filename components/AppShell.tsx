"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn, getBasePath } from "@/lib/utils"
import {
    LayoutDashboard,
    BookOpen,
    Settings,
    Menu,
    X
} from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"

export function AppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const basePath = getBasePath()

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
            {/* Header */}
            <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
                <div className="container flex h-16 items-center justify-between">
                    <Link href={`${basePath}/`} className="flex items-center space-x-3">
                        <img src={`${basePath}/logo.png`} alt="GINEZ" className="h-10 w-auto" />
                        <div className="flex flex-col">
                            <span className="text-xs text-muted-foreground hidden lg:block">
                                Sistema de Gestión: Calidad y Documentación
                            </span>
                        </div>
                    </Link>

                    {/* Desktop Navigation */}
                    <nav className="hidden md:flex items-center space-x-6">
                        <Link
                            href={`${basePath}/`}
                            className={cn(
                                "flex items-center space-x-2 text-sm font-medium transition-colors hover:text-primary",
                                pathname === "/" ? "text-primary" : "text-muted-foreground"
                            )}
                        >
                            <LayoutDashboard className="h-4 w-4" />
                            <span>Panel</span>
                        </Link>
                        <Link
                            href={`${basePath}/catalog`}
                            className={cn(
                                "flex items-center space-x-2 text-sm font-medium transition-colors hover:text-primary",
                                pathname?.startsWith("/catalog") ? "text-primary" : "text-muted-foreground"
                            )}
                        >
                            <BookOpen className="h-4 w-4" />
                            <span>Catálogo</span>
                        </Link>
                    </nav>

                    {/* Mobile menu button */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="md:hidden"
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    >
                        {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                    </Button>
                </div>

                {/* Mobile Navigation */}
                {mobileMenuOpen && (
                    <div className="md:hidden border-t bg-white">
                        <nav className="container py-4 space-y-2">
                            <Link
                                href={`${basePath}/`}
                                className={cn(
                                    "flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                                    pathname === "/" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
                                )}
                                onClick={() => setMobileMenuOpen(false)}
                            >
                                <LayoutDashboard className="h-4 w-4" />
                                <span>Panel</span>
                            </Link>
                            <Link
                                href={`${basePath}/catalog`}
                                className={cn(
                                    "flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                                    pathname?.startsWith("/catalog") ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
                                )}
                                onClick={() => setMobileMenuOpen(false)}
                            >
                                <BookOpen className="h-4 w-4" />
                                <span>Catálogo</span>
                            </Link>
                        </nav>
                    </div>
                )}
            </header>

            {/* Main Content */}
            <main className="container py-6">
                {children}
            </main>

            {/* Footer */}
            <footer className="border-t bg-white mt-auto">
                <div className="container py-6 text-center text-sm text-muted-foreground">
                    <p>© {new Date().getFullYear()} GINEZ. Sistema de Gestión de Calidad y Documentación.</p>
                </div>
            </footer>
        </div>
    )
}
