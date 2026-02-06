"use client"

import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'
import { useAuth } from '@/components/AuthProvider'

// Tipos para el nuevo sistema de permisos
export type AccessLevel = 'AC' | 'AP' | 'AR' // Acceso Completo, Parcial, Restringido

export interface ModulePermission {
    module_key: string
    access_level: AccessLevel
    can_view: boolean
    can_download: boolean
    can_create: boolean
    can_edit: boolean
    can_delete: boolean
    can_export: boolean
    available_filters: string[] // Filtros disponibles para este rol
    visible_tabs: string[] // Tabs visibles para este rol
}

export interface UserPermissions {
    [moduleKey: string]: ModulePermission
}

export function usePermissions() {
    const { user } = useAuth()
    const [permissions, setPermissions] = useState<UserPermissions>({})
    const [loading, setLoading] = useState(true)

    const fetchPermissions = useCallback(async () => {
        if (!user) {
            setPermissions({})
            setLoading(false)
            return
        }

        try {
            // Llamar a la función SQL que obtiene permisos según el rol del usuario
            const { data, error } = await supabase
                .rpc('get_user_permissions_v2', { p_user_id: user.id })

            if (error) throw error

            // Convertir array a objeto para fácil acceso
            const permissionsMap = (data || []).reduce((acc: UserPermissions, perm: any) => {
                acc[perm.module_key] = {
                    module_key: perm.module_key,
                    access_level: perm.access_level,
                    can_view: perm.can_view,
                    can_download: perm.can_download,
                    can_create: perm.can_create,
                    can_edit: perm.can_edit,
                    can_delete: perm.can_delete,
                    can_export: perm.can_export,
                    available_filters: perm.available_filters || [],
                    visible_tabs: perm.visible_tabs || []
                }
                return acc
            }, {} as UserPermissions)

            setPermissions(permissionsMap)
        } catch (error) {
            console.error('Error fetching permissions:', error)
            setPermissions({})
        } finally {
            setLoading(false)
        }
    }, [user])

    useEffect(() => {
        fetchPermissions()
    }, [fetchPermissions])

    // Helper functions
    const getModulePermission = (moduleKey: string): ModulePermission | null => {
        return permissions[moduleKey] || null
    }

    const hasAccess = (moduleKey: string): boolean => {
        const perm = permissions[moduleKey]
        return perm ? perm.access_level !== 'AR' : false
    }

    const hasFullAccess = (moduleKey: string): boolean => {
        const perm = permissions[moduleKey]
        return perm ? perm.access_level === 'AC' : false
    }

    const hasPartialAccess = (moduleKey: string): boolean => {
        const perm = permissions[moduleKey]
        return perm ? perm.access_level === 'AP' : false
    }

    const canView = (moduleKey: string): boolean => {
        return permissions[moduleKey]?.can_view || false
    }

    const canDownload = (moduleKey: string): boolean => {
        return permissions[moduleKey]?.can_download || false
    }

    const canCreate = (moduleKey: string): boolean => {
        return permissions[moduleKey]?.can_create || false
    }

    const canEdit = (moduleKey: string): boolean => {
        return permissions[moduleKey]?.can_edit || false
    }

    const canDelete = (moduleKey: string): boolean => {
        return permissions[moduleKey]?.can_delete || false
    }

    const canExport = (moduleKey: string): boolean => {
        return permissions[moduleKey]?.can_export || false
    }

    const getAvailableFilters = (moduleKey: string): string[] => {
        return permissions[moduleKey]?.available_filters || []
    }

    const getVisibleTabs = (moduleKey: string): string[] => {
        return permissions[moduleKey]?.visible_tabs || []
    }

    const hasFilter = (moduleKey: string, filterKey: string): boolean => {
        const filters = getAvailableFilters(moduleKey)
        return filters.includes(filterKey)
    }

    const canViewTab = (moduleKey: string, tabKey: string): boolean => {
        const tabs = getVisibleTabs(moduleKey)
        return tabs.includes(tabKey) || tabs.includes('all')
    }

    const getAccessibleModules = (): string[] => {
        return Object.keys(permissions).filter(key => permissions[key].access_level !== 'AR')
    }

    return {
        permissions,
        loading,
        refetch: fetchPermissions,

        // Access level checks
        hasAccess,
        hasFullAccess,
        hasPartialAccess,
        getModulePermission,

        // Permission checks
        canView,
        canDownload,
        canCreate,
        canEdit,
        canDelete,
        canExport,

        // Filter and tab checks
        getAvailableFilters,
        getVisibleTabs,
        hasFilter,
        canViewTab,

        // Utility
        getAccessibleModules
    }
}
