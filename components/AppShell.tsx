"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn, getBasePath } from "@/lib/utils"
import {
    LayoutDashboard,
    BookOpen,
    Settings,
    Menu,
    X,
    ClipboardList,
    Microscope,
    Beaker,
    BarChart3,
    LogOut,
    User as UserIcon,
    Loader2,
    Moon,
    Sun,
    ChevronRight,
    Package
} from "lucide-react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/components/AuthProvider"
import { useTheme } from "next-themes"

export function AppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const basePath = getBasePath()
    const { user, profile, loading, signOut } = useAuth()
    const { setTheme, theme } = useTheme()
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    const isLoginPage = pathname === "/login"

    if (isLoginPage) {
        return <div className="min-h-screen bg-background">{children}</div>
    }

    const NavItem = ({ href, icon: Icon, label, disabled = false }: { href: string, icon: any, label: string, disabled?: boolean }) => {
        const isActive = pathname === href || (href !== "/" && pathname?.startsWith(href))

        if (disabled) {
            return (
                <div className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-400 cursor-not-allowed opacity-70">
                    <Icon className="h-5 w-5" />
                    <span>{label}</span>
                </div>
            )
        }

        return (
            <Link
                href={`${basePath}${href}`}
                className={cn(
                    "flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 group",
                    isActive
                        ? "bg-[#1e2756] text-white shadow-md"
                        : "text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:text-blue-900 dark:hover:text-blue-400"
                )}
                onClick={() => setMobileMenuOpen(false)}
            >
                <Icon className={cn("h-5 w-5", isActive ? "text-white" : "text-slate-400 group-hover:text-blue-900 dark:group-hover:text-blue-400")} />
                <span>{label}</span>
            </Link>
        )
    }

    const MobileNavItem = ({ href, icon: Icon, label }: { href: string, icon: any, label: string }) => (
        <Link
            href={`${basePath}${href}`}
            className={cn(
                "flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-md transition-colors",
                (pathname === href || (href !== "/" && pathname?.startsWith(href)))
                    ? "bg-blue-50 text-blue-900"
                    : "text-slate-600 hover:bg-slate-50"
            )}
            onClick={() => setMobileMenuOpen(false)}
        >
            <Icon className="h-5 w-5" />
            <span>{label}</span>
        </Link>
    )

    return (
        <div className="flex min-h-screen bg-[#FDFDFD] dark:bg-zinc-950">
            {/* Desktop Sidebar */}
            <aside className="hidden md:flex w-64 flex-col bg-[#FFFBF7] dark:bg-zinc-900 border-r h-screen sticky top-0 z-40 shadow-[1px_0_20px_0_rgba(0,0,0,0.02)]">
                {/* Logo Area */}
                <div className="p-4 pb-8 flex justify-center">
                    <Link href={`${basePath}/`} className="w-full flex justify-center">
                        <img
                            src={`${basePath}/logo.png`}
                            alt="GINEZ"
                            className="h-16 w-full object-contain max-w-[220px]"
                        />
                    </Link>
                </div>

                {/* Navigation */}
                <div className="flex-1 px-4 space-y-8 overflow-y-auto py-2">
                    <div className="space-y-1">
                        <h3 className="px-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">General</h3>
                        <NavItem href="/" icon={LayoutDashboard} label="Panel Principal" />
                        <NavItem href="/catalog" icon={BookOpen} label="Catálogo" />
                    </div>

                    <div className="space-y-1">
                        <h3 className="px-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Producción</h3>
                        <NavItem href="/calidad" icon={Microscope} label="Control Calidad" />
                        <NavItem href="/bitacora" icon={ClipboardList} label="Bitácora" />
                        <NavItem href="#" icon={Beaker} label="Laboratorio I+D" disabled />
                    </div>

                    <div className="space-y-1">
                        <h3 className="px-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Soporte</h3>
                        <NavItem href="#" icon={BarChart3} label="Reportes" disabled />
                        <Link
                            href={`${basePath}/configuracion`}
                            className={cn(
                                "flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 group",
                                pathname?.startsWith("/configuracion")
                                    ? "bg-[#1e2756] text-white shadow-md"
                                    : "text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:text-blue-900 dark:hover:text-blue-400"
                            )}
                        >
                            <Settings className={cn("h-5 w-5", pathname?.startsWith("/configuracion") ? "text-white" : "text-slate-400 group-hover:text-blue-900 dark:group-hover:text-blue-400")} />
                            <span>Configuración</span>
                        </Link>
                    </div>
                </div>

                {/* Bottom Actions */}
                {/* Bottom Actions */}
                <div className="p-4 border-t bg-[#FFFBF7] dark:bg-zinc-900">
                    <div className="flex justify-between items-center px-2">
                        <button
                            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                            className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-slate-500"
                            title="Cambiar tema"
                        >
                            {mounted && theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                        </button>
                        <div className="flex items-center gap-1">
                            <Link
                                href="/configuracion"
                                className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-slate-500"
                                title="Configuración"
                            >
                                <Settings className="h-5 w-5" />
                            </Link>
                            <button
                                onClick={async () => await signOut()}
                                className="p-2 rounded-full hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors text-slate-500"
                                title="Cerrar Sesión"
                            >
                                <LogOut className="h-5 w-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Mobile Header (Visible only on small screens) */}
            <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white dark:bg-zinc-900 border-b z-50 flex items-center justify-between px-4">
                <Link href={`${basePath}/`} className="font-bold text-lg text-slate-900 dark:text-slate-100">
                    GINEZ <span className="text-xs font-normal text-slate-500">ERP</span>
                </Link>
                <div className="flex items-center gap-2">
                    <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-slate-600">
                        {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                    </button>
                </div>
            </div>

            {/* Mobile Menu Overlay */}
            {mobileMenuOpen && (
                <div className="md:hidden fixed inset-0 z-40 bg-white dark:bg-zinc-900 pt-20 px-4 animate-in fade-in slide-in-from-top-10 duration-200">
                    <div className="space-y-2">
                        <MobileNavItem href="/" icon={LayoutDashboard} label="Panel Principal" />
                        <MobileNavItem href="/catalog" icon={BookOpen} label="Catálogo" />
                        <MobileNavItem href="/calidad" icon={Microscope} label="Control Calidad" />
                        <MobileNavItem href="/bitacora" icon={ClipboardList} label="Bitácora" />
                        <MobileNavItem href="/configuracion" icon={Settings} label="Configuración" />
                    </div>
                </div>
            )}

            {/* Main Content Area */}
            <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${mobileMenuOpen ? 'overflow-hidden h-screen' : ''}`}>
                {/* Top Bar (Desktop) */}
                <header className="hidden md:flex h-20 items-center justify-end px-8 border-b border-slate-100 dark:border-zinc-800 bg-[#FDfDfD] dark:bg-zinc-900 sticky top-0 z-30">
                    {loading ? (
                        <div className="h-10 w-32 bg-slate-100 animate-pulse rounded-full" />
                    ) : (
                        <Link
                            href={`${basePath}/configuracion`}
                            className="flex items-center gap-4 pl-6 py-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer group"
                        >
                            <div className="text-right">
                                <p className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-none group-hover:text-blue-900 transition-colors">
                                    {profile?.full_name || user?.email?.split('@')[0]}
                                </p>
                                <p className="text-[10px] text-slate-500 font-bold tracking-wider mt-1 uppercase">
                                    {profile?.area || 'USUARIO'}
                                </p>
                            </div>
                            <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-slate-200 to-slate-100 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center border-2 border-white dark:border-zinc-800 shadow-sm group-hover:scale-105 transition-transform">
                                {/* Using first letter or profile image if available */}
                                {profile?.avatar_url ? (
                                    <img src={profile.avatar_url} alt="Avatar" className="h-full w-full rounded-full object-cover" />
                                ) : (
                                    <UserIcon className="h-5 w-5 text-slate-500" />
                                )}
                            </div>
                            <ChevronRight className="h-4 w-4 text-slate-300 group-hover:translate-x-1 transition-transform" />
                        </Link>
                    )}
                </header>

                <main className="flex-1 p-6 md:p-10 mt-16 md:mt-0 overflow-y-auto w-full max-w-7xl mx-auto">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
                            <Loader2 className="h-10 w-10 animate-spin text-blue-900/50" />
                            <p className="text-slate-400 animate-pulse text-sm font-medium tracking-wide">CARGANDO RECURSOS...</p>
                        </div>
                    ) : (
                        children
                    )}
                </main>
            </div>
        </div>
    )
}
