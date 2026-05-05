"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
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
import { Loader2, Shield, Users, Search, Edit, Save, X, Check, Building2, UserCheck, UserX, Clock, UserPlus, Mail } from "lucide-react"
import { toast } from "sonner"
import { SUCURSALES } from "@/lib/production-constants"

interface Profile {
    id: string
    full_name: string
    role: string
    sucursal: string
    updated_at: string
    approved: boolean
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

// Fallback roles if user_roles_v2 table is empty or unavailable
const FALLBACK_ROLES: UserRole[] = [
    { role_key: 'admin', role_name: 'Administrador', description: 'Acceso total al sistema' },
    { role_key: 'gerente_calidad', role_name: 'Gerente de Calidad', description: 'Gestión global de calidad' },
    { role_key: 'coordinador', role_name: 'Coordinador', description: 'Coordinación de sucursales' },
    { role_key: 'gerente_sucursal', role_name: 'Gerente de Sucursal', description: 'Gestión de una sucursal' },
    { role_key: 'preparador', role_name: 'Preparador', description: 'Registro de producción y calidad' },
    { role_key: 'supervisor', role_name: 'Supervisor', description: 'Supervisión de producción' },
]

export default function UsuariosPage() {
    const { user: currentUser, profile, loading: authLoading } = useAuth()
    const router = useRouter()

    const [profiles, setProfiles] = useState<Profile[]>([])
    const [roles, setRoles] = useState<UserRole[]>([])
    const [dataLoading, setDataLoading] = useState(false)
    const [searchTerm, setSearchTerm] = useState("")
    const [showPendingOnly, setShowPendingOnly] = useState(false)

    // Edit dialog state
    const [editOpen, setEditOpen] = useState(false)
    const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null)
    const [selectedRole, setSelectedRole] = useState<string>("")
    const [selectedSucursal, setSelectedSucursal] = useState<string>("")
    const [rolePermissions, setRolePermissions] = useState<ModuleAccess[]>([])
    const [loadingPermissions, setLoadingPermissions] = useState(false)
    const [savingRole, setSavingRole] = useState(false)

    // Invite dialog state
    const [inviteOpen, setInviteOpen] = useState(false)
    const [inviting, setInviting] = useState(false)
    const [inviteForm, setInviteForm] = useState({
        email: '', full_name: '', role: 'preparador', sucursal: ''
    })

    const isAdmin = !authLoading && !!profile && (profile.is_admin || profile.role?.toLowerCase() === 'admin')

    // Redirect non-admins once auth finishes
    useEffect(() => {
        if (authLoading) return
        if (!profile || (!profile.is_admin && profile.role?.toLowerCase() !== 'admin')) {
            toast.error("Acceso restringido", {
                description: "Solo los administradores pueden gestionar usuarios."
            })
            router.push('/configuracion')
        }
    }, [authLoading, profile, router])

    // Fetch data once auth is done and user is confirmed admin
    useEffect(() => {
        if (!isAdmin) return
        setDataLoading(true)
        Promise.all([fetchProfiles(), fetchRoles()]).finally(() => setDataLoading(false))
    }, [isAdmin]) // eslint-disable-line react-hooks/exhaustive-deps

    const fetchProfiles = async () => {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .order('updated_at', { ascending: false })
        if (error) {
            toast.error("Error al cargar usuarios: " + error.message)
            return
        }
        setProfiles(data || [])
    }

    const fetchRoles = async () => {
        const { data, error } = await supabase
            .from('user_roles_v2')
            .select('*')
            .order('role_name')
        if (error || !data || data.length === 0) {
            setRoles(FALLBACK_ROLES)
            return
        }
        setRoles(data)
    }

    const fetchRolePermissions = async (roleKey: string) => {
        setLoadingPermissions(true)
        setRolePermissions([])
        const { data, error } = await supabase
            .from('module_access_levels')
            .select('*')
            .eq('role_key', roleKey)
            .order('module_key')
        setLoadingPermissions(false)
        if (!error && data) setRolePermissions(data)
    }

    const openEditDialog = async (p: Profile) => {
        setSelectedProfile(p)
        setSelectedRole(p.role || 'preparador')
        setSelectedSucursal(p.sucursal || '')
        setEditOpen(true)
        await fetchRolePermissions(p.role || 'preparador')
    }

    const handleRoleChange = async (newRole: string) => {
        setSelectedRole(newRole)
        await fetchRolePermissions(newRole)
    }

    const adminUpdate = async (userId: string, updates: Record<string, unknown>) => {
        const { data: { session } } = await supabase.auth.getSession()
        const res = await fetch('/api/admin/update-user', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session?.access_token}`,
            },
            body: JSON.stringify({ userId, ...updates }),
        })
        const result = await res.json()
        if (!res.ok) throw new Error(result.error)
    }

    const saveUserRole = async () => {
        if (!selectedProfile) return
        setSavingRole(true)
        try {
            await adminUpdate(selectedProfile.id, { role: selectedRole, sucursal: selectedSucursal })
            toast.success("Rol y sucursal actualizados correctamente")
            setEditOpen(false)
            setSelectedProfile(null)
            await fetchProfiles()
        } catch (error: any) {
            toast.error(error.message || "Error al guardar el rol.")
        } finally {
            setSavingRole(false)
        }
    }

    const toggleApproval = async (p: Profile) => {
        const newStatus = !p.approved
        try {
            await adminUpdate(p.id, { approved: newStatus })
            toast.success(newStatus
                ? `✅ ${p.full_name || 'Usuario'} aprobado`
                : `❌ Acceso revocado para ${p.full_name || 'Usuario'}`
            )
            await fetchProfiles()
        } catch (error: any) {
            toast.error(error.message || "Error al cambiar el estado de aprobación.")
        }
    }

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault()
        setInviting(true)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            const res = await fetch('/api/admin/invite-user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`,
                },
                body: JSON.stringify(inviteForm),
            })
            const result = await res.json()
            if (!res.ok) throw new Error(result.error)
            toast.success(`Invitación enviada a ${inviteForm.email}`)
            setInviteOpen(false)
            setInviteForm({ email: '', full_name: '', role: 'preparador', sucursal: '' })
            await fetchProfiles()
        } catch (err: any) {
            toast.error(err.message || 'Error al enviar invitación')
        } finally {
            setInviting(false)
        }
    }

    const pendingCount = profiles.filter(p => !p.approved).length

    const filteredProfiles = profiles
        .filter(p => showPendingOnly ? !p.approved : true)
        .filter(p =>
            p.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.id.toLowerCase().includes(searchTerm.toLowerCase())
        )

    // Spinner while auth or data is loading
    if (authLoading || dataLoading) {
        return (
            <div className="h-64 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        )
    }

    // Don't render content if not admin (redirect is in progress)
    if (!isAdmin) return null

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <Users className="h-8 w-8" />
                        Gestión de Usuarios
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                        Administra los roles, sucursales y aprobación de cada usuario
                    </p>
                </div>

                {/* Invite Dialog */}
                <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-blue-900 hover:bg-blue-800">
                            <UserPlus className="h-4 w-4 mr-2" />
                            Invitar Usuario
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <Mail className="h-5 w-5" />
                                Invitar Nuevo Usuario
                            </DialogTitle>
                            <DialogDescription>
                                Se enviará un correo de invitación. El usuario completará su nombre y contraseña al activar su cuenta.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleInvite} className="space-y-4 mt-2">
                            <div className="space-y-1">
                                <Label htmlFor="invite-email">Correo electrónico</Label>
                                <Input
                                    id="invite-email"
                                    type="email"
                                    placeholder="usuario@ejemplo.com"
                                    value={inviteForm.email}
                                    onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="invite-name">
                                    Nombre completo <span className="text-slate-400 font-normal">(opcional)</span>
                                </Label>
                                <Input
                                    id="invite-name"
                                    placeholder="El usuario lo completará al activar su cuenta"
                                    value={inviteForm.full_name}
                                    onChange={e => setInviteForm({ ...inviteForm, full_name: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="invite-role">Rol</Label>
                                <Select value={inviteForm.role} onValueChange={v => setInviteForm({ ...inviteForm, role: v })}>
                                    <SelectTrigger id="invite-role">
                                        <SelectValue placeholder="Selecciona un rol" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {roles.map(r => (
                                            <SelectItem key={r.role_key} value={r.role_key}>{r.role_name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="invite-sucursal">Sucursal</Label>
                                <Select value={inviteForm.sucursal} onValueChange={v => setInviteForm({ ...inviteForm, sucursal: v })}>
                                    <SelectTrigger id="invite-sucursal">
                                        <SelectValue placeholder="Selecciona una sucursal" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {SUCURSALES.map(s => (
                                            <SelectItem key={s} value={s}>{s}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex justify-end gap-2 pt-2 border-t">
                                <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>
                                    Cancelar
                                </Button>
                                <Button type="submit" disabled={inviting} className="bg-blue-900 hover:bg-blue-800">
                                    {inviting
                                        ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enviando...</>
                                        : <><Mail className="h-4 w-4 mr-2" />Enviar invitación</>
                                    }
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Pending Users Alert */}
            {pendingCount > 0 && (
                <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/30">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Clock className="h-5 w-5 text-amber-600" />
                            <div>
                                <p className="font-semibold text-amber-800 dark:text-amber-200">
                                    {pendingCount} usuario{pendingCount !== 1 ? 's' : ''} pendiente{pendingCount !== 1 ? 's' : ''} de aprobación
                                </p>
                                <p className="text-sm text-amber-600 dark:text-amber-400">
                                    Estos usuarios se registraron pero aún no tienen acceso a la plataforma.
                                </p>
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="border-amber-400 text-amber-700 hover:bg-amber-100"
                            onClick={() => setShowPendingOnly(!showPendingOnly)}
                        >
                            {showPendingOnly ? 'Ver todos' : 'Ver pendientes'}
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Search */}
            <Card>
                <CardContent className="p-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Buscar por nombre o ID..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
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
                                <TableHead>Estado</TableHead>
                                <TableHead>Rol</TableHead>
                                <TableHead>Sucursal</TableHead>
                                <TableHead>Última actualización</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredProfiles.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center text-slate-400">
                                        No se encontraron usuarios.
                                    </TableCell>
                                </TableRow>
                            ) : filteredProfiles.map((p) => (
                                <TableRow key={p.id} className={!p.approved ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''}>
                                    <TableCell className="font-medium">
                                        {p.full_name || <span className="text-slate-400 italic">Sin nombre</span>}
                                    </TableCell>
                                    <TableCell>
                                        {p.approved ? (
                                            <Badge className="bg-green-100 text-green-800 border-green-300">
                                                <UserCheck className="h-3 w-3 mr-1" /> Aprobado
                                            </Badge>
                                        ) : (
                                            <Badge className="bg-amber-100 text-amber-800 border-amber-300">
                                                <Clock className="h-3 w-3 mr-1" /> Pendiente
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline">
                                            {roles.find(r => r.role_key === p.role)?.role_name || p.role || 'Sin rol'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="secondary">
                                            <Building2 className="h-3 w-3 mr-1" />
                                            {p.sucursal || 'Sin asignar'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-slate-500 text-sm">
                                        {p.updated_at ? new Date(p.updated_at).toLocaleDateString('es-MX') : '—'}
                                    </TableCell>
                                    <TableCell className="text-right space-x-2">
                                        <Button
                                            variant={p.approved ? "outline" : "default"}
                                            size="sm"
                                            onClick={() => toggleApproval(p)}
                                            className={!p.approved ? 'bg-green-600 hover:bg-green-700' : 'text-red-600 border-red-300 hover:bg-red-50'}
                                        >
                                            {p.approved
                                                ? <><UserX className="h-4 w-4 mr-1" /> Revocar</>
                                                : <><UserCheck className="h-4 w-4 mr-1" /> Aprobar</>
                                            }
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => openEditDialog(p)}
                                        >
                                            <Edit className="h-4 w-4 mr-2" />
                                            Editar
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Edit Dialog — controlled, single instance outside the table */}
            <Dialog open={editOpen} onOpenChange={(open) => { if (!open) { setEditOpen(false); setSelectedProfile(null) } }}>
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Shield className="h-5 w-5" />
                            Editar Usuario: {selectedProfile?.full_name || 'Sin nombre'}
                        </DialogTitle>
                        <DialogDescription>
                            Cambia el rol y sucursal del usuario. Los permisos se asignan automáticamente según el rol.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 mt-4">
                        {/* Role Selector */}
                        <div className="space-y-2">
                            <Label htmlFor="role">Rol / Puesto</Label>
                            <Select value={selectedRole} onValueChange={handleRoleChange}>
                                <SelectTrigger id="role">
                                    <SelectValue placeholder="Selecciona un rol" />
                                </SelectTrigger>
                                <SelectContent>
                                    {roles.map(r => (
                                        <SelectItem key={r.role_key} value={r.role_key}>
                                            <div className="flex flex-col">
                                                <span className="font-medium">{r.role_name}</span>
                                                {r.description && <span className="text-xs text-slate-500">{r.description}</span>}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Sucursal Selector */}
                        <div className="space-y-2">
                            <Label htmlFor="sucursal">Sucursal</Label>
                            <Select value={selectedSucursal} onValueChange={setSelectedSucursal}>
                                <SelectTrigger id="sucursal">
                                    <SelectValue placeholder="Selecciona una sucursal" />
                                </SelectTrigger>
                                <SelectContent>
                                    {SUCURSALES.map(s => (
                                        <SelectItem key={s} value={s}>{s}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Permissions Preview */}
                        <div className="space-y-2">
                            <Label>Permisos del Rol</Label>
                            <div className="border rounded-lg p-4 bg-slate-50 dark:bg-slate-900">
                                {loadingPermissions ? (
                                    <div className="flex items-center justify-center py-6 gap-2 text-slate-400">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Cargando permisos...
                                    </div>
                                ) : rolePermissions.length === 0 ? (
                                    <p className="text-center text-sm text-slate-400 py-6">
                                        No hay permisos configurados para este rol en la base de datos.
                                    </p>
                                ) : (
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
                                            {rolePermissions.map(perm => (
                                                <TableRow key={perm.module_key}>
                                                    <TableCell className="font-medium">
                                                        {MODULE_NAMES[perm.module_key] || perm.module_key}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge className={ACCESS_LEVEL_LABELS[perm.access_level]?.color || ''}>
                                                            {ACCESS_LEVEL_LABELS[perm.access_level]?.label || perm.access_level}
                                                        </Badge>
                                                    </TableCell>
                                                    {[perm.can_view, perm.can_download, perm.can_create, perm.can_edit, perm.can_delete].map((val, i) => (
                                                        <TableCell key={i} className="text-center">
                                                            {val
                                                                ? <Check className="h-4 w-4 text-green-600 mx-auto" />
                                                                : <X className="h-4 w-4 text-red-400 mx-auto" />
                                                            }
                                                        </TableCell>
                                                    ))}
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-4 border-t">
                            <Button variant="outline" onClick={() => { setEditOpen(false); setSelectedProfile(null) }}>
                                <X className="h-4 w-4 mr-2" /> Cancelar
                            </Button>
                            <Button onClick={saveUserRole} disabled={savingRole}>
                                {savingRole
                                    ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    : <Save className="h-4 w-4 mr-2" />
                                }
                                Guardar Cambios
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
