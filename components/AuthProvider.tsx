"use client"

import { createContext, useContext, useEffect, useState, useRef, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { User, Session } from "@supabase/supabase-js"
import { useRouter, usePathname } from "next/navigation"

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

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null)
    const [profile, setProfile] = useState<Profile | null>(null)
    const [session, setSession] = useState<Session | null>(null)
    const [loading, setLoading] = useState(true)
    const initialized = useRef(false)
    const initFoundSession = useRef(false)
    const lastFetchedProfileId = useRef<string | null>(null)
    // Captured at render time, before Supabase cleans the URL hash
    const hadAuthHash = useRef(
        typeof window !== 'undefined' && window.location.hash.includes('access_token')
    )
    const router = useRouter()
    const pathname = usePathname()

    const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
        // On the invite page the user has no profile yet — don't interfere
        if (pathname.replace(/\/$/, '') === '/auth/invite') return null

        try {
            const { data: profileData, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single()

            if (error) {
                console.error("Error fetching profile:", error)
                return null
            }

            if (profileData) {
                if (!profileData.approved) {
                    console.warn("AuthProvider: User not approved, signing out.")
                    await supabase.auth.signOut()
                    setUser(null)
                    setProfile(null)
                    setSession(null)
                    return null
                }
                setProfile(profileData)
                lastFetchedProfileId.current = userId
                return profileData
            }

            // No profile — invited user, redirect to setup page
            router.push('/auth/invite')
            return null
        } catch (err) {
            console.error("Exception fetching profile:", err)
            return null
        }
    }, [router, pathname])

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
                        initFoundSession.current = true
                        setSession(data.session)
                        setUser(data.session.user)
                        await fetchProfile(data.session.user.id)
                    }
                    // No session: don't redirect here — let onAuthStateChange handle it
                }
            } catch (error) {
                console.error("AuthProvider: Init exception:", error)
            } finally {
                clearTimeout(safetyTimer)
                if (mounted) setLoading(false)
            }
        }

        initializeAuth()

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
            if (!mounted) return

            // Only skip INITIAL_SESSION if initializeAuth already found and handled a session
            if (event === 'INITIAL_SESSION' && initFoundSession.current) return

            console.log(`AuthProvider: Auth Event - ${event}`)

            setSession(currentSession)
            setUser(currentSession?.user ?? null)

            if (currentSession) {
                hadAuthHash.current = false
                if (currentSession.user.id !== lastFetchedProfileId.current) {
                    await fetchProfile(currentSession.user.id)
                }
                if (mounted) setLoading(false)
            } else {
                setProfile(null)
                lastFetchedProfileId.current = null
                if (mounted) setLoading(false)

                const normalizedPath = pathname.replace(/\/$/, '')
                if (!hadAuthHash.current && normalizedPath !== '/login' && normalizedPath !== '/auth/invite') {
                    router.push('/login')
                }
            }
        })

        return () => {
            mounted = false
            subscription.unsubscribe()
        }
    }, [router, fetchProfile, pathname])

    const signOut = async () => {
        console.log("AuthProvider: Cerrando sesión...")
        try {
            const { error } = await supabase.auth.signOut()
            if (error) throw error
        } catch (e) {
            console.error("AuthProvider: Error al cerrar sesión:", e)
        } finally {
            setUser(null)
            setProfile(null)
            setSession(null)
            router.push('/login')
            router.refresh()
        }
    }

    return (
        <AuthContext.Provider value={{ user, profile, session, loading, signOut, refreshProfile }}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => useContext(AuthContext)
