"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ShieldCheck, LogIn, Loader2, Mail, Lock, CheckCircle2, BarChart3, TrendingUp } from "lucide-react"
import { LoginSchema, validateForm, getFirstError } from "@/lib/validations"
import { checkRateLimit, resetRateLimit } from "@/lib/rate-limit"

export default function LoginPage() {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const router = useRouter()

    const [formData, setFormData] = useState({
        email: "",
        password: "",
    })

    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event !== 'SIGNED_IN' || !session) return
            const { data: profile } = await supabase
                .from('profiles')
                .select('id')
                .eq('id', session.user.id)
                .single()
            router.push(profile ? '/' : '/auth/invite')
        })
        return () => subscription.unsubscribe()
    }, [router])

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        const validation = validateForm(LoginSchema, formData)
        if (!validation.success) {
            setError(getFirstError(validation.errors))
            setLoading(false)
            return
        }

        const rateLimitKey = `auth:${formData.email.toLowerCase()}`
        const rateCheck = checkRateLimit(rateLimitKey)
        if (!rateCheck.allowed) {
            setError(rateCheck.message)
            setLoading(false)
            return
        }

        try {
            const { data: signInData, error } = await supabase.auth.signInWithPassword({
                email: formData.email,
                password: formData.password,
            })
            if (error) throw error

            if (signInData.user) {
                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('approved')
                    .eq('id', signInData.user.id)
                    .single()

                if (!profileData?.approved) {
                    await supabase.auth.signOut()
                    setError("⏳ Tu cuenta está pendiente de aprobación. Contacta al administrador.")
                    setLoading(false)
                    return
                }
            }

            resetRateLimit(rateLimitKey)
            router.push('/')
        } catch (err: any) {
            setError(err.message || "Correo o contraseña incorrectos")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen w-full flex">
            {/* Left Panel */}
            <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-900 via-blue-800 to-[#c41f1a] relative overflow-hidden">
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
                    <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#c41f1a] rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>
                </div>

                <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
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
                                Plataforma de Control de Calidad GINEZ® (PCC-GINEZ®)
                            </h2>
                            <p className="text-blue-100 text-lg leading-relaxed max-w-md">
                                Plataforma corporativa para la gestión, análisis y control de calidad en procesos de producción.
                            </p>
                        </div>
                    </div>

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

                    <div className="text-center lg:text-left space-y-2">
                        <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                            Iniciar Sesión
                        </h2>
                        <p className="text-slate-600 dark:text-slate-400">
                            Ingresa tus credenciales para acceder al sistema
                        </p>
                    </div>

                    <form onSubmit={handleAuth} className="space-y-5">
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
                            <Label htmlFor="password" className="text-slate-700 dark:text-slate-300 font-medium">
                                Contraseña
                            </Label>
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
                            <div className="p-4 rounded-lg text-sm font-medium animate-in fade-in-50 slide-in-from-top-2 bg-red-50 text-red-700 border border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800">
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
                                    Verificando...
                                </>
                            ) : (
                                <>
                                    <LogIn className="mr-2 h-5 w-5" /> Iniciar Sesión
                                </>
                            )}
                        </Button>
                    </form>

                    <p className="text-center text-sm text-slate-500 dark:text-slate-400">
                        ¿No tienes acceso? Contacta al administrador del sistema.
                    </p>
                </div>
            </div>
        </div>
    )
}
