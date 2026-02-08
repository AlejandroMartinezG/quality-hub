"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ShieldCheck, UserPlus, LogIn, Loader2, Mail, Lock, User, Building2, Briefcase, CheckCircle2, Sparkles, TrendingUp, BarChart3 } from "lucide-react"
import { cn } from "@/lib/utils"
import { SUCURSALES } from "@/lib/production-constants"

// Roles disponibles para registro
const ROLES = [
    { key: 'preparador', name: 'Preparador' },
    { key: 'gerente_sucursal', name: 'Gerente de Sucursal' },
    { key: 'director_operaciones', name: 'Director de Operaciones' },
    { key: 'gerente_calidad', name: 'Gerente de Calidad y Desarrollo' },
    { key: 'mostrador', name: 'Mostrador' },
    { key: 'cajera', name: 'Cajera' },
    { key: 'director_compras', name: 'Director de Compras' },
]

export default function LoginPage() {
    const [isLogin, setIsLogin] = useState(true)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const router = useRouter()

    const [formData, setFormData] = useState({
        email: "",
        password: "",
        full_name: "",
        role: "preparador",
        sucursal: "",
    })

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            if (isLogin) {
                const { error } = await supabase.auth.signInWithPassword({
                    email: formData.email,
                    password: formData.password,
                })
                if (error) throw error
                router.push('/')
            } else {
                // Primero crear el usuario
                const { data: authData, error: authError } = await supabase.auth.signUp({
                    email: formData.email,
                    password: formData.password,
                })

                if (authError) throw authError

                // Luego actualizar el perfil con rol y sucursal
                if (authData.user) {
                    const { error: profileError } = await supabase
                        .from('profiles')
                        .upsert({
                            id: authData.user.id,
                            full_name: formData.full_name,
                            role: formData.role,
                            sucursal: formData.sucursal,
                            updated_at: new Date().toISOString()
                        })

                    if (profileError) throw profileError
                }

                setError("Registro exitoso. Revisa tu correo para verificar tu cuenta.")
                setIsLogin(true)
            }
        } catch (err: any) {
            setError(err.message || "Ocurrió un error inesperado")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen w-full flex">
            {/* Left Panel - Branding & Information */}
            <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-900 via-blue-800 to-[#c41f1a] relative overflow-hidden">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
                    <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#c41f1a] rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>
                </div>

                {/* Content */}
                <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
                    {/* Logo & Brand */}
                    <div className="space-y-2">
                        <div className="flex flex-col items-start gap-2 mb-8">
                            <img
                                src="/logo.png"
                                alt="GINEZ"
                                className="h-20 w-auto brightness-0 invert opacity-100"
                            />
                            <p className="text-blue-200 text-sm font-medium ml-1">Quality Hub System</p>
                        </div>

                        <div className="space-y-6 mt-16">
                            <h2 className="text-4xl font-bold leading-tight">
                                Sistema de Control<br />de Calidad Integral
                            </h2>
                            <p className="text-blue-100 text-lg leading-relaxed max-w-md">
                                Plataforma corporativa para la gestión, análisis y control de calidad en procesos de producción.
                            </p>
                        </div>
                    </div>

                    {/* Features List */}
                    <div className="space-y-4 mt-12">
                        <div className="flex items-start gap-3 group">
                            <div className="p-2 bg-white/10 rounded-lg mt-0.5 group-hover:bg-white/20 transition-colors">
                                <CheckCircle2 className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-white">Control de Calidad en Tiempo Real</h3>
                                <p className="text-blue-200 text-sm">Monitoreo continuo de parámetros y estándares</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3 group">
                            <div className="p-2 bg-white/10 rounded-lg mt-0.5 group-hover:bg-white/20 transition-colors">
                                <BarChart3 className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-white">Análisis y Reportes Avanzados</h3>
                                <p className="text-blue-200 text-sm">Dashboards interactivos y métricas KPI</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3 group">
                            <div className="p-2 bg-white/10 rounded-lg mt-0.5 group-hover:bg-white/20 transition-colors">
                                <TrendingUp className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-white">Trazabilidad Completa</h3>
                                <p className="text-blue-200 text-sm">Seguimiento detallado de lotes y producción</p>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="mt-auto pt-8 border-t border-white/10">
                        <p className="text-blue-200 text-sm">© 2026 Ginez. Laboratorio de Calidad y Desarrollo</p>
                    </div>
                </div>
            </div>

            {/* Right Panel - Login Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950">
                <div className="w-full max-w-md space-y-8">
                    {/* Mobile Logo */}
                    <div className="lg:hidden flex items-center gap-3 justify-center mb-8">
                        <div className="p-3 bg-blue-900 rounded-2xl">
                            <ShieldCheck className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-blue-900 dark:text-white">GINEZ</h1>
                            <p className="text-blue-700 dark:text-blue-300 text-sm font-medium">Quality Hub</p>
                        </div>
                    </div>

                    {/* Form Header */}
                    <div className="text-center lg:text-left space-y-2">
                        <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                            {isLogin ? "Iniciar Sesión" : "Crear Cuenta"}
                        </h2>
                        <p className="text-slate-600 dark:text-slate-400">
                            {isLogin
                                ? "Ingresa tus credenciales para acceder al sistema"
                                : "Completa tus datos para registrarte en Quality Hub"}
                        </p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleAuth} className="space-y-5">
                        {!isLogin && (
                            <>
                                <div className="space-y-2">
                                    <Label htmlFor="full_name" className="text-slate-700 dark:text-slate-300 font-medium">
                                        Nombre Completo
                                    </Label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
                                        <Input
                                            id="full_name"
                                            placeholder="Juan Pérez"
                                            className="pl-11 h-12 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 focus:border-blue-500 focus:ring-blue-500"
                                            value={formData.full_name}
                                            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="role" className="text-slate-700 dark:text-slate-300 font-medium">
                                        Rol / Puesto
                                    </Label>
                                    <Select
                                        value={formData.role}
                                        onValueChange={(value) => setFormData({ ...formData, role: value })}
                                    >
                                        <SelectTrigger id="role" className="h-12 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700">
                                            <Briefcase className="h-5 w-5 text-slate-400 mr-2" />
                                            <SelectValue placeholder="Selecciona tu rol" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {ROLES.map((role) => (
                                                <SelectItem key={role.key} value={role.key}>
                                                    {role.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="sucursal" className="text-slate-700 dark:text-slate-300 font-medium">
                                        Sucursal
                                    </Label>
                                    <Select
                                        value={formData.sucursal}
                                        onValueChange={(value) => setFormData({ ...formData, sucursal: value })}
                                    >
                                        <SelectTrigger id="sucursal" className="h-12 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700">
                                            <Building2 className="h-5 w-5 text-slate-400 mr-2" />
                                            <SelectValue placeholder="Selecciona tu sucursal" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {SUCURSALES.map((sucursal) => (
                                                <SelectItem key={sucursal} value={sucursal}>
                                                    {sucursal}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-slate-700 dark:text-slate-300 font-medium">
                                Correo Electrónico
                            </Label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="correo@ginez.com"
                                    className="pl-11 h-12 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 focus:border-blue-500 focus:ring-blue-500"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    required
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="password" className="text-slate-700 dark:text-slate-300 font-medium">
                                    Contraseña
                                </Label>
                                {isLogin && (
                                    <button type="button" className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium">
                                        ¿Olvidaste tu contraseña?
                                    </button>
                                )}
                            </div>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    className="pl-11 h-12 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 focus:border-blue-500 focus:ring-blue-500"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    required
                                />
                            </div>
                        </div>

                        {error && (
                            <div className={cn(
                                "p-4 rounded-lg text-sm font-medium animate-in fade-in-50 slide-in-from-top-2",
                                error.includes("exitoso")
                                    ? "bg-green-50 text-green-700 border border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800"
                                    : "bg-red-50 text-red-700 border border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800"
                            )}>
                                {error}
                            </div>
                        )}

                        <Button
                            type="submit"
                            className="w-full h-12 bg-blue-900 hover:bg-blue-800 text-white font-semibold shadow-lg shadow-blue-900/20 transition-all hover:shadow-xl hover:shadow-blue-900/30"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    Procesando...
                                </>
                            ) : isLogin ? (
                                <>
                                    <LogIn className="mr-2 h-5 w-5" /> Iniciar Sesión
                                </>
                            ) : (
                                <>
                                    <UserPlus className="mr-2 h-5 w-5" /> Crear Cuenta
                                </>
                            )}
                        </Button>
                    </form>

                    {/* Toggle Login/Register */}
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-slate-300 dark:border-slate-700" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-slate-50 dark:bg-slate-950 px-3 text-slate-500 dark:text-slate-400 font-medium">
                                {isLogin ? "¿Nuevo usuario?" : "¿Ya tienes cuenta?"}
                            </span>
                        </div>
                    </div>

                    <Button
                        variant="outline"
                        className="w-full h-12 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-900 font-medium"
                        onClick={() => setIsLogin(!isLogin)}
                        disabled={loading}
                    >
                        {isLogin ? (
                            <>
                                <UserPlus className="mr-2 h-4 w-4" />
                                Crear una cuenta nueva
                            </>
                        ) : (
                            <>
                                <LogIn className="mr-2 h-4 w-4" />
                                Iniciar sesión con cuenta existente
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    )
}
