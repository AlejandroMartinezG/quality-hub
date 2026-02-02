"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { User, Session } from "@supabase/supabase-js"
import { useRouter, usePathname } from "next/navigation"

interface Profile {
    full_name: string
    area: string
    position: string
    is_admin: boolean
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
        const setData = async () => {
            const { data: { session }, error } = await supabase.auth.getSession()
            if (session) {
                setSession(session)
                setUser(session.user)

                // Fetch profile
                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('full_name, area, position, is_admin, sucursal, email')
                    .eq('id', session.user.id)
                    .single()

                if (profileData) setProfile(profileData)
            } else if (pathname !== '/login') {
                router.push('/login')
            }
            setLoading(false)
        }

        const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
            setSession(session)
            setUser(session?.user || null)

            if (session) {
                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('full_name, area, position, is_admin, sucursal, email')
                    .eq('id', session.user.id)
                    .single()
                if (profileData) setProfile(profileData)
            } else {
                setProfile(null)
                if (pathname !== '/login') {
                    router.push('/login')
                }
            }
            setLoading(false)
        })

        setData()

        return () => {
            listener.subscription.unsubscribe()
        }
    }, [router, pathname])

    const signOut = async () => {
        console.log("AuthProvider: Cerrando sesión...")
        try {
            const { error } = await supabase.auth.signOut()
            if (error) {
                console.error("AuthProvider: Error al cerrar sesión en Supabase:", error)
            }
        } catch (e) {
            console.error("AuthProvider: Excepción al intentar cerrar sesión:", e)
        }

        // Forzar limpieza de estado local
        setUser(null)
        setProfile(null)
        setSession(null)

        console.log("AuthProvider: Redirigiendo a login...")
        router.push('/login')
        router.refresh()
    }

    return (
        <AuthContext.Provider value={{ user, profile, session, loading, signOut }}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => useContext(AuthContext)
