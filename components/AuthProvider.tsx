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
 * Esperas antes de cada intento de traer el perfil. El primero sale de
 * inmediato; los siguientes dan margen a que el servidor responda.
 */
const ESPERAS_MS = [0, 1000, 3000]

/** Tope por intento, para que una consulta lenta no se quede indefinida. */
const LIMITE_MS = 8000

/**
 * Si la bandera de "trayendo perfil" lleva más de esto puesta, algo se colgó y
 * se libera. Fue lo que convirtió un tropiezo pasajero en un fallo permanente:
 * con la bandera trabada, TODA recuperación posterior salía por la puerta
 * temprana y el perfil ya no volvía nunca.
 */
const LIMITE_BANDERA_MS = LIMITE_MS * ESPERAS_MS.length + 5000

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
    const fetchingDesde = useRef<number>(0)
    const cierreSesionPendiente = useRef(false)
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

    /** ¿Hay una consulta de perfil realmente en curso, o quedó trabada? */
    const hayFetchEnCurso = useCallback(() => {
        if (!fetchingProfile.current) return false
        if (Date.now() - fetchingDesde.current > LIMITE_BANDERA_MS) {
            console.warn("AuthProvider: la consulta del perfil quedó colgada — liberando bandera")
            fetchingProfile.current = false
            return false
        }
        return true
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
        if (hayFetchEnCurso()) return null

        fetchingProfile.current = true
        fetchingDesde.current = Date.now()

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
            fetchingProfile.current = false
        }
    }, [router, limpiarEstado, cerrarPorPerfilIrrecuperable, hayFetchEnCurso])

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

                // Un SIGNED_OUT que llegó durante el arranque se guardó en vez de
                // descartarse. Ahora que terminó la inicialización, se atiende.
                if (cierreSesionPendiente.current && mounted) {
                    cierreSesionPendiente.current = false
                    console.warn("AuthProvider: atendiendo el SIGNED_OUT que llegó durante el arranque")
                    limpiarEstado()
                    const normalizedPath = pathnameRef.current.replace(/\/$/, '')
                    if (normalizedPath !== '/login' && normalizedPath !== '/auth/invite') {
                        router.push('/login')
                    }
                }
            }
        }

        initializeAuth()

        /**
         * Lo que hay que hacer con cada evento, FUERA del callback.
         *
         * Nunca debe invocarse directamente desde `onAuthStateChange`: ver el
         * comentario de la suscripción, más abajo.
         */
        const manejarEvento = async (event: string, currentSession: Session | null) => {
            if (!mounted) return

            if (event === 'INITIAL_SESSION') return

            if (event === 'TOKEN_REFRESHED') {
                // Si el perfil nunca llegó a cargar, éste es el momento de pedirlo:
                // ya hay un token válido.
                if (currentSession
                    && lastFetchedProfileId.current !== currentSession.user.id
                    && !hayFetchEnCurso()) {
                    console.log("AuthProvider: token renovado y perfil ausente — recargándolo")
                    await fetchProfile(currentSession.user.id)
                }
                return
            }

            if (event === 'SIGNED_OUT' && !initComplete.current) {
                // No se descarta: se recuerda para atenderlo al terminar el arranque.
                // Descartarlo dejaba la sesión a medias, sin perfil y sin redirección.
                cierreSesionPendiente.current = true
                return
            }

            console.log(`AuthProvider: Auth Event - ${event}`)

            if (currentSession) {
                hadAuthHash.current = false
                if (currentSession.user.id !== lastFetchedProfileId.current && !hayFetchEnCurso()) {
                    await fetchProfile(currentSession.user.id)
                }
                if (mounted && !hayFetchEnCurso()) setLoading(false)
            } else {
                setProfile(null)
                lastFetchedProfileId.current = null
                if (mounted) setLoading(false)

                const normalizedPath = pathnameRef.current.replace(/\/$/, '')
                if (!hadAuthHash.current && normalizedPath !== '/login' && normalizedPath !== '/auth/invite') {
                    router.push('/login')
                }
            }
        }

        /**
         * El callback NO es async y no espera nada.
         *
         * supabase-js serializa toda operación de sesión con un candado del
         * navegador, y ese candado se toma ANTES de invocar este callback y se
         * suelta cuando termina. Cualquier consulta a Supabase necesita el mismo
         * candado para resolver el token: si se espera aquí dentro, el callback
         * aguarda a la consulta, la consulta aguarda al candado y el candado
         * aguarda al callback. Se traban y nadie avanza — sin error, sin rechazo
         * y sin tiempo agotado, que es justo lo que hacía perder el perfil al
         * recargar.
         *
         * Guardar sesión y usuario es síncrono y puede quedarse. El resto se
         * difiere para que el callback retorne y libere el candado primero.
         */
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
            if (!mounted) return

            setSession(currentSession)
            setUser(currentSession?.user ?? null)

            setTimeout(() => { manejarEvento(event, currentSession) }, 0)
        })

        return () => {
            mounted = false
            subscription.unsubscribe()
        }
    }, [router, fetchProfile, limpiarEstado, hayFetchEnCurso])

    // On every navigation: re-fetch profile if it's missing or stale (> 60s)
    // This catches the post-invite case (profile was null on /auth/invite) and admin changes
    useEffect(() => {
        if (!user || loading) return
        const isStale = !profile || Date.now() - lastFetchTime.current > 60_000
        if (isStale && !hayFetchEnCurso()) {
            fetchProfile(user.id)
        }
    }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

    /**
     * Recuperación que no depende de navegar: al recargar la página la ruta no
     * cambia, así que el efecto de arriba no corre.
     */
    useEffect(() => {
        if (!user) return

        const recuperarPerfil = () => {
            if (document.hidden || hayFetchEnCurso()) return
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
    }, [user, fetchProfile, hayFetchEnCurso])

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
