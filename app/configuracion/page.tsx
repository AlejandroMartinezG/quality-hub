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
import { Shield, History, User as UserIcon, Loader2, Users as UsersIcon, Edit2, Save, X, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
}

export default function ConfigurationPage() {
    const { user, profile, loading } = useAuth()
    const [activeTab, setActiveTab] = useState("profile")

    // Logs state
    const [logs, setLogs] = useState<DownloadLog[]>([])
    const [logsLoading, setLogsLoading] = useState(true)

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
        const { data } = await supabase
            .from('download_logs')
            .select('*')
            .order('downloaded_at', { ascending: false })
            .limit(200)

        if (data) setLogs(data)
        setLogsLoading(false)
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

            // Update local state to reflect changes immediately without reload
            if (profile) {
                setProfile({
                    ...profile,
                    full_name: myProfileData.full_name,
                    position: myProfileData.position,
                    sucursal: myProfileData.sucursal,
                    area: myProfileData.area,
                    email: myProfileData.email || profile.email
                })
            }
            setIsMyProfileDialogOpen(false)

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
            accessorKey: "area",
            header: "Área",
            cell: ({ row }) => <Badge variant="outline">{row.getValue("area")}</Badge>,
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
                    <TabsContent value="profile" className="space-y-4 mt-6">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>Información del Usuario</CardTitle>
                                    <CardDescription>Tus datos registrados en el sistema</CardDescription>
                                </div>
                                <Button variant="outline" size="sm" onClick={() => setIsMyProfileDialogOpen(true)} className="gap-2">
                                    <Edit2 className="h-4 w-4" />
                                    Editar Perfil
                                </Button>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-1">
                                        <p className="text-sm text-muted-foreground">Nombre Completo</p>
                                        <p className="font-medium text-lg">{profile?.full_name}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-sm text-muted-foreground">Correo electrónico</p>
                                        <p className="font-medium text-lg">{profile?.email || user.email}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-sm text-muted-foreground">Área / Departamento</p>
                                        <p className="font-medium text-lg">
                                            <Badge variant="secondary" className="px-3 py-0.5 text-sm">{profile?.area}</Badge>
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-sm text-muted-foreground">Puesto</p>
                                        <p className="font-medium text-lg">{profile?.position}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Gestión de Usuarios (Admin) */}
                    {profile?.is_admin && (
                        <>
                            <TabsContent value="users" className="space-y-4 mt-6">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <UsersIcon className="h-5 w-5" />
                                            Gestión de Usuarios
                                        </CardTitle>
                                        <CardDescription>Administra los perfiles, áreas y permisos de los usuarios registrados.</CardDescription>
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
                                        {logsLoading ? (
                                            <div className="flex justify-center p-8">
                                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                            </div>
                                        ) : (
                                            <DataTable columns={logColumns} data={logs} />
                                        )}
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        </>
                    )}
                </Tabs>
            </div>

            {/* Dialog Edit My Profile */}
            <Dialog open={isMyProfileDialogOpen} onOpenChange={setIsMyProfileDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Editar Mi Perfil</DialogTitle>
                        <DialogDescription>Actualiza tu información personal básica.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="my-name">Nombre Completo</Label>
                            <Input
                                id="my-name"
                                value={myProfileData.full_name}
                                onChange={(e) => setMyProfileData({ ...myProfileData, full_name: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="my-area">Área / Departamento</Label>
                            <Input
                                id="my-area"
                                value={myProfileData.area}
                                onChange={(e) => setMyProfileData({ ...myProfileData, area: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="my-position">Puesto</Label>
                            <Input
                                id="my-position"
                                value={myProfileData.position}
                                onChange={(e) => setMyProfileData({ ...myProfileData, position: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="my-sucursal">Sucursal</Label>
                            <Select
                                value={myProfileData.sucursal}
                                onValueChange={(value) => setMyProfileData({ ...myProfileData, sucursal: value })}
                            >
                                <SelectTrigger id="my-sucursal">
                                    <SelectValue placeholder="Selecciona una sucursal" />
                                </SelectTrigger>
                                <SelectContent>
                                    {SUCURSALES.map((s) => (
                                        <SelectItem key={s} value={s}>{s}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        {profile?.is_admin && (
                            <>
                                <div className="space-y-2">
                                    <Label htmlFor="my-email">Correo Electrónico</Label>
                                    <Input
                                        id="my-email"
                                        type="email"
                                        value={myProfileData.email}
                                        onChange={(e) => setMyProfileData({ ...myProfileData, email: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="my-password">Nueva Contraseña (Opcional)</Label>
                                    <Input
                                        id="my-password"
                                        type="password"
                                        placeholder="Dejar vacía para no cambiar"
                                        value={myProfileData.password}
                                        onChange={(e) => setMyProfileData({ ...myProfileData, password: e.target.value })}
                                    />
                                </div>
                            </>
                        )}

                        {!profile?.is_admin && (
                            <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
                                Nota: Para cambiar tu Correo, contacta al administrador.
                            </p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsMyProfileDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleUpdateMyProfile} disabled={saveLoading}>
                            {saveLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Guardar Cambios
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog Edit Other User (Admin) */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
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
            </Dialog>
        </div>
    )
}
