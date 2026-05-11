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

    const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
        // On the invite page the user has no profile yet — don't interfere
        if (pathnameRef.current.replace(/\/$/, '') === '/auth/invite') return null
        // Prevent concurrent fetches for the same user
        if (fetchingProfile.current) return null
        fetchingProfile.current = true

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
                lastFetchTime.current = Date.now()
                return profileData
            }

            // No profile — invited user, redirect to setup page
            router.push('/auth/invite')
            return null
        } catch (err) {
            console.error("Exception fetching profile:", err)
            return null
        } finally {
            fetchingProfile.current = false
        }
    }, [router])

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

            // TOKEN_REFRESHED: session updated silently, profile already loaded — don't disrupt UI
            if (event === 'TOKEN_REFRESHED') {
                setSession(currentSession)
                setUser(currentSession?.user ?? null)
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

    const signOut = async () => {
        try {
            await supabase.auth.signOut()
        } catch (e) {
            console.error("AuthProvider: Error al cerrar sesión:", e)
        } finally {
            setUser(null)
            setProfile(null)
            setSession(null)
            lastFetchedProfileId.current = null
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
