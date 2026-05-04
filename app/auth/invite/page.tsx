"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Lock, ShieldCheck, Mail, KeyRound, User, Building2 } from "lucide-react"

type PageState = 'verifying' | 'otp' | 'setup'

export default function InvitePage() {
    const [pageState, setPageState] = useState<PageState>('verifying')
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [userEmail, setUserEmail] = useState<string | null>(null)
    const [userSucursal, setUserSucursal] = useState<string | null>(null)
    const router = useRouter()

    const [otpData, setOtpData] = useState({ email: '', code: '' })
    const [fullName, setFullName] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')

    const loadProfileData = async (userId: string) => {
        const { data } = await supabase
            .from('profiles')
            .select('full_name, sucursal')
            .eq('id', userId)
            .single()
        if (data?.sucursal) setUserSucursal(data.sucursal)
        if (data?.full_name) setFullName(data.full_name)
    }

    useEffect(() => {
        const hash = window.location.hash
        if (hash.includes('access_token')) {
            const params = new URLSearchParams(hash.substring(1))
            const accessToken = params.get('access_token')
            const refreshToken = params.get('refresh_token')
            if (accessToken && refreshToken) {
                supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
                    .then(({ data, error }) => {
                        if (!error && data.session) {
                            setUserEmail(data.session.user.email ?? null)
                            loadProfileData(data.session.user.id)
                            setPageState('setup')
                            window.history.replaceState(null, '', window.location.pathname)
                        } else {
                            setPageState('otp')
                        }
                    })
                return
            }
        }

        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                setUserEmail(session.user.email ?? null)
                loadProfileData(session.user.id)
                setPageState('setup')
            } else {
                setPageState('otp')
            }
        })

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session) {
                setUserEmail(session.user.email ?? null)
                loadProfileData(session.user.id)
                setPageState('setup')
            }
        })
        return () => subscription.unsubscribe()
    }, [])

    const handleOtpVerify = async (e: React.FormEvent) => {
        e.preventDefault()
        setSubmitting(true)
        setError(null)
        try {
            const { data, error } = await supabase.auth.verifyOtp({
                email: otpData.email,
                token: otpData.code,
                type: 'invite',
            })
            if (error) throw error
            if (data.session) {
                setUserEmail(data.session.user.email ?? null)
                await loadProfileData(data.session.user.id)
                setPageState('setup')
            }
        } catch (err: any) {
            setError(err.message || "Código incorrecto o expirado")
        } finally {
            setSubmitting(false)
        }
    }

    const handleSetup = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!fullName.trim()) {
            setError("Ingresa tu nombre completo")
            return
        }
        if (password !== confirmPassword) {
            setError("Las contraseñas no coinciden")
            return
        }
        if (password.length < 8) {
            setError("La contraseña debe tener al menos 8 caracteres")
            return
        }
        setSubmitting(true)
        setError(null)
        try {
            const { error: pwError } = await supabase.auth.updateUser({ password })
            if (pwError) throw pwError

            const { data: { session } } = await supabase.auth.getSession()
            if (session?.user) {
                await supabase
                    .from('profiles')
                    .update({ full_name: fullName.trim(), updated_at: new Date().toISOString() })
                    .eq('id', session.user.id)
            }

            router.push('/')
        } catch (err: any) {
            setError(err.message || "Error al configurar la cuenta")
        } finally {
            setSubmitting(false)
        }
    }

    if (pageState === 'verifying') {
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
                        {pageState === 'otp' ? 'Activar invitación' : 'Configura tu cuenta'}
                    </h2>
                    <p className="text-slate-600 dark:text-slate-400">
                        {pageState === 'otp'
                            ? 'Ingresa tu correo y el código del email de invitación'
                            : <>Bienvenido, <strong>{userEmail}</strong>. Completa tu perfil para acceder.</>
                        }
                    </p>
                </div>

                {pageState === 'otp' && (
                    <form onSubmit={handleOtpVerify} className="space-y-5">
                        <div className="space-y-2">
                            <Label htmlFor="email">Correo electrónico</Label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="tu@correo.com"
                                    className="pl-11 h-12 bg-white dark:bg-slate-900"
                                    value={otpData.email}
                                    onChange={e => setOtpData({ ...otpData, email: e.target.value })}
                                    required
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="code">Código de invitación</Label>
                            <div className="relative">
                                <KeyRound className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
                                <Input
                                    id="code"
                                    placeholder="Ej: 985590"
                                    className="pl-11 h-12 bg-white dark:bg-slate-900 tracking-widest text-lg"
                                    value={otpData.code}
                                    onChange={e => setOtpData({ ...otpData, code: e.target.value })}
                                    required
                                />
                            </div>
                            <p className="text-xs text-slate-500">
                                Encuéntralo en el correo donde dice "Como alternativa, introduzca el código"
                            </p>
                        </div>
                        {error && (
                            <div className="p-4 rounded-lg text-sm font-medium bg-red-50 text-red-700 border border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800">
                                {error}
                            </div>
                        )}
                        <Button type="submit" className="w-full h-12 bg-blue-900 hover:bg-blue-800 text-white font-semibold" disabled={submitting}>
                            {submitting ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Verificando...</> : "Verificar código"}
                        </Button>
                    </form>
                )}

                {pageState === 'setup' && (
                    <form onSubmit={handleSetup} className="space-y-5">
                        <div className="space-y-2">
                            <Label htmlFor="fullname">Nombre completo</Label>
                            <div className="relative">
                                <User className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
                                <Input
                                    id="fullname"
                                    type="text"
                                    placeholder="Tu nombre completo"
                                    className="pl-11 h-12 bg-white dark:bg-slate-900"
                                    value={fullName}
                                    onChange={e => setFullName(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        {userSucursal && (
                            <div className="space-y-2">
                                <Label>Sucursal asignada</Label>
                                <div className="flex items-center gap-3 h-12 px-4 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                    <Building2 className="h-5 w-5 text-slate-400 shrink-0" />
                                    <span className="font-medium">{userSucursal}</span>
                                    <span className="text-xs text-slate-400 ml-auto">Asignada por el administrador</span>
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="password">Nueva contraseña</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="Mínimo 8 caracteres"
                                    className="pl-11 h-12 bg-white dark:bg-slate-900"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    required
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirm">Confirmar contraseña</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
                                <Input
                                    id="confirm"
                                    type="password"
                                    placeholder="Repite tu contraseña"
                                    className="pl-11 h-12 bg-white dark:bg-slate-900"
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    required
                                />
                            </div>
                        </div>
                        {error && (
                            <div className="p-4 rounded-lg text-sm font-medium bg-red-50 text-red-700 border border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800">
                                {error}
                            </div>
                        )}
                        <Button type="submit" className="w-full h-12 bg-blue-900 hover:bg-blue-800 text-white font-semibold" disabled={submitting}>
                            {submitting ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Guardando...</> : "Activar mi cuenta"}
                        </Button>
                    </form>
                )}
            </div>
        </div>
    )
}
