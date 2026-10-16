"use client"

import { createContext, useContext, useEffect, useState, useRef, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { User, Session } from "@supabase/supabase-js"
import { useRouter, usePathname } from "next/navigation"
import { toast } from "sonner"

interface Profile {
    id: string
    full_name: string
    area: string
    position: string
    role: string
    is_admin: boolean
    approved: boolean
    sucursal?: string
    avatar_url?: string
}

interface AuthContextType {
    user: User | null
    profile: Profile | null
    session: Session | null
    loading: boolean
    signOut: () => Promise<void>
    refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    profile: null,
    session: null,
    loading: true,
    signOut: async () => { },
    refreshProfile: async () => { },
})

/**
 * Esperas antes de cada intento de traer el perfil.
 *
 * El primero sale de inmediato; los siguientes dan margen a que termine la
 * renovación del token o a que el servidor responda. Al recargar la página con
 * el token ya vencido, la primera consulta sale con el token viejo y el servidor
 * la rechaza — sin reintento el perfil se quedaba en null para siempre.
 */
const ESPERAS_MS = [0, 1000, 3000]

/** Tope por intento. Sin él, una consulta colgada dejaba trabada la bandera. */
const LIMITE_MS = 8000

/** Código de PostgREST cuando `.single()` no encuentra ninguna fila. */
const SIN_FILAS = 'PGRST116'

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null)
    const [profile, setProfile] = useState<Profile | null>(null)
    const [session, setSession] = useState<Session | null>(null)
    const [loading, setLoading] = useState(true)
    const initialized = useRef(false)
    const initComplete = useRef(false)
    const lastFetchedProfileId = useRef<string | null>(null)
    const fetchingProfile = useRef(false)
    const lastFetchTime = useRef<number>(0)
    // Captured at render time, before Supabase cleans the URL hash
    const hadAuthHash = useRef(
        typeof window !== 'undefined' && window.location.hash.includes('access_token')
    )
    const router = useRouter()
    const pathname = usePathname()
    const pathnameRef = useRef(pathname)
    pathnameRef.current = pathname

    const limpiarEstado = useCallback(() => {
        setUser(null)
        setProfile(null)
        setSession(null)
        lastFetchedProfileId.current = null
    }, [])

    /**
     * Último recurso cuando el perfil no carga.
     *
     * Automatiza lo que antes se hacía a mano —borrar el almacenamiento desde
     * DevTools y volver a entrar—. Quedarse dentro de la app sin perfil es lo
     * que producía registros con atribución dudosa, así que se corta ahí.
     */
    const cerrarPorPerfilIrrecuperable = useCallback(async () => {
        console.error("AuthProvider: el perfil no cargó tras varios intentos; cerrando sesión")
        toast.error("Tu sesión expiró", {
            description: "Vuelve a entrar para continuar capturando.",
            duration: 10000,
        })
        try {
            await supabase.auth.signOut()
        } catch (e) {
            console.error("AuthProvider: error al cerrar sesión:", e)
        }
        limpiarEstado()
        router.push('/login')
    }, [router, limpiarEstado])

    const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
        // On the invite page the user has no profile yet — don't interfere
        if (pathnameRef.current.replace(/\/$/, '') === '/auth/invite') return null
        // Prevent concurrent fetches for the same user
        if (fetchingProfile.current) return null
        fetchingProfile.current = true

        try {
            for (let intento = 0; intento < ESPERAS_MS.length; intento++) {
                if (ESPERAS_MS[intento] > 0) {
                    await new Promise(r => setTimeout(r, ESPERAS_MS[intento]))
                }

                const corte = new AbortController()
                const temporizador = setTimeout(() => corte.abort(), LIMITE_MS)

                try {
                    const { data: profileData, error } = await supabase
                        .from('profiles')
                        .select('id, full_name, area, position, role, is_admin, approved, sucursal, avatar_url')
                        .eq('id', userId)
                        .abortSignal(corte.signal)
                        .single()

                    clearTimeout(temporizador)

                    if (error) {
                        // Sin fila no es un fallo pasajero: el usuario fue invitado y
                        // todavía no completa su alta. Reintentar no cambiaría nada.
                        if (error.code === SIN_FILAS) {
                            router.push('/auth/invite')
                            return null
                        }
                        console.warn(
                            "AuthProvider: intento " + (intento + 1) + "/" + ESPERAS_MS.length +
                            " al traer el perfil falló — " + (error.code || 'sin código') + ": " + error.message
                        )
                        continue
                    }

                    if (profileData) {
                        if (!profileData.approved) {
                            console.warn("AuthProvider: User not approved, signing out.")
                            await supabase.auth.signOut()
                            limpiarEstado()
                            return null
                        }
                        setProfile(profileData)
                        lastFetchedProfileId.current = userId
                        lastFetchTime.current = Date.now()
                        return profileData
                    }
                } catch (err: any) {
                    clearTimeout(temporizador)
                    const agotado = corte.signal.aborted
                    console.warn(
                        "AuthProvider: intento " + (intento + 1) + "/" + ESPERAS_MS.length + " al traer el perfil " +
                        (agotado
                            ? "superó el límite de " + LIMITE_MS + " ms"
                            : "lanzó excepción: " + (err?.message || err))
                    )
                }
            }

            await cerrarPorPerfilIrrecuperable()
            return null
        } finally {
            // Siempre, incluso si se abortó: dejarla en true bloqueaba todo intento
            // posterior y el perfil ya no se recuperaba nunca.
            fetchingProfile.current = false
        }
    }, [router, limpiarEstado, cerrarPorPerfilIrrecuperable])

    const refreshProfile = useCallback(async () => {
        const { data } = await supabase.auth.getSession()
        if (data?.session?.user) {
            lastFetchedProfileId.current = null
            await fetchProfile(data.session.user.id)
        }
    }, [fetchProfile])

    useEffect(() => {
        let mounted = true

        const initializeAuth = async () => {
            if (initialized.current) return
            initialized.current = true

            const safetyTimer = setTimeout(() => {
                if (mounted) {
                    console.warn("AuthProvider: Safety timeout — forcing loading false")
                    setLoading(false)
                }
            }, 8000)

            try {
                console.log("AuthProvider: Initializing...")
                const { data, error } = await supabase.auth.getSession()

                if (error) {
                    console.error("AuthProvider: getSession error:", error)
                }

                if (mounted) {
                    if (data?.session) {
                        setSession(data.session)
                        setUser(data.session.user)
                        await fetchProfile(data.session.user.id)
                    } else {
                        // No session at init — redirect to login unless on a public page
                        const normalizedPath = pathnameRef.current.replace(/\/$/, '')
                        if (!hadAuthHash.current && normalizedPath !== '/login' && normalizedPath !== '/auth/invite') {
                            router.push('/login')
                        }
                    }
                }
            } catch (error) {
                console.error("AuthProvider: Init exception:", error)
            } finally {
                clearTimeout(safetyTimer)
                initComplete.current = true
                if (mounted) setLoading(false)
            }
        }

        initializeAuth()

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
            if (!mounted) return

            // INITIAL_SESSION is fully handled by initializeAuth — skip it here always
            if (event === 'INITIAL_SESSION') return

            if (event === 'TOKEN_REFRESHED') {
                setSession(currentSession)
                setUser(currentSession?.user ?? null)

                // Si el perfil nunca llegó a cargar, ESTE es el momento de pedirlo:
                // al recargar con el token vencido la primera consulta salió con el
                // token viejo y fue rechazada, y aquí ya hay uno válido. Antes se
                // regresaba sin más, y el perfil quedaba en null de forma definitiva.
                if (currentSession
                    && lastFetchedProfileId.current !== currentSession.user.id
                    && !fetchingProfile.current) {
                    console.log("AuthProvider: token renovado y perfil ausente — recargándolo")
                    await fetchProfile(currentSession.user.id)
                }
                return
            }

            // SIGNED_OUT can fire transiently during token refresh before init completes.
            // Ignore it to avoid false redirects while the session is still being restored.
            if (event === 'SIGNED_OUT' && !initComplete.current) return

            console.log(`AuthProvider: Auth Event - ${event}`)

            setSession(currentSession)
            setUser(currentSession?.user ?? null)

            if (currentSession) {
                hadAuthHash.current = false
                // Only fetch profile if not already fetched for this user AND not mid-fetch
                if (currentSession.user.id !== lastFetchedProfileId.current && !fetchingProfile.current) {
                    await fetchProfile(currentSession.user.id)
                }
                // Only set loading false if we're not mid-fetch
                if (mounted && !fetchingProfile.current) setLoading(false)
            } else {
                setProfile(null)
                lastFetchedProfileId.current = null
                if (mounted) setLoading(false)

                const normalizedPath = pathnameRef.current.replace(/\/$/, '')
                if (!hadAuthHash.current && normalizedPath !== '/login' && normalizedPath !== '/auth/invite') {
                    router.push('/login')
                }
            }
        })

        return () => {
            mounted = false
            subscription.unsubscribe()
        }
    }, [router, fetchProfile])

    // On every navigation: re-fetch profile if it's missing or stale (> 60s)
    // This catches the post-invite case (profile was null on /auth/invite) and admin changes
    useEffect(() => {
        if (!user || loading) return
        const isStale = !profile || Date.now() - lastFetchTime.current > 60_000
        if (isStale && !fetchingProfile.current) {
            fetchProfile(user.id)
        }
    }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

    /**
     * Recuperación que no depende de navegar.
     *
     * El efecto de arriba solo corre cuando cambia la ruta, y al recargar la
     * página la ruta no cambia: si el operador se quedaba capturando en la misma
     * pantalla, nada volvía a intentarlo. Al recuperar el foco sí.
     */
    useEffect(() => {
        if (!user) return

        const recuperarPerfil = () => {
            if (document.hidden || fetchingProfile.current) return
            if (lastFetchedProfileId.current === user.id) return
            console.log("AuthProvider: perfil ausente al recuperar el foco — reintentando")
            fetchProfile(user.id)
        }

        document.addEventListener('visibilitychange', recuperarPerfil)
        window.addEventListener('focus', recuperarPerfil)
        return () => {
            document.removeEventListener('visibilitychange', recuperarPerfil)
            window.removeEventListener('focus', recuperarPerfil)
        }
    }, [user, fetchProfile])

    const signOut = async () => {
        try {
            await supabase.auth.signOut()
        } catch (e) {
            console.error("AuthProvider: Error al cerrar sesión:", e)
        } finally {
            limpiarEstado()
            router.push('/login')
        }
    }

    return (
        <AuthContext.Provider value={{ user, profile, session, loading, signOut, refreshProfile }}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => useContext(AuthContext)
