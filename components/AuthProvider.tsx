"use client"

import { createContext, useContext, useEffect, useState, useRef } from "react"
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
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    profile: null,
    session: null,
    loading: true,
    signOut: async () => { },
})

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null)
    const [profile, setProfile] = useState<Profile | null>(null)
    const [session, setSession] = useState<Session | null>(null)
    const [loading, setLoading] = useState(true)
    const initialized = useRef(false)
    const router = useRouter()
    const pathname = usePathname()

    useEffect(() => {
        let mounted = true

        // Cache the last user ID we fetched a profile for to avoid redundant calls
        let lastFetchedProfileId: string | null = null;

        const fetchProfile = async (userId: string): Promise<Profile | null> => {
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

                if (mounted && profileData) {
                    // Check if user is approved
                    if (!profileData.approved) {
                        console.warn("AuthProvider: User not approved, signing out.")
                        await supabase.auth.signOut()
                        setUser(null)
                        setProfile(null)
                        setSession(null)
                        return null
                    }
                    setProfile(profileData)
                    lastFetchedProfileId = userId // Mark as fetched
                    return profileData
                }
                return null
            } catch (err) {
                console.error("Exception fetching profile:", err)
                return null
            }
        }

        const initializeAuth = async () => {
            if (initialized.current) return
            initialized.current = true

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
                        if (pathname !== '/login') {
                            router.push('/login')
                        }
                    }
                }
            } catch (error) {
                console.error("AuthProvider: Init exception:", error)
            } finally {
                if (mounted) setLoading(false)
            }
        }

        initializeAuth()

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
            if (!mounted) return
            
            // Ignore initial check processed by initializeAuth to prevent double-processing
            if (event === 'INITIAL_SESSION' && initialized.current) return

            console.log(`AuthProvider: Auth Event - ${event}`)
            
            setSession(currentSession)
            setUser(currentSession?.user ?? null)

            if (currentSession) {
                // Only fetch if session user changed or profile not loaded
                if (currentSession.user.id !== lastFetchedProfileId) {
                    await fetchProfile(currentSession.user.id)
                }
                if (mounted) setLoading(false)
            } else {
                setProfile(null)
                lastFetchedProfileId = null
                if (mounted) setLoading(false)
                
                if (pathname !== '/login') {
                    router.push('/login')
                }
            }
        })

        return () => {
            mounted = false
            subscription.unsubscribe()
        }
    }, [router])

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
        <AuthContext.Provider value={{ user, profile, session, loading, signOut }}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => useContext(AuthContext)
