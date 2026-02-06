# 🎯 Sistema de Roles y Permisos - Reestructurado

## ✅ Resumen de Cambios Completados

### **1. Base de Datos Actualizada** ✅

#### **Nuevas Tablas:**
- `user_roles_v2` - 8 roles predefinidos
- `module_access_levels` - Permisos por rol y módulo con niveles AC/AP/AR
- Columnas agregadas a `profiles`: `role`, `sucursal`

#### **Función SQL:**
```sql
get_user_permissions_v2(user_id) 
-- Retorna permisos según el rol del usuario
```

---

### **2. Roles Implementados** ✅

| Rol | Clave | Descripción |
|-----|-------|-------------|
| **Administrador** | `admin` | Acceso total al sistema |
| **Preparador** | `preparador` | Preparación de productos |
| **Gerente de Sucursal** | `gerente_sucursal` | Gestión de sucursal |
| **Director de Operaciones** | `director_operaciones` | Dirección operativa |
| **Gerente de Calidad** | `gerente_calidad` | Gestión de calidad y desarrollo |
| **Mostrador** | `mostrador` | Personal de mostrador |
| **Cajera** | `cajera` | Personal de caja |
| **Director de Compras** | `director_compras` | Dirección de compras |

---

### **3. Niveles de Acceso (AC/AP/AR)** ✅

#### **AC - Acceso Completo**
- Puede ver, descargar, crear, editar y eliminar
- Todos los filtros disponibles
- Todas las tabs visibles

#### **AP - Acceso Parcial**
- Puede ver pero con restricciones
- Filtros limitados (sin filtro de sucursal)
- Tabs limitadas (ej: solo "Calidad y Control", no "Análisis Comercial")

#### **AR - Acceso Restringido**
- No puede ver el módulo
- Sin permisos

---

### **4. Permisos por Módulo y Rol** ✅

#### **Catálogo**

| Rol | Nivel | Ver | Descargar | Filtros |
|-----|-------|-----|-----------|---------|
| Admin | AC | ✅ | ✅ | Sucursal, Categoría, Producto |
| Preparador | AC | ✅ | ✅ | Categoría, Producto |
| Gerente Sucursal | AC | ✅ | ✅ | Categoría, Producto |
| Director Operaciones | AC | ✅ | ✅ | Categoría, Producto |
| Gerente Calidad | AC | ✅ | ✅ | Categoría, Producto |
| Mostrador | AC | ✅ | ✅ | Categoría, Producto |
| Cajera | AC | ✅ | ✅ | Categoría, Producto |
| Director Compras | AC | ✅ | ✅ | Categoría, Producto |

#### **Bitácora**

| Rol | Nivel | Ver | Crear | Editar | Filtros |
|-----|-------|-----|-------|--------|---------|
| Admin | AC | ✅ | ✅ | ✅ | Sucursal, Fecha, Categoría, Producto |
| Preparador | AC | ✅ | ✅ | ✅ | Fecha, Categoría, Producto |
| Gerente Sucursal | AR | ❌ | ❌ | ❌ | - |
| Director Operaciones | AR | ❌ | ❌ | ❌ | - |
| Gerente Calidad | AR | ❌ | ❌ | ❌ | - |
| Mostrador | AR | ❌ | ❌ | ❌ | - |
| Cajera | AR | ❌ | ❌ | ❌ | - |
| Director Compras | AR | ❌ | ❌ | ❌ | - |

#### **Control de Calidad**

| Rol | Nivel | Ver | Editar | Eliminar | Filtros |
|-----|-------|-----|--------|----------|---------|
| Admin | AC | ✅ | ✅ | ✅ | Sucursal, Fecha, Estado, Categoría, Producto |
| Preparador | AP | ✅ | ❌ | ❌ | Fecha, Estado, Categoría, Producto |
| Gerente Sucursal | AP | ✅ | ❌ | ❌ | Fecha, Estado, Categoría, Producto |
| Director Operaciones | AP | ✅ | ❌ | ❌ | Fecha, Estado, Categoría, Producto |
| **Gerente Calidad** | **AC** | ✅ | ✅ | ✅ | **Sucursal**, Fecha, Estado, Categoría, Producto |
| Mostrador | AR | ❌ | ❌ | ❌ | - |
| Cajera | AR | ❌ | ❌ | ❌ | - |
| Director Compras | AP | ✅ | ❌ | ❌ | Fecha, Estado, Categoría, Producto |

#### **Reportes**

| Rol | Nivel | Ver | Exportar | Filtros | Tabs Visibles |
|-----|-------|-----|----------|---------|---------------|
| Admin | AC | ✅ | ✅ | Sucursal, Fecha, Categoría, Producto | Calidad y Control, Análisis Comercial |
| Preparador | AP | ✅ | ❌ | Fecha, Categoría, Producto | Solo Calidad y Control |
| Gerente Sucursal | AP | ✅ | ❌ | Fecha, Categoría, Producto | Solo Calidad y Control |
| Director Operaciones | AP | ✅ | ❌ | Fecha, Categoría, Producto | Solo Calidad y Control |
| Gerente Calidad | AP | ✅ | ❌ | Fecha, Categoría, Producto | Solo Calidad y Control |
| Mostrador | AR | ❌ | ❌ | - | - |
| Cajera | AR | ❌ | ❌ | - | - |
| Director Compras | AP | ✅ | ❌ | Fecha, Categoría, Producto | Solo Calidad y Control |

#### **Configuración**

| Rol | Nivel | Ver | Tabs Visibles |
|-----|-------|-----|---------------|
| Admin | AC | ✅ | Perfil, Usuarios, Auditoría |
| Todos los demás | AP | ✅ | Solo Perfil |

---

### **5. Página de Login Actualizada** ✅

**Cambios:**
- ❌ Eliminados campos: "Área" y "Puesto"
- ✅ Agregado selector: "Rol / Puesto" (dropdown con 7 roles)
- ✅ Agregado selector: "Sucursal" (dropdown con sucursales)

**Flujo de Registro:**
1. Usuario ingresa: Nombre, Email, Contraseña
2. Selecciona su Rol (Preparador, Gerente, etc.)
3. Selecciona su Sucursal
4. Al registrarse, el perfil se crea con `role` y `sucursal`
5. Los permisos se asignan automáticamente según el rol

---

### **6. Hook usePermissions Actualizado** ✅

**Nuevas Funciones:**

```typescript
// Verificar nivel de acceso
hasAccess(moduleKey) // Retorna true si NO es AR
hasFullAccess(moduleKey) // Retorna true si es AC
hasPartialAccess(moduleKey) // Retorna true si es AP

// Verificar permisos específicos
canView(moduleKey)
canDownload(moduleKey)
canCreate(moduleKey)
canEdit(moduleKey)
canDelete(moduleKey)
canExport(moduleKey)

// Verificar filtros y tabs
hasFilter(moduleKey, filterKey) // Ej: hasFilter('reportes', 'sucursal')
canViewTab(moduleKey, tabKey) // Ej: canViewTab('reportes', 'analisis_comercial')
getAvailableFilters(moduleKey) // Retorna array de filtros
getVisibleTabs(moduleKey) // Retorna array de tabs
```

**Ejemplo de Uso:**

```tsx
import { usePermissions } from '@/lib/usePermissions'

function ReportesPage() {
    const { hasAccess, hasFilter, canViewTab } = usePermissions()
    
    if (!hasAccess('reportes')) {
        return <AccessDenied />
    }
    
    return (
        <div>
            {/* Filtro de sucursal solo para Admin */}
            {hasFilter('reportes', 'sucursal') && (
                <Select>...</Select>
            )}
            
            {/* Tab de Análisis Comercial solo para Admin */}
            {canViewTab('reportes', 'analisis_comercial') && (
                <TabsContent value="comercial">...</TabsContent>
            )}
        </div>
    )
}
```

---

### **7. Panel de Gestión de Usuarios Actualizado** ✅

**Ruta:** `/configuracion/usuarios`

**Funcionalidades:**
- ✅ Lista todos los usuarios del sistema
- ✅ Muestra rol y sucursal de cada usuario
- ✅ Permite cambiar el rol de un usuario
- ✅ Permite cambiar la sucursal de un usuario
- ✅ Muestra preview de permisos del rol seleccionado
- ✅ Los permisos se asignan automáticamente al cambiar el rol

**Interfaz:**
```
┌──────────────────────────────────────────────────────────┐
│  Gestión de Usuarios                                      │
│  Administra los roles y sucursales de cada usuario        │
│                                                            │
│  🔍 Buscar por nombre o ID...                             │
│                                                            │
│  Usuario  │  Rol         │  Sucursal  │  Registro │ Editar│
│  ─────────┼──────────────┼────────────┼───────────┼───────│
│  Juan P.  │  Preparador  │  Norte     │  01/01/26 │ [✏️] │
│  María G. │  Gerente Cal │  Sur       │  15/01/26 │ [✏️] │
└──────────────────────────────────────────────────────────┘
```

**Dialog de Edición:**
```
┌────────────────────────────────────────────────────────┐
│  🛡️ Editar Usuario: Juan Pérez                         │
│  Cambia el rol y sucursal. Los permisos se asignan     │
│  automáticamente según el rol.                         │
│                                                         │
│  Rol / Puesto:  [Preparador ▼]                        │
│                                                         │
│  Sucursal:      [Norte ▼]                             │
│                                                         │
│  Permisos del Rol:                                     │
│  ┌──────────────────────────────────────────────────┐ │
│  │ Módulo    │ Nivel │ Ver │ Desc │ Crear │ Edit   │ │
│  │ Catálogo  │  AC   │  ✓  │  ✓   │   ✗   │  ✗     │ │
│  │ Bitácora  │  AC   │  ✓  │  ✗   │   ✓   │  ✓     │ │
│  └──────────────────────────────────────────────────┘ │
│                                                         │
│                              [Cancelar]  [💾 Guardar]  │
└────────────────────────────────────────────────────────┘
```

---

### **8. AuthProvider Actualizado** ✅

**Cambios:**
- Agregado campo `role` al interface `Profile`
- El perfil ahora incluye el rol del usuario

---

## 🚀 Cómo Usar el Sistema

### **Para Administradores:**

#### **1. Registrar un Nuevo Usuario**
1. Ir a `/login`
2. Click en "Crear una cuenta nueva"
3. Llenar: Nombre, Email, Contraseña
4. Seleccionar Rol (ej: Preparador)
5. Seleccionar Sucursal (ej: Norte)
6. Click en "Crear Cuenta"

#### **2. Cambiar el Rol de un Usuario**
1. Ir a `/configuracion/usuarios`
2. Click en "Editar" del usuario
3. Seleccionar nuevo rol
4. Seleccionar sucursal
5. Ver preview de permisos
6. Click en "Guardar Cambios"

### **Para Desarrolladores:**

#### **Proteger una Página**

```tsx
'use client'

import { usePermissions } from '@/lib/usePermissions'

export default function BitacoraPage() {
    const { hasAccess, canCreate, loading } = usePermissions()
    
    if (loading) return <Loader />
    
    if (!hasAccess('bitacora')) {
        return (
            <div className="p-8 text-center">
                <p>No tienes acceso a este módulo</p>
            </div>
        )
    }
    
    return (
        <div>
            <h1>Bitácora</h1>
            
            {canCreate('bitacora') && (
                <Button>Crear Registro</Button>
            )}
        </div>
    )
}
```

#### **Filtros Condicionales**

```tsx
const { hasFilter } = usePermissions()

return (
    <div>
        {/* Solo Admin ve filtro de sucursal */}
        {hasFilter('reportes', 'sucursal') && (
            <Select>
                <SelectTrigger>Sucursal</SelectTrigger>
                <SelectContent>
                    {SUCURSALES.map(s => <SelectItem>{s}</SelectItem>)}
                </SelectContent>
            </Select>
        )}
        
        {/* Todos ven filtro de categoría */}
        {hasFilter('reportes', 'categoria') && (
            <Select>...</Select>
        )}
    </div>
)
```

#### **Tabs Condicionales**

```tsx
const { canViewTab } = usePermissions()

return (
    <Tabs>
        <TabsList>
            <TabsTrigger value="calidad">Calidad y Control</TabsTrigger>
            
            {/* Solo Admin ve Análisis Comercial */}
            {canViewTab('reportes', 'analisis_comercial') && (
                <TabsTrigger value="comercial">Análisis Comercial</TabsTrigger>
            )}
        </TabsList>
        
        <TabsContent value="calidad">...</TabsContent>
        
        {canViewTab('reportes', 'analisis_comercial') && (
            <TabsContent value="comercial">...</TabsContent>
        )}
    </Tabs>
)
```

---

## 📝 Próximos Pasos

### **Integración en Módulos:**

1. **Catálogo** - Ocultar botón de descarga para AP
2. **Bitácora** - Restringir acceso según rol
3. **Control de Calidad** - Ocultar columna de acciones para AP
4. **Reportes** - Ocultar filtro de sucursal y tab comercial para AP
5. **Configuración** - Ocultar tabs de usuarios y auditoría para AP

### **Ejemplo de Integración en Reportes:**

```tsx
// app/reportes/page.tsx
const { hasFilter, canViewTab } = usePermissions()

// En la sección de filtros:
{hasFilter('reportes', 'sucursal') && (
    <Select>
        <SelectTrigger>Sucursal</SelectTrigger>
        ...
    </Select>
)}

// En las tabs:
<Tabs>
    <TabsList>
        <TabsTrigger value="calidad">Calidad y Control</TabsTrigger>
        {canViewTab('reportes', 'analisis_comercial') && (
            <TabsTrigger value="comercial">Análisis Comercial</TabsTrigger>
        )}
    </TabsList>
    
    <TabsContent value="calidad">...</TabsContent>
    
    {canViewTab('reportes', 'analisis_comercial') && (
        <TabsContent value="comercial">...</TabsContent>
    )}
</Tabs>
```

---

## 🎯 Ventajas del Nuevo Sistema

✅ **Simplificado** - Un solo campo (rol) define todos los permisos  
✅ **Escalable** - Fácil agregar nuevos roles  
✅ **Granular** - Control fino por módulo (AC/AP/AR)  
✅ **Filtros Dinámicos** - Cada rol ve solo los filtros que necesita  
✅ **Tabs Condicionales** - Oculta secciones según el rol  
✅ **Auditable** - Registro de quién tiene qué permisos  
✅ **Mantenible** - Cambiar permisos de un rol afecta a todos los usuarios con ese rol  
✅ **UX Mejorada** - Usuarios solo ven lo que pueden usar  

---

**Última actualización**: 05 de Febrero, 2026  
**Versión**: 2.0.0 (Sistema Reestructurado)
