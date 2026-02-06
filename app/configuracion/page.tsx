"use client"

import { useAuth } from "@/components/AuthProvider"
import { Breadcrumbs } from "@/components/Breadcrumbs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DataTable } from "@/components/DataTable"
import { ColumnDef } from "@tanstack/react-table"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Badge } from "@/components/ui/badge"
import { Shield, History, User as UserIcon, Loader2, Users as UsersIcon, Edit2, Save, X, Trash2, Building2, Crown, Mail, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AvatarUpload } from "@/components/AvatarUpload"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"

import { SUCURSALES } from "@/lib/production-constants"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

interface DownloadLog {
    id: string
    full_name: string
    area: string
    role?: string // Rol del usuario desde profiles
    file_name: string
    file_type: string
    downloaded_at: string
    sku_code?: string
}

interface Profile {
    id: string
    full_name: string
    area: string
    position: string
    email: string
    is_admin: boolean
    sucursal?: string
    role?: string
    avatar_url?: string | null
}

export default function ConfigurationPage() {
    const { user, profile, loading } = useAuth()
    const [activeTab, setActiveTab] = useState("profile")

    // Logs state
    const [logs, setLogs] = useState<DownloadLog[]>([])
    const [logsLoading, setLogsLoading] = useState(true)

    // Filter states for audit logs
    const [filterUser, setFilterUser] = useState("")
    const [filterArea, setFilterArea] = useState("all")
    const [filterAction, setFilterAction] = useState("all")
    const [filterDateFrom, setFilterDateFrom] = useState("")
    const [filterDateTo, setFilterDateTo] = useState("")

    // Users state (Admin)
    const [allUsers, setAllUsers] = useState<Profile[]>([])
    const [usersLoading, setUsersLoading] = useState(true)

    // Edit states
    const [editingUser, setEditingUser] = useState<Profile | null>(null)
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
    const [isMyProfileDialogOpen, setIsMyProfileDialogOpen] = useState(false)
    const [myProfileData, setMyProfileData] = useState({ full_name: "", position: "", sucursal: "", area: "", email: "", password: "" })

    const [saveLoading, setSaveLoading] = useState(false)

    useEffect(() => {
        if (profile?.is_admin) {
            fetchLogs()
            fetchAllUsers()
        }
    }, [profile])

    useEffect(() => {
        if (profile) {
            setMyProfileData({
                full_name: profile.full_name || "",
                position: profile.position || "",
                sucursal: profile.sucursal || "",
                area: profile.area || "",
                email: user?.email || "",
                password: ""
            })
        }
    }, [profile, user])

    async function fetchLogs() {
        try {
            // Fetch logs
            const { data: logsData, error: logsError } = await supabase
                .from('download_logs')
                .select('*')
                .order('downloaded_at', { ascending: false })
                .limit(500)

            if (logsError) {
                console.error("Error fetching logs:", logsError)
                setLogsLoading(false)
                return
            }

            // Fetch all profiles to get roles
            const { data: profilesData, error: profilesError } = await supabase
                .from('profiles')
                .select('id, role')

            if (profilesError) {
                console.error("Error fetching profiles:", profilesError)
            }

            // Create a map of user_id -> role
            const roleMap = new Map<string, string>()
            profilesData?.forEach(profile => {
                if (profile.id && profile.role) {
                    roleMap.set(profile.id, profile.role)
                }
            })

            // Transform logs to include role
            const transformedLogs = logsData?.map(log => ({
                ...log,
                role: log.user_id ? roleMap.get(log.user_id) || log.area : log.area
            })) || []

            setLogs(transformedLogs)
        } catch (error) {
            console.error("Exception fetching logs:", error)
        } finally {
            setLogsLoading(false)
        }
    }

    // Filtered logs based on filters
    const filteredLogs = logs.filter(log => {
        // Filter by user name
        if (filterUser && !log.full_name.toLowerCase().includes(filterUser.toLowerCase())) {
            return false
        }

        // Filter by role (using area as fallback)
        if (filterArea !== "all") {
            const logRole = log.role || log.area
            if (logRole !== filterArea) {
                return false
            }
        }

        // Filter by action type
        if (filterAction !== "all" && log.file_type !== filterAction) {
            return false
        }

        // Filter by date range
        if (filterDateFrom) {
            const logDate = new Date(log.downloaded_at)
            const fromDate = new Date(filterDateFrom)
            if (logDate < fromDate) return false
        }

        if (filterDateTo) {
            const logDate = new Date(log.downloaded_at)
            const toDate = new Date(filterDateTo)
            toDate.setHours(23, 59, 59, 999) // Include entire day
            if (logDate > toDate) return false
        }

        return true
    })

    // Get unique roles from logs
    const uniqueRoles = Array.from(new Set(logs.map(log => log.role || log.area))).filter(Boolean).sort()

    // Role display names
    const roleNames: Record<string, string> = {
        'admin': 'Administrador',
        'preparador': 'Preparador',
        'gerente_sucursal': 'Gerente de Sucursal',
        'director_operaciones': 'Director de Operaciones',
        'gerente_calidad': 'Gerente de Calidad',
        'mostrador': 'Mostrador',
        'cajera': 'Cajera',
        'director_compras': 'Director de Compras'
    }

    // Get unique action types from logs
    const uniqueActions = Array.from(new Set(logs.map(log => log.file_type))).filter(Boolean).sort()

    // Clear all filters
    const clearFilters = () => {
        setFilterUser("")
        setFilterArea("all")
        setFilterAction("all")
        setFilterDateFrom("")
        setFilterDateTo("")
    }


    async function fetchAllUsers() {
        console.log("Fetching all users...")
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .order('full_name', { ascending: true })

            if (error) {
                console.error("Error fetching users:", error)
                return
            }

            console.log("Users fetched:", data)
            if (data) setAllUsers(data)
        } catch (e) {
            console.error("Exception fetching users:", e)
        } finally {
            setUsersLoading(false)
        }
    }

    const handleUpdateMyProfile = async () => {
        if (!user) return
        setSaveLoading(true)

        try {
            // 1. Update Profile (Table) - Using UPSERT to handle missing profile rows
            const { error: profileError } = await supabase
                .from('profiles')
                .upsert({
                    id: user.id,
                    full_name: myProfileData.full_name,
                    position: myProfileData.position,
                    sucursal: myProfileData.sucursal,
                    area: myProfileData.area,
                    // Email not included in profiles to avoid unverified changes showing up
                    updated_at: new Date().toISOString()
                })
                .select()

            if (profileError) {
                throw new Error("Error al actualizar perfil: " + profileError.message)
            }

            // 2. Update Auth (Email/Password) - ADMIN ONLY
            if (profile?.is_admin) {
                const updates: { email?: string, password?: string } = {}
                if (myProfileData.email && myProfileData.email !== user.email) updates.email = myProfileData.email
                if (myProfileData.password && myProfileData.password.trim() !== "") updates.password = myProfileData.password

                if (Object.keys(updates).length > 0) {
                    const { error: authError } = await supabase.auth.updateUser(updates)
                    if (authError) {
                        throw new Error("Perfil actualizado, pero error en credenciales: " + authError.message)
                    }

                    if (updates.email) {
                        alert("Perfil actualizado.\n\nIMPORTANTE: Se ha enviado un correo de confirmación a " + updates.email + ". Debes confirmar el cambio para acceder con el nuevo correo.")
                    } else {
                        alert("Perfil y contraseña actualizados correctamente.")
                    }
                } else {
                    alert("Perfil actualizado correctamente.")
                }
            } else {
                alert("Perfil actualizado correctamente.")
            }

            // Reload to reflect changes
            window.location.reload()

        } catch (error: any) {
            console.error("Update error:", error)
            alert(error.message || "Ocurrió un error desconocido")
        } finally {
            setSaveLoading(false)
        }
    }

    const handleUpdateUser = async () => {
        if (!editingUser) return
        setSaveLoading(true)
        const { error } = await supabase
            .from('profiles')
            .update({
                full_name: editingUser.full_name,
                area: editingUser.area,
                position: editingUser.position,
                sucursal: editingUser.sucursal,
                is_admin: editingUser.is_admin,
                updated_at: new Date().toISOString()
            })
            .eq('id', editingUser.id)

        if (!error) {
            fetchAllUsers()
            setIsEditDialogOpen(false)
        }
        setSaveLoading(false)
    }

    const handleDeleteUser = async (userId: string) => {
        if (!confirm("ADVERTENCIA: ¿Estás seguro de que deseas eliminar este perfil?\n\nEsta acción eliminará la información visible del usuario (Nombre, Puesto, Área). Sin embargo, por seguridad, los registros históricos creados por este usuario se mantendrán.\n\nNota: El usuario podría perder acceso a funciones, pero su cuenta de correo seguirá registrada en el sistema de autenticación.")) return

        try {
            // Use V2 RPC to delete from auth.users as well
            const { error } = await supabase.rpc('delete_user_completely_v2', {
                target_user_id: userId,
                initiating_admin_id: user?.id
            })

            if (error) {
                throw new Error(error.message)
            }

            alert("Perfil de usuario eliminado correctamente.")
            fetchAllUsers()

        } catch (error: any) {
            console.error("Error deleting user:", error)
            alert("No se pudo eliminar el usuario: " + (error.message || "Error desconocido"))
        }
    }

    const logColumns: ColumnDef<DownloadLog>[] = [
        {
            accessorKey: "downloaded_at",
            header: "Fecha y Hora",
            cell: ({ row }) => new Date(row.getValue("downloaded_at")).toLocaleString("es-MX"),
        },
        {
            accessorKey: "full_name",
            header: "Usuario",
            cell: ({ row }) => <span className="font-semibold">{row.getValue("full_name")}</span>,
        },
        {
            accessorKey: "role",
            header: "Rol",
            cell: ({ row }) => {
                const role = row.original.role || row.original.area
                const roleNames: Record<string, string> = {
                    'admin': 'Administrador',
                    'preparador': 'Preparador',
                    'gerente_sucursal': 'Gerente de Sucursal',
                    'director_operaciones': 'Director de Operaciones',
                    'gerente_calidad': 'Gerente de Calidad',
                    'mostrador': 'Mostrador',
                    'cajera': 'Cajera',
                    'director_compras': 'Director de Compras'
                }
                const displayName = roleNames[role] || role
                return <Badge variant="outline">{displayName}</Badge>
            },
        },
        {
            accessorKey: "file_name",
            header: "Documento",
        },
        {
            accessorKey: "file_type",
            header: "Acción",
            cell: ({ row }) => {
                const type = row.getValue("file_type") as string
                const isDownload = type.includes("Descarga")
                return (
                    <Badge variant={isDownload ? "default" : "secondary"}>
                        {type}
                    </Badge>
                )
            },
        },
    ]

    const userColumns: ColumnDef<Profile>[] = [
        {
            accessorKey: "full_name",
            header: "Nombre",
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="font-semibold">{row.getValue("full_name")}</span>
                    <span className="text-xs text-muted-foreground">{row.original.email}</span>
                </div>
            )
        },
        {
            accessorKey: "area",
            header: "Área",
            cell: ({ row }) => <Badge variant="outline">{row.getValue("area")}</Badge>,
        },
        {
            accessorKey: "position",
            header: "Puesto",
        },
        {
            accessorKey: "is_admin",
            header: "Rol",
            cell: ({ row }) => (
                row.getValue("is_admin") ?
                    <Badge className="bg-primary/20 text-primary hover:bg-primary/20 border-primary/30">Admin</Badge> :
                    <Badge variant="secondary">Usuario</Badge>
            )
        },
        {
            id: "actions",
            header: "Acciones",
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                            setEditingUser(row.original)
                            setIsEditDialogOpen(true)
                        }}
                    >
                        <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeleteUser(row.original.id)}
                        disabled={row.original.id === user?.id}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            )
        }
    ]

    if (loading) return null

    if (!user) {
        return <div className="p-8 text-center text-muted-foreground">Inicia sesión para acceder.</div>
    }

    return (
        <div className="space-y-6">
            <Breadcrumbs items={[{ label: "Configuración" }]} />

            <div className="flex flex-col gap-6">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 max-w-[600px]">
                        <TabsTrigger value="profile" className="gap-2">
                            <UserIcon className="h-4 w-4" />
                            Mi Perfil
                        </TabsTrigger>
                        {profile?.is_admin && (
                            <>
                                <TabsTrigger value="users" className="gap-2">
                                    <UsersIcon className="h-4 w-4" />
                                    Usuarios
                                </TabsTrigger>
                                <TabsTrigger value="admin" className="gap-2">
                                    <Shield className="h-4 w-4" />
                                    Auditoría
                                </TabsTrigger>
                            </>
                        )}
                    </TabsList>

                    {/* Mi Perfil */}
                    <TabsContent value="profile" className="space-y-6 mt-6">
                        {/* Profile Header Card with Avatar */}
                        <Card className="overflow-hidden border-none shadow-md">
                            <div className="h-56 relative bg-white dark:bg-slate-900 overflow-hidden">
                                {/* Corporate Background Curves */}
                                <svg
                                    className="absolute inset-0 w-full h-full"
                                    preserveAspectRatio="none"
                                    viewBox="0 0 1440 400"
                                >
                                    {/* Red Layer (Background/Border) */}
                                    <path
                                        fill="#E62429"
                                        d="M0,400 C600,390 1200,100 1440,110 L1440,400 Z"
                                        className="opacity-90"
                                    />
                                    {/* Blue Layer (Foreground) */}
                                    <path
                                        fill="#001C71"
                                        d="M0,400 C600,400 1200,150 1440,165 L1440,400 Z"
                                    />
                                </svg>





                            </div>

                            <CardContent className="relative -mt-24 pb-8 px-6 md:px-10">
                                <div className="flex flex-col md:flex-row items-end gap-6 relative">
                                    {/* Edit Button - Absolute Positioned */}
                                    <div className="absolute top-0 right-0 hidden md:block">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setIsMyProfileDialogOpen(true)}
                                            className="gap-2"
                                        >
                                            <Edit2 className="h-4 w-4" />
                                            Editar
                                        </Button>
                                    </div>

                                    {/* Avatar Section - Left Aligned */}
                                    <div className="flex-shrink-0 relative z-10">
                                        <div className="rounded-full p-1.5 bg-white shadow-2xl ring-1 ring-slate-100">
                                            <AvatarUpload
                                                userId={user.id}
                                                currentAvatarUrl={profile?.avatar_url}
                                                userName={profile?.full_name || 'Usuario'}
                                                onUploadComplete={(url) => {
                                                    // Refresh profile data
                                                    window.location.reload()
                                                }}
                                            />
                                        </div>
                                    </div>

                                    {/* User Info - Side by Side */}
                                    <div className="flex-1 space-y-3 text-left z-10 w-full mb-1">
                                        <div className="space-y-1">
                                            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                                                {profile?.full_name}
                                            </h2>
                                            <p className="text-sm text-muted-foreground flex items-center justify-start gap-2">
                                                <Mail className="h-4 w-4" />
                                                {user?.email}
                                            </p>
                                        </div>

                                        {/* Mobile Edit Button */}
                                        <div className="md:hidden pt-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setIsMyProfileDialogOpen(true)}
                                                className="gap-2 w-full"
                                            >
                                                <Edit2 className="h-4 w-4" />
                                                Editar Perfil
                                            </Button>
                                        </div>

                                        {/* Role and Sucursal Badges - Left Aligned */}
                                        <div className="flex flex-wrap justify-start gap-2 pt-1">
                                            {profile?.role && (
                                                <Badge className="gap-1.5 px-3 py-1 text-xs md:text-sm">
                                                    <Shield className="h-3.5 w-3.5" />
                                                    {roleNames[profile.role] || profile.role}
                                                </Badge>
                                            )}
                                            {profile?.sucursal && (
                                                <Badge variant="secondary" className="gap-1.5 px-3 py-1 text-xs md:text-sm">
                                                    <Building2 className="h-3.5 w-3.5" />
                                                    {profile.sucursal}
                                                </Badge>
                                            )}
                                            {profile?.is_admin && (
                                                <Badge variant="destructive" className="gap-1.5 px-3 py-1 text-xs md:text-sm">
                                                    <Crown className="h-3.5 w-3.5" />
                                                    Administrador
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Profile Details Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Personal Information Card */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-lg">
                                        <UserIcon className="h-5 w-5 text-primary" />
                                        Información Personal
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-3">
                                        <div className="flex items-start justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border">
                                            <div className="space-y-1">
                                                <p className="text-xs text-muted-foreground">Nombre Completo</p>
                                                <p className="font-semibold">{profile?.full_name}</p>
                                            </div>
                                            <UserIcon className="h-4 w-4 text-muted-foreground mt-1" />
                                        </div>

                                        <div className="flex items-start justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border">
                                            <div className="space-y-1">
                                                <p className="text-xs text-muted-foreground">Correo Electrónico</p>
                                                <p className="font-semibold text-sm">{user?.email}</p>
                                            </div>
                                            <Mail className="h-4 w-4 text-muted-foreground mt-1" />
                                        </div>

                                        {profile?.sucursal && (
                                            <div className="flex items-start justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border">
                                                <div className="space-y-1">
                                                    <p className="text-xs text-muted-foreground">Sucursal</p>
                                                    <p className="font-semibold">{profile.sucursal}</p>
                                                </div>
                                                <Building2 className="h-4 w-4 text-muted-foreground mt-1" />
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Role & Permissions Card */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-lg">
                                        <Shield className="h-5 w-5 text-primary" />
                                        Rol y Permisos
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-3">
                                        <div className="flex items-start justify-between p-3 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
                                            <div className="space-y-1">
                                                <p className="text-xs text-muted-foreground">Rol Actual</p>
                                                <p className="font-bold text-primary">
                                                    {profile?.role ? (roleNames[profile.role] || profile.role) : 'No asignado'}
                                                </p>
                                            </div>
                                            <Shield className="h-4 w-4 text-primary mt-1" />
                                        </div>

                                        <div className="flex items-start justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border">
                                            <div className="space-y-1">
                                                <p className="text-xs text-muted-foreground">Nivel de Acceso</p>
                                                <p className="font-semibold">
                                                    {profile?.is_admin ? 'Administrador del Sistema' : 'Usuario Estándar'}
                                                </p>
                                            </div>
                                            {profile?.is_admin ? (
                                                <Crown className="h-4 w-4 text-amber-500 mt-1" />
                                            ) : (
                                                <UserIcon className="h-4 w-4 text-muted-foreground mt-1" />
                                            )}
                                        </div>

                                        {/* Permission Summary */}
                                        <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                                            <div className="flex items-start gap-2">
                                                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                                                <div className="text-xs text-blue-700 dark:text-blue-300">
                                                    <p className="font-medium">Permisos del Rol</p>
                                                    <p className="mt-1">
                                                        Tus permisos se asignan automáticamente según tu rol.
                                                        {profile?.is_admin ? ' Como administrador, tienes acceso completo al sistema.' : ' Contacta al administrador para cambios.'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    {/* Gestión de Usuarios (Admin) */}
                    {profile?.is_admin && (
                        <>
                            <TabsContent value="users" className="space-y-4 mt-6">
                                <Card>
                                    <CardHeader>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <CardTitle className="flex items-center gap-2">
                                                    <UsersIcon className="h-5 w-5" />
                                                    Gestión de Usuarios
                                                </CardTitle>
                                                <CardDescription>Administra los perfiles, áreas y permisos de los usuarios registrados.</CardDescription>
                                            </div>
                                            <Button
                                                onClick={() => window.location.href = '/configuracion/usuarios'}
                                                className="gap-2"
                                            >
                                                <Shield className="h-4 w-4" />
                                                Gestionar Permisos
                                            </Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        {usersLoading ? (
                                            <div className="flex justify-center p-8">
                                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                            </div>
                                        ) : (
                                            <DataTable columns={userColumns} data={allUsers} />
                                        )}
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            {/* Auditoría (Admin) */}
                            <TabsContent value="admin" className="space-y-4 mt-6">
                                <Card className="border-primary/20 bg-primary/5">
                                    <CardHeader>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <CardTitle className="flex items-center gap-2">
                                                    <History className="h-5 w-5" />
                                                    Historial de Auditoría
                                                </CardTitle>
                                                <CardDescription>Registro detallado de vistas y descargas de documentos</CardDescription>
                                            </div>
                                            <Badge className="bg-primary text-primary-foreground">Modo Administrador</Badge>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        {/* Filters Section */}
                                        <div className="mb-6 space-y-4">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Filtros</h3>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={clearFilters}
                                                    className="text-xs"
                                                >
                                                    <X className="h-3 w-3 mr-1" />
                                                    Limpiar Filtros
                                                </Button>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                                {/* Filter by User */}
                                                <div className="space-y-2">
                                                    <Label htmlFor="filter-user" className="text-xs">Buscar Usuario</Label>
                                                    <Input
                                                        id="filter-user"
                                                        placeholder="Nombre del usuario..."
                                                        value={filterUser}
                                                        onChange={(e) => setFilterUser(e.target.value)}
                                                        className="h-9"
                                                    />
                                                </div>

                                                {/* Filter by Role */}
                                                <div className="space-y-2">
                                                    <Label htmlFor="filter-area" className="text-xs">Rol</Label>
                                                    <Select value={filterArea} onValueChange={setFilterArea}>
                                                        <SelectTrigger id="filter-area" className="h-9">
                                                            <SelectValue placeholder="Todos los roles" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="all">Todos los roles</SelectItem>
                                                            {uniqueRoles.map((role: string) => (
                                                                <SelectItem key={role} value={role}>
                                                                    {roleNames[role] || role}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                {/* Filter by Action Type */}
                                                <div className="space-y-2">
                                                    <Label htmlFor="filter-action" className="text-xs">Tipo de Acción</Label>
                                                    <Select value={filterAction} onValueChange={setFilterAction}>
                                                        <SelectTrigger id="filter-action" className="h-9">
                                                            <SelectValue placeholder="Todas las acciones" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="all">Todas las acciones</SelectItem>
                                                            {uniqueActions.map(action => (
                                                                <SelectItem key={action} value={action}>
                                                                    {action}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                {/* Date Range - From */}
                                                <div className="space-y-2">
                                                    <Label htmlFor="filter-date-from" className="text-xs">Fecha Desde</Label>
                                                    <Input
                                                        id="filter-date-from"
                                                        type="date"
                                                        value={filterDateFrom}
                                                        onChange={(e) => setFilterDateFrom(e.target.value)}
                                                        className="h-9"
                                                    />
                                                </div>
                                            </div>

                                            {/* Second row for Date To */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                                <div className="space-y-2">
                                                    <Label htmlFor="filter-date-to" className="text-xs">Fecha Hasta</Label>
                                                    <Input
                                                        id="filter-date-to"
                                                        type="date"
                                                        value={filterDateTo}
                                                        onChange={(e) => setFilterDateTo(e.target.value)}
                                                        className="h-9"
                                                    />
                                                </div>

                                                {/* Results counter */}
                                                <div className="flex items-end">
                                                    <div className="text-sm text-muted-foreground">
                                                        Mostrando <span className="font-semibold text-foreground">{filteredLogs.length}</span> de <span className="font-semibold text-foreground">{logs.length}</span> registros
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Data Table */}
                                        {logsLoading ? (
                                            <div className="flex justify-center p-8">
                                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                            </div>
                                        ) : (
                                            <DataTable columns={logColumns} data={filteredLogs} />
                                        )}
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        </>
                    )}
                </Tabs>
            </div >

            {/* Dialog Edit My Profile */}
            < Dialog open={isMyProfileDialogOpen} onOpenChange={setIsMyProfileDialogOpen} >
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl">
                            <UserIcon className="h-5 w-5 text-primary" />
                            Editar Mi Perfil
                        </DialogTitle>
                        <DialogDescription>
                            Actualiza tu información personal. Los cambios se guardarán inmediatamente.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                        {/* Profile Info Section */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                                <UserIcon className="h-4 w-4" />
                                Información Personal
                            </div>

                            {/* Full Name */}
                            <div className="space-y-2">
                                <Label htmlFor="my-name" className="text-sm font-medium">
                                    Nombre Completo
                                </Label>
                                <Input
                                    id="my-name"
                                    value={myProfileData.full_name}
                                    onChange={(e) => setMyProfileData({ ...myProfileData, full_name: e.target.value })}
                                    placeholder="Tu nombre completo"
                                    className="h-10"
                                />
                            </div>

                            {/* Role Display (Read-only) */}
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Rol Actual</Label>
                                <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border">
                                    <Shield className="h-4 w-4 text-primary" />
                                    <span className="font-semibold text-sm">
                                        {profile?.role ? (
                                            roleNames[profile.role] || profile.role
                                        ) : (
                                            'No asignado'
                                        )}
                                    </span>
                                    <Badge variant="outline" className="ml-auto">
                                        {profile?.is_admin ? 'Administrador' : 'Usuario'}
                                    </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Para cambiar tu rol, contacta al administrador del sistema.
                                </p>
                            </div>

                            {/* Sucursal */}
                            <div className="space-y-2">
                                <Label htmlFor="my-sucursal" className="text-sm font-medium">
                                    Sucursal
                                </Label>
                                <Select
                                    value={myProfileData.sucursal}
                                    onValueChange={(value) => setMyProfileData({ ...myProfileData, sucursal: value })}
                                >
                                    <SelectTrigger id="my-sucursal" className="h-10">
                                        <SelectValue placeholder="Selecciona tu sucursal" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {SUCURSALES.map((s) => (
                                            <SelectItem key={s} value={s}>{s}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Account Security Section (Admin only) */}
                        {profile?.is_admin && (
                            <div className="space-y-4 pt-4 border-t">
                                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                                    <Shield className="h-4 w-4" />
                                    Seguridad de la Cuenta
                                </div>

                                {/* Email */}
                                <div className="space-y-2">
                                    <Label htmlFor="my-email" className="text-sm font-medium">
                                        Correo Electrónico
                                    </Label>
                                    <Input
                                        id="my-email"
                                        type="email"
                                        value={myProfileData.email}
                                        onChange={(e) => setMyProfileData({ ...myProfileData, email: e.target.value })}
                                        placeholder="tu@email.com"
                                        className="h-10"
                                    />
                                </div>

                                {/* Password */}
                                <div className="space-y-2">
                                    <Label htmlFor="my-password" className="text-sm font-medium">
                                        Nueva Contraseña
                                    </Label>
                                    <Input
                                        id="my-password"
                                        type="password"
                                        placeholder="Dejar vacío para no cambiar"
                                        value={myProfileData.password}
                                        onChange={(e) => setMyProfileData({ ...myProfileData, password: e.target.value })}
                                        className="h-10"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Solo completa este campo si deseas cambiar tu contraseña.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Non-admin note */}
                        {!profile?.is_admin && (
                            <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                                <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5" />
                                <div className="text-xs text-blue-700 dark:text-blue-300">
                                    <p className="font-medium">Cambios de seguridad</p>
                                    <p className="mt-1">Para cambiar tu correo o contraseña, contacta al administrador del sistema.</p>
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setIsMyProfileDialogOpen(false)}
                            disabled={saveLoading}
                        >
                            <X className="h-4 w-4 mr-2" />
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleUpdateMyProfile}
                            disabled={saveLoading}
                            className="min-w-[120px]"
                        >
                            {saveLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Guardando...
                                </>
                            ) : (
                                <>
                                    <Save className="mr-2 h-4 w-4" />
                                    Guardar Cambios
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog >

            {/* Dialog Edit Other User (Admin) */}
            < Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Editar Usuario</DialogTitle>
                        <DialogDescription>Modifica los datos y permisos de {editingUser?.full_name}.</DialogDescription>
                    </DialogHeader>
                    {editingUser && (
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Nombre Completo</Label>
                                <Input
                                    id="name"
                                    value={editingUser.full_name}
                                    onChange={(e) => setEditingUser({ ...editingUser, full_name: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="area">Área</Label>
                                    <Input
                                        id="area"
                                        value={editingUser.area}
                                        onChange={(e) => setEditingUser({ ...editingUser, area: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="position">Puesto</Label>
                                    <Input
                                        id="position"
                                        value={editingUser.position}
                                        onChange={(e) => setEditingUser({ ...editingUser, position: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="sucursal">Sucursal</Label>
                                <Select
                                    value={editingUser.sucursal || ""}
                                    onValueChange={(value) => setEditingUser({ ...editingUser, sucursal: value })}
                                >
                                    <SelectTrigger id="sucursal">
                                        <SelectValue placeholder="Selecciona una sucursal" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {SUCURSALES.map((s) => (
                                            <SelectItem key={s} value={s}>{s}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-center space-x-2 pt-2">
                                <Checkbox
                                    id="admin"
                                    checked={editingUser.is_admin}
                                    onCheckedChange={(checked) => setEditingUser({ ...editingUser, is_admin: !!checked })}
                                />
                                <Label htmlFor="admin" className="cursor-pointer">Permisos de Administrador</Label>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsEditDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleUpdateUser} disabled={saveLoading}>
                            {saveLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Actualizar Usuario
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog >
        </div >
    )
}
