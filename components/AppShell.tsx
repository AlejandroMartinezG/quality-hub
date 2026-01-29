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
import { ModeToggle } from "@/components/mode-toggle"

export function AppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const basePath = getBasePath()

    return (
        <div className="min-h-screen bg-background transition-colors duration-300">
            {/* Header */}
            <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container flex h-16 items-center justify-between">
                    <Link href={`${basePath}/`} className="flex items-center space-x-3">
                        {/* Logo support for light/dark can be added here if needed */}
                        <img src={`${basePath}/logo.png`} alt="GINEZ" className="h-10 w-auto dark:brightness-110" />
                        <div className="flex flex-col">
                            <span className="text-xs text-muted-foreground hidden lg:block">
                                Sistema de Gestión Documental del Laboratorio de Calidad y Desarrollo
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

                        <div className="pl-4 border-l">
                            <ModeToggle />
                        </div>
                    </nav>

                    {/* Right side for Mobile */}
                    <div className="flex items-center space-x-2 md:hidden">
                        <ModeToggle />
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        >
                            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                        </Button>
                    </div>
                </div>

                {/* Mobile Navigation */}
                {mobileMenuOpen && (
                    <div className="md:hidden border-t bg-background">
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
            <footer className="border-t bg-card mt-auto transition-colors duration-300">
                <div className="container py-6 text-center text-sm text-muted-foreground">
                    <p>© {new Date().getFullYear()} GINEZ. Sistema de Gestión Documental del Laboratorio de Calidad y Desarrollo.</p>
                </div>
            </footer>
        </div>
    )
}
