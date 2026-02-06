"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/components/AuthProvider"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Loader2, Shield, Users, Search, Edit, Save, X, Check, Building2 } from "lucide-react"
import { toast } from "sonner"
import { SUCURSALES } from "@/lib/production-constants"

interface Profile {
    id: string
    full_name: string
    role: string
    sucursal: string
    updated_at: string
}

interface UserRole {
    role_key: string
    role_name: string
    description: string
}

interface ModuleAccess {
    module_key: string
    access_level: string
    can_view: boolean
    can_download: boolean
    can_create: boolean
    can_edit: boolean
    can_delete: boolean
    can_export: boolean
}

const MODULE_NAMES: Record<string, string> = {
    'catalogo': 'Catálogo',
    'bitacora': 'Bitácora',
    'control_calidad': 'Control de Calidad',
    'reportes': 'Reportes',
    'configuracion': 'Configuración'
}

const ACCESS_LEVEL_LABELS: Record<string, { label: string, color: string }> = {
    'AC': { label: 'Acceso Completo', color: 'bg-green-100 text-green-800 border-green-300' },
    'AP': { label: 'Acceso Parcial', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
    'AR': { label: 'Acceso Restringido', color: 'bg-red-100 text-red-800 border-red-300' }
}

export default function UsuariosPage() {
    const { user: currentUser } = useAuth()
    const [profiles, setProfiles] = useState<Profile[]>([])
    const [roles, setRoles] = useState<UserRole[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")
    const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null)
    const [selectedRole, setSelectedRole] = useState<string>("")
    const [selectedSucursal, setSelectedSucursal] = useState<string>("")
    const [rolePermissions, setRolePermissions] = useState<ModuleAccess[]>([])
    const [savingRole, setSavingRole] = useState(false)

    useEffect(() => {
        fetchProfiles()
        fetchRoles()
    }, [])

    const fetchProfiles = async () => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .order('updated_at', { ascending: false })

            if (error) throw error
            setProfiles(data || [])
        } catch (error) {
            console.error("Error fetching profiles:", error)
            toast.error("Error al cargar usuarios")
        } finally {
            setLoading(false)
        }
    }

    const fetchRoles = async () => {
        try {
            const { data, error } = await supabase
                .from('user_roles_v2')
                .select('*')
                .order('role_name')

            if (error) throw error
            setRoles(data || [])
        } catch (error) {
            console.error("Error fetching roles:", error)
        }
    }

    const fetchRolePermissions = async (roleKey: string) => {
        try {
            const { data, error } = await supabase
                .from('module_access_levels')
                .select('*')
                .eq('role_key', roleKey)
                .order('module_key')

            if (error) throw error
            setRolePermissions(data || [])
        } catch (error) {
            console.error("Error fetching role permissions:", error)
            toast.error("Error al cargar permisos del rol")
        }
    }

    const handleEditUser = async (profile: Profile) => {
        setSelectedProfile(profile)
        setSelectedRole(profile.role || 'preparador')
        setSelectedSucursal(profile.sucursal || '')
        await fetchRolePermissions(profile.role || 'preparador')
    }

    const handleRoleChange = async (newRole: string) => {
        setSelectedRole(newRole)
        await fetchRolePermissions(newRole)
    }

    const saveUserRole = async () => {
        if (!selectedProfile) return

        setSavingRole(true)
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    role: selectedRole,
                    sucursal: selectedSucursal,
                    updated_at: new Date().toISOString()
                })
                .eq('id', selectedProfile.id)

            if (error) throw error

            toast.success("Rol y sucursal actualizados correctamente")
            setSelectedProfile(null)
            await fetchProfiles()
        } catch (error) {
            console.error("Error saving role:", error)
            toast.error("Error al guardar cambios")
        } finally {
            setSavingRole(false)
        }
    }

    const filteredProfiles = profiles.filter(p =>
        p.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.id.toLowerCase().includes(searchTerm.toLowerCase())
    )

    if (loading) {
        return (
            <div className="h-64 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Users className="h-8 w-8" />
                    Gestión de Usuarios
                </h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1">
                    Administra los roles y sucursales de cada usuario
                </p>
            </div>

            {/* Search */}
            <Card>
                <CardContent className="p-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Buscar por nombre o ID..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Users Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Usuarios del Sistema</CardTitle>
                    <CardDescription>
                        {filteredProfiles.length} usuario{filteredProfiles.length !== 1 ? 's' : ''} encontrado{filteredProfiles.length !== 1 ? 's' : ''}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Usuario</TableHead>
                                <TableHead>Rol</TableHead>
                                <TableHead>Sucursal</TableHead>
                                <TableHead>Fecha de Registro</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredProfiles.map((profile) => (
                                <TableRow key={profile.id}>
                                    <TableCell className="font-medium">
                                        {profile.full_name || 'Sin nombre'}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline">
                                            {roles.find(r => r.role_key === profile.role)?.role_name || profile.role || 'Sin rol'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="secondary">
                                            {profile.sucursal || 'Sin asignar'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {new Date(profile.updated_at).toLocaleDateString()}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Dialog>
                                            <DialogTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleEditUser(profile)}
                                                >
                                                    <Edit className="h-4 w-4 mr-2" />
                                                    Editar
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                                                <DialogHeader>
                                                    <DialogTitle className="flex items-center gap-2">
                                                        <Shield className="h-5 w-5" />
                                                        Editar Usuario: {profile.full_name}
                                                    </DialogTitle>
                                                    <DialogDescription>
                                                        Cambia el rol y sucursal del usuario. Los permisos se asignan automáticamente según el rol.
                                                    </DialogDescription>
                                                </DialogHeader>

                                                <div className="space-y-6 mt-4">
                                                    {/* Role Selector */}
                                                    <div className="space-y-2">
                                                        <Label htmlFor="role">Rol / Puesto</Label>
                                                        <Select
                                                            value={selectedRole}
                                                            onValueChange={handleRoleChange}
                                                        >
                                                            <SelectTrigger id="role">
                                                                <SelectValue placeholder="Selecciona un rol" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {roles.map((role) => (
                                                                    <SelectItem key={role.role_key} value={role.role_key}>
                                                                        <div className="flex flex-col">
                                                                            <span className="font-medium">{role.role_name}</span>
                                                                            <span className="text-xs text-slate-500">{role.description}</span>
                                                                        </div>
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>

                                                    {/* Sucursal Selector */}
                                                    <div className="space-y-2">
                                                        <Label htmlFor="sucursal">Sucursal</Label>
                                                        <Select
                                                            value={selectedSucursal}
                                                            onValueChange={setSelectedSucursal}
                                                        >
                                                            <SelectTrigger id="sucursal">
                                                                <SelectValue placeholder="Selecciona una sucursal" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {SUCURSALES.map((sucursal) => (
                                                                    <SelectItem key={sucursal} value={sucursal}>
                                                                        {sucursal}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>

                                                    {/* Permissions Preview */}
                                                    <div className="space-y-2">
                                                        <Label>Permisos del Rol</Label>
                                                        <div className="border rounded-lg p-4 bg-slate-50 dark:bg-slate-900">
                                                            <Table>
                                                                <TableHeader>
                                                                    <TableRow>
                                                                        <TableHead>Módulo</TableHead>
                                                                        <TableHead>Nivel de Acceso</TableHead>
                                                                        <TableHead className="text-center">Ver</TableHead>
                                                                        <TableHead className="text-center">Descargar</TableHead>
                                                                        <TableHead className="text-center">Crear</TableHead>
                                                                        <TableHead className="text-center">Editar</TableHead>
                                                                        <TableHead className="text-center">Eliminar</TableHead>
                                                                    </TableRow>
                                                                </TableHeader>
                                                                <TableBody>
                                                                    {rolePermissions.map((perm) => (
                                                                        <TableRow key={perm.module_key}>
                                                                            <TableCell className="font-medium">
                                                                                {MODULE_NAMES[perm.module_key] || perm.module_key}
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <Badge className={ACCESS_LEVEL_LABELS[perm.access_level]?.color || ''}>
                                                                                    {ACCESS_LEVEL_LABELS[perm.access_level]?.label || perm.access_level}
                                                                                </Badge>
                                                                            </TableCell>
                                                                            <TableCell className="text-center">
                                                                                {perm.can_view ? <Check className="h-4 w-4 text-green-600 mx-auto" /> : <X className="h-4 w-4 text-red-400 mx-auto" />}
                                                                            </TableCell>
                                                                            <TableCell className="text-center">
                                                                                {perm.can_download ? <Check className="h-4 w-4 text-green-600 mx-auto" /> : <X className="h-4 w-4 text-red-400 mx-auto" />}
                                                                            </TableCell>
                                                                            <TableCell className="text-center">
                                                                                {perm.can_create ? <Check className="h-4 w-4 text-green-600 mx-auto" /> : <X className="h-4 w-4 text-red-400 mx-auto" />}
                                                                            </TableCell>
                                                                            <TableCell className="text-center">
                                                                                {perm.can_edit ? <Check className="h-4 w-4 text-green-600 mx-auto" /> : <X className="h-4 w-4 text-red-400 mx-auto" />}
                                                                            </TableCell>
                                                                            <TableCell className="text-center">
                                                                                {perm.can_delete ? <Check className="h-4 w-4 text-green-600 mx-auto" /> : <X className="h-4 w-4 text-red-400 mx-auto" />}
                                                                            </TableCell>
                                                                        </TableRow>
                                                                    ))}
                                                                </TableBody>
                                                            </Table>
                                                        </div>
                                                    </div>

                                                    <div className="flex justify-end gap-2 pt-4 border-t">
                                                        <Button
                                                            variant="outline"
                                                            onClick={() => setSelectedProfile(null)}
                                                        >
                                                            <X className="h-4 w-4 mr-2" />
                                                            Cancelar
                                                        </Button>
                                                        <Button
                                                            onClick={saveUserRole}
                                                            disabled={savingRole}
                                                        >
                                                            {savingRole ? (
                                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                            ) : (
                                                                <Save className="h-4 w-4 mr-2" />
                                                            )}
                                                            Guardar Cambios
                                                        </Button>
                                                    </div>
                                                </div>
                                            </DialogContent>
                                        </Dialog>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
