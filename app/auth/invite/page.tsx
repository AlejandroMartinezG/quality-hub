"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Lock, User, Building2, Briefcase, ShieldCheck } from "lucide-react"
import { SUCURSALES } from "@/lib/production-constants"
import { sanitizeText } from "@/lib/sanitize"

const ROLES = [
    { key: 'preparador', name: 'Preparador' },
    { key: 'gerente_sucursal', name: 'Gerente de Sucursal' },
    { key: 'director_operaciones', name: 'Director de Operaciones' },
    { key: 'gerente_calidad', name: 'Gerente de Calidad y Desarrollo' },
    { key: 'mostrador', name: 'Mostrador' },
    { key: 'cajera', name: 'Cajera' },
    { key: 'director_compras', name: 'Director de Compras' },
]

export default function InvitePage() {
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [userEmail, setUserEmail] = useState<string | null>(null)
    const router = useRouter()

    const [formData, setFormData] = useState({
        full_name: "",
        role: "preparador",
        sucursal: "",
        password: "",
        confirm_password: "",
    })

    useEffect(() => {
        // Check immediately in case session is already available
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                setUserEmail(session.user.email ?? null)
                setLoading(false)
            }
        })

        // Also listen for session arriving via PKCE exchange
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session) {
                setUserEmail(session.user.email ?? null)
                setLoading(false)
            } else if (!loading) {
                router.push('/login')
            }
        })

        return () => subscription.unsubscribe()
    }, [router])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (formData.password !== formData.confirm_password) {
            setError("Las contraseñas no coinciden")
            return
        }
        if (formData.password.length < 8) {
            setError("La contraseña debe tener al menos 8 caracteres")
            return
        }
        if (!formData.full_name.trim()) {
            setError("El nombre es requerido")
            return
        }
        if (!formData.sucursal) {
            setError("Selecciona una sucursal")
            return
        }

        setSubmitting(true)
        setError(null)

        try {
            const { data: sessionData } = await supabase.auth.getSession()
            if (!sessionData.session) throw new Error("Sesión no válida")

            const { error: updateError } = await supabase.auth.updateUser({
                password: formData.password
            })
            if (updateError) throw updateError

            const { error: profileError } = await supabase
                .from('profiles')
                .upsert({
                    id: sessionData.session.user.id,
                    full_name: sanitizeText(formData.full_name),
                    role: formData.role,
                    sucursal: formData.sucursal,
                    approved: true,
                    updated_at: new Date().toISOString()
                })
            if (profileError) throw profileError

            router.push('/')
        } catch (err: any) {
            setError(err.message || "Error al configurar tu cuenta")
        } finally {
            setSubmitting(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-900" />
            </div>
        )
    }

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
            <div className="w-full max-w-md space-y-8">
                <div className="text-center space-y-2">
                    <div className="flex justify-center mb-4">
                        <div className="p-3 bg-blue-900 rounded-2xl">
                            <ShieldCheck className="w-8 h-8 text-white" />
                        </div>
                    </div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white">
                        Configura tu cuenta
                    </h2>
                    <p className="text-slate-600 dark:text-slate-400">
                        Fuiste invitado como <strong>{userEmail}</strong>. Completa tu perfil para acceder al sistema.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-2">
                        <Label htmlFor="full_name" className="text-slate-700 dark:text-slate-300 font-medium">
                            Nombre Completo
                        </Label>
                        <div className="relative">
                            <User className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
                            <Input
                                id="full_name"
                                placeholder="Juan Pérez"
                                className="pl-11 h-12 bg-white dark:bg-slate-900"
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
                        <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                            <SelectTrigger id="role" className="h-12 bg-white dark:bg-slate-900">
                                <Briefcase className="h-5 w-5 text-slate-400 mr-2" />
                                <SelectValue placeholder="Selecciona tu rol" />
                            </SelectTrigger>
                            <SelectContent>
                                {ROLES.map((role) => (
                                    <SelectItem key={role.key} value={role.key}>{role.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="sucursal" className="text-slate-700 dark:text-slate-300 font-medium">
                            Sucursal
                        </Label>
                        <Select value={formData.sucursal} onValueChange={(value) => setFormData({ ...formData, sucursal: value })}>
                            <SelectTrigger id="sucursal" className="h-12 bg-white dark:bg-slate-900">
                                <Building2 className="h-5 w-5 text-slate-400 mr-2" />
                                <SelectValue placeholder="Selecciona tu sucursal" />
                            </SelectTrigger>
                            <SelectContent>
                                {SUCURSALES.map((s) => (
                                    <SelectItem key={s} value={s}>{s}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="password" className="text-slate-700 dark:text-slate-300 font-medium">
                            Nueva Contraseña
                        </Label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
                            <Input
                                id="password"
                                type="password"
                                placeholder="Mínimo 8 caracteres"
                                className="pl-11 h-12 bg-white dark:bg-slate-900"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="confirm_password" className="text-slate-700 dark:text-slate-300 font-medium">
                            Confirmar Contraseña
                        </Label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
                            <Input
                                id="confirm_password"
                                type="password"
                                placeholder="Repite tu contraseña"
                                className="pl-11 h-12 bg-white dark:bg-slate-900"
                                value={formData.confirm_password}
                                onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="p-4 rounded-lg text-sm font-medium bg-red-50 text-red-700 border border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800">
                            {error}
                        </div>
                    )}

                    <Button
                        type="submit"
                        className="w-full h-12 bg-blue-900 hover:bg-blue-800 text-white font-semibold shadow-lg"
                        disabled={submitting}
                    >
                        {submitting ? (
                            <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Configurando...</>
                        ) : (
                            "Activar mi cuenta"
                        )}
                    </Button>
                </form>
            </div>
        </div>
    )
}
