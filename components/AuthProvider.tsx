"use client"

import { createContext, useContext, useEffect, useState } from "react"
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
    const router = useRouter()
    const pathname = usePathname()

    useEffect(() => {
        let mounted = true

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
                        console.warn("User not approved, signing out.")
                        await supabase.auth.signOut()
                        setUser(null)
                        setProfile(null)
                        setSession(null)
                        return null
                    }
                    setProfile(profileData)
                    return profileData
                }
                return null
            } catch (err) {
                console.error("Exception fetching profile:", err)
                return null
            }
        }

        const initializeAuth = async () => {
            try {
                // Check active session
                console.log("AuthProvider: Checking active session...")
                const { data, error } = await supabase.auth.getSession()

                if (error) {
                    // Ignore AbortError which can happen in strict mode/dev
                    if (error.message && error.message.includes('AbortError')) {
                        console.warn("AuthProvider: Session check aborted (likely harmless in dev).")
                        return
                    }
                    console.error("AuthProvider: Error getting session:", error)
                    // Don't throw, just proceed as logged out
                }

                if (mounted) {
                    if (data?.session) {
                        console.log("AuthProvider: Session found.")
                        setSession(data.session)
                        setUser(data.session.user)
                        // Fetch profile immediately if session exists
                        await fetchProfile(data.session.user.id)
                    } else {
                        console.warn("AuthProvider: No session found during init.")
                        if (window.location.pathname !== '/login') {
                            console.log("AuthProvider: Redirecting to login...")
                            router.push('/login')
                        }
                    }
                }
            } catch (error) {
                console.error("Auth initialization exception:", error)
            } finally {
                if (mounted) setLoading(false)
            }
        }

        initializeAuth()

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log("Auth state change:", event)

            if (!mounted) return

            setSession(session)
            setUser(session?.user ?? null)

            if (session) {
                await fetchProfile(session.user.id)
            } else {
                setProfile(null)
                if (window.location.pathname !== '/login') {
                    router.push('/login')
                }
            }

            setLoading(false)
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
