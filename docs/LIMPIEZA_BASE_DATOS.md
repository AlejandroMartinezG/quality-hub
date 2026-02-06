# 🧹 Guía de Limpieza de Base de Datos - Supabase

## 📊 Estado Actual de Tablas

### **✅ TABLAS ACTIVAS (Sistema Nuevo - V2)**

Estas tablas son las que **SÍ SE USAN** en el sistema actual:

1. **`profiles`** ✅
   - Almacena información de usuarios
   - Campos importantes: `id`, `full_name`, `email`, `role`, `sucursal`
   - **NO ELIMINAR**

2. **`user_roles_v2`** ✅
   - Define los 8 roles del sistema
   - Campos: `role_key`, `role_name`, `description`
   - **NO ELIMINAR**

3. **`module_access_levels`** ✅
   - Permisos por rol y módulo (AC/AP/AR)
   - Campos: `role_key`, `module_key`, `access_level`, permisos, filtros, tabs
   - **NO ELIMINAR**

4. **Tablas de Datos** ✅
   - `bitacora_produccion_calidad` - Registros de producción
   - `download_logs` - Logs de descargas
   - **NO ELIMINAR**

---

### **❌ TABLAS OBSOLETAS (Sistema Antiguo - V1)**

Estas tablas son del sistema antiguo y **PUEDEN ELIMINARSE**:

1. **`system_modules`** ❌
   - Era para definir módulos del sistema
   - **Reemplazada por**: Permisos hardcodeados en `module_access_levels`
   - **PUEDE ELIMINARSE**

2. **`user_permissions`** ❌
   - Era para permisos individuales por usuario
   - **Reemplazada por**: `module_access_levels` (permisos por rol)
   - **PUEDE ELIMINARSE**

3. **`user_roles`** ❌
   - Era para roles del sistema antiguo
   - **Reemplazada por**: `user_roles_v2`
   - **PUEDE ELIMINARSE**

4. **`role_permissions`** ❌
   - Era para permisos de roles (sistema antiguo)
   - **Reemplazada por**: `module_access_levels`
   - **PUEDE ELIMINARSE**

---

## 🗑️ Script de Limpieza

### **Opción 1: Eliminar Tablas Obsoletas (Recomendado)**

```sql
-- ADVERTENCIA: Esto eliminará las tablas del sistema antiguo
-- Asegúrate de tener un backup antes de ejecutar

-- Eliminar tablas obsoletas
DROP TABLE IF EXISTS user_permissions CASCADE;
DROP TABLE IF EXISTS role_permissions CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TABLE IF EXISTS system_modules CASCADE;

-- Verificar que solo queden las tablas activas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

### **Opción 2: Renombrar (Más Seguro)**

Si prefieres no eliminar inmediatamente, puedes renombrar las tablas:

```sql
-- Renombrar tablas obsoletas para marcarlas como antiguas
ALTER TABLE user_permissions RENAME TO _old_user_permissions;
ALTER TABLE role_permissions RENAME TO _old_role_permissions;
ALTER TABLE user_roles RENAME TO _old_user_roles;
ALTER TABLE system_modules RENAME TO _old_system_modules;

-- Después de confirmar que todo funciona, eliminarlas:
-- DROP TABLE IF EXISTS _old_user_permissions CASCADE;
-- DROP TABLE IF EXISTS _old_role_permissions CASCADE;
-- DROP TABLE IF EXISTS _old_user_roles CASCADE;
-- DROP TABLE IF EXISTS _old_system_modules CASCADE;
```

---

## 📋 Verificación Post-Limpieza

Después de limpiar, verifica que todo funcione:

### **1. Verificar Tablas Activas**

```sql
-- Debe mostrar solo las tablas necesarias
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
  AND table_name NOT LIKE '_old_%'
ORDER BY table_name;
```

Resultado esperado:
```
bitacora_produccion_calidad
download_logs
module_access_levels
profiles
user_roles_v2
```

### **2. Verificar Roles**

```sql
-- Debe mostrar 8 roles
SELECT role_key, role_name FROM user_roles_v2 ORDER BY role_name;
```

Resultado esperado:
```
admin                  | Administrador
cajera                 | Cajera
director_compras       | Director de Compras
director_operaciones   | Director de Operaciones
gerente_calidad        | Gerente de Calidad y Desarrollo
gerente_sucursal       | Gerente de Sucursal
mostrador              | Mostrador
preparador             | Preparador
```

### **3. Verificar Permisos**

```sql
-- Debe mostrar 40 registros (8 roles × 5 módulos)
SELECT COUNT(*) as total_permisos FROM module_access_levels;
```

Resultado esperado: `40`

### **4. Verificar Usuarios**

```sql
-- Ver usuarios con sus roles
SELECT full_name, email, role, sucursal 
FROM profiles 
ORDER BY updated_at DESC;
```

---

## 🔧 Funciones y Triggers

### **Funciones Activas** ✅

1. **`get_user_permissions_v2(user_id)`**
   - Obtiene permisos de un usuario según su rol
   - **NO ELIMINAR**

### **Funciones Obsoletas** ❌

Si existen estas funciones del sistema antiguo, pueden eliminarse:

```sql
-- Verificar funciones existentes
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_type = 'FUNCTION'
ORDER BY routine_name;

-- Eliminar funciones obsoletas (si existen)
DROP FUNCTION IF EXISTS get_user_permissions(uuid);
DROP FUNCTION IF EXISTS check_user_permission(uuid, text, text);
```

---

## 📝 Resumen de Acciones

### **Paso 1: Backup**
```sql
-- Crear backup de las tablas antes de eliminar
-- (Hacer esto desde el dashboard de Supabase)
```

### **Paso 2: Eliminar Tablas Obsoletas**
```sql
DROP TABLE IF EXISTS user_permissions CASCADE;
DROP TABLE IF EXISTS role_permissions CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TABLE IF EXISTS system_modules CASCADE;
```

### **Paso 3: Eliminar Funciones Obsoletas**
```sql
DROP FUNCTION IF EXISTS get_user_permissions(uuid);
DROP FUNCTION IF EXISTS check_user_permission(uuid, text, text);
```

### **Paso 4: Verificar**
```sql
-- Ver tablas restantes
\dt

-- Ver funciones restantes
\df
```

---

## ⚠️ IMPORTANTE

**Antes de ejecutar cualquier comando de eliminación:**

1. ✅ Hacer backup completo de la base de datos
2. ✅ Verificar que el sistema funcione con las nuevas tablas
3. ✅ Probar el login y gestión de usuarios
4. ✅ Confirmar que los permisos funcionen correctamente

**Solo después de confirmar que todo funciona, proceder con la limpieza.**

---

## 🎯 Estado Final Esperado

Después de la limpieza, deberías tener:

### **Tablas:**
- ✅ `profiles`
- ✅ `user_roles_v2`
- ✅ `module_access_levels`
- ✅ `bitacora_produccion_calidad`
- ✅ `download_logs`

### **Funciones:**
- ✅ `get_user_permissions_v2(uuid)`

### **Políticas RLS:**
- ✅ Políticas en `profiles`
- ✅ Políticas en `user_roles_v2`
- ✅ Políticas en `module_access_levels`

---

**Fecha**: 05 de Febrero, 2026  
**Versión**: 2.0.0 (Post-Reestructuración)
