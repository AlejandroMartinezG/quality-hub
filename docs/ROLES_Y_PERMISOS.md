# 🛡️ Sistema de Roles y Permisos - Quality Hub GINEZ

## 📋 Roles Disponibles

El sistema cuenta con **5 roles predefinidos**, cada uno con permisos específicos:

---

### **1. 👑 Administrador**
**Descripción**: Acceso completo a todos los módulos del sistema

| Módulo | Ver | Crear | Editar | Eliminar | Exportar |
|--------|-----|-------|--------|----------|----------|
| Panel Principal | ✅ | ✅ | ✅ | ✅ | ✅ |
| Catálogo | ✅ | ✅ | ✅ | ✅ | ✅ |
| Control Calidad | ✅ | ✅ | ✅ | ✅ | ✅ |
| Bitácora | ✅ | ✅ | ✅ | ✅ | ✅ |
| Laboratorio I+D | ✅ | ✅ | ✅ | ✅ | ✅ |
| Reportes | ✅ | ✅ | ✅ | ✅ | ✅ |
| Configuración | ✅ | ✅ | ✅ | ✅ | ✅ |

**Casos de uso**: Gerentes, Administradores del sistema, IT

---

### **2. 👨‍🔬 Supervisor**
**Descripción**: Acceso a reportes y supervisión de calidad

| Módulo | Ver | Crear | Editar | Eliminar | Exportar |
|--------|-----|-------|--------|----------|----------|
| Panel Principal | ✅ | ❌ | ❌ | ❌ | ✅ |
| Catálogo | ✅ | ❌ | ❌ | ❌ | ✅ |
| Control Calidad | ✅ | ✅ | ✅ | ❌ | ✅ |
| Bitácora | ✅ | ❌ | ❌ | ❌ | ✅ |
| Laboratorio I+D | ✅ | ❌ | ❌ | ❌ | ✅ |
| Reportes | ✅ | ✅ | ✅ | ❌ | ✅ |
| Configuración | ✅ | ❌ | ❌ | ❌ | ✅ |

**Casos de uso**: Supervisores de calidad, Jefes de área, Analistas

---

### **3. 👷 Operador**
**Descripción**: Acceso a registro de bitácora y control de calidad

| Módulo | Ver | Crear | Editar | Eliminar | Exportar |
|--------|-----|-------|--------|----------|----------|
| Panel Principal | ✅ | ❌ | ❌ | ❌ | ❌ |
| Catálogo | ✅ | ❌ | ❌ | ❌ | ❌ |
| Control Calidad | ✅ | ✅ | ❌ | ❌ | ❌ |
| Bitácora | ✅ | ✅ | ✅ | ❌ | ❌ |
| Laboratorio I+D | ❌ | ❌ | ❌ | ❌ | ❌ |
| Reportes | ✅ | ❌ | ❌ | ❌ | ❌ |
| Configuración | ❌ | ❌ | ❌ | ❌ | ❌ |

**Casos de uso**: Operadores de producción, Personal de calidad en planta

---

### **4. 🧪 Preparador** ⭐ NUEVO
**Descripción**: Acceso a bitácora y catálogo para preparación de productos

| Módulo | Ver | Crear | Editar | Eliminar | Exportar |
|--------|-----|-------|--------|----------|----------|
| Panel Principal | ✅ | ❌ | ❌ | ❌ | ❌ |
| Catálogo | ✅ | ❌ | ❌ | ❌ | ❌ |
| Control Calidad | ❌ | ❌ | ❌ | ❌ | ❌ |
| Bitácora | ✅ | ✅ | ✅ | ❌ | ❌ |
| Laboratorio I+D | ❌ | ❌ | ❌ | ❌ | ❌ |
| Reportes | ❌ | ❌ | ❌ | ❌ | ❌ |
| Configuración | ❌ | ❌ | ❌ | ❌ | ❌ |

**Casos de uso**: Preparadores de producto, Personal de mezclado, Técnicos de formulación

**Características especiales**:
- ✅ Puede consultar el catálogo para ver fórmulas y especificaciones
- ✅ Puede registrar lotes en la bitácora
- ✅ Puede editar sus propios registros de bitácora
- ❌ No tiene acceso a control de calidad (eso lo hace otro rol)
- ❌ No puede ver reportes ni análisis

---

### **5. 👁️ Consulta**
**Descripción**: Solo lectura de reportes y datos

| Módulo | Ver | Crear | Editar | Eliminar | Exportar |
|--------|-----|-------|--------|----------|----------|
| Panel Principal | ✅ | ❌ | ❌ | ❌ | ❌ |
| Catálogo | ✅ | ❌ | ❌ | ❌ | ❌ |
| Control Calidad | ❌ | ❌ | ❌ | ❌ | ❌ |
| Bitácora | ❌ | ❌ | ❌ | ❌ | ❌ |
| Laboratorio I+D | ❌ | ❌ | ❌ | ❌ | ❌ |
| Reportes | ✅ | ❌ | ❌ | ❌ | ❌ |
| Configuración | ❌ | ❌ | ❌ | ❌ | ❌ |

**Casos de uso**: Visitantes, Auditores externos, Personal de ventas

---

## 🎯 Cómo Asignar Permisos a un Usuario

### **Opción 1: Asignar Permisos Manualmente** (Recomendado)

1. **Ir a Configuración**:
   ```
   Menú lateral → Configuración → Pestaña "Usuarios"
   ```

2. **Click en "Gestionar Permisos"**:
   - Te lleva a `/configuracion/usuarios`

3. **Buscar el usuario**:
   - Usa la barra de búsqueda si tienes muchos usuarios

4. **Click en el botón "🛡️ Permisos"** del usuario

5. **Configurar permisos**:
   - Activa/desactiva los switches según el rol que quieras asignar
   - Para un **Preparador**, activa:
     - ✅ Panel Principal → Ver
     - ✅ Catálogo → Ver
     - ✅ Bitácora → Ver, Crear, Editar

6. **Guardar cambios**

---

### **Opción 2: Asignar Rol Completo via SQL** (Avanzado)

Si quieres asignar todos los permisos de un rol de una vez:

```sql
-- 1. Obtener el ID del usuario (reemplaza el email)
SELECT id FROM auth.users WHERE email = 'preparador@ginez.com';

-- 2. Copiar el ID y usarlo aquí (reemplaza USER_ID_AQUI)
-- 3. Obtener el ID del rol de Preparador
DO $$
DECLARE
    v_user_id UUID := 'USER_ID_AQUI'; -- Pega el ID del paso 1
    v_role_id UUID;
    v_module RECORD;
BEGIN
    -- Obtener ID del rol Preparador
    SELECT id INTO v_role_id FROM user_roles WHERE name = 'Preparador';
    
    -- Copiar permisos del rol a este usuario
    FOR v_module IN 
        SELECT module_id, can_view, can_create, can_edit, can_delete, can_export
        FROM role_permissions
        WHERE role_id = v_role_id
    LOOP
        INSERT INTO user_permissions (
            user_id, module_id, can_view, can_create, can_edit, can_delete, can_export
        ) VALUES (
            v_user_id, 
            v_module.module_id,
            v_module.can_view,
            v_module.can_create,
            v_module.can_edit,
            v_module.can_delete,
            v_module.can_export
        )
        ON CONFLICT (user_id, module_id) 
        DO UPDATE SET
            can_view = EXCLUDED.can_view,
            can_create = EXCLUDED.can_create,
            can_edit = EXCLUDED.can_edit,
            can_delete = EXCLUDED.can_delete,
            can_export = EXCLUDED.can_export;
    END LOOP;
END $$;
```

---

## 📊 Comparación de Roles

| Característica | Admin | Supervisor | Operador | Preparador | Consulta |
|----------------|-------|------------|----------|------------|----------|
| Ver Panel | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ver Catálogo | ✅ | ✅ | ✅ | ✅ | ✅ |
| Registrar Bitácora | ✅ | ❌ | ✅ | ✅ | ❌ |
| Editar Bitácora | ✅ | ❌ | ✅ | ✅ | ❌ |
| Control de Calidad | ✅ | ✅ | ✅ | ❌ | ❌ |
| Ver Reportes | ✅ | ✅ | ✅ | ❌ | ✅ |
| Exportar Datos | ✅ | ✅ | ❌ | ❌ | ❌ |
| Configuración | ✅ | ❌ | ❌ | ❌ | ❌ |
| Laboratorio I+D | ✅ | ✅ | ❌ | ❌ | ❌ |

---

## 🔐 Ejemplo de Flujo de Trabajo

### **Escenario: Preparación y Control de un Lote**

1. **Preparador** (Juan):
   - ✅ Consulta el catálogo para ver la fórmula del producto
   - ✅ Prepara el lote siguiendo las especificaciones
   - ✅ Registra el lote en la bitácora con datos básicos
   - ❌ NO puede hacer el control de calidad

2. **Operador** (María):
   - ✅ Ve el lote registrado por Juan en la bitácora
   - ✅ Toma muestras y hace mediciones de calidad
   - ✅ Registra pH, sólidos, y otros parámetros
   - ✅ Marca el lote como conforme/no conforme

3. **Supervisor** (Carlos):
   - ✅ Revisa todos los registros en Reportes
   - ✅ Analiza tendencias y gráficas de control
   - ✅ Exporta datos para análisis externo
   - ✅ Puede editar parámetros de calidad si es necesario

4. **Administrador** (Tú):
   - ✅ Acceso completo a todo
   - ✅ Gestiona usuarios y permisos
   - ✅ Configura el sistema

---

## 🚀 Recomendaciones

### **Para Asignar Roles**:

1. **Principio de Mínimo Privilegio**: 
   - Asigna solo los permisos necesarios para el trabajo
   - Ejemplo: Un preparador NO necesita ver reportes

2. **Separación de Responsabilidades**:
   - Quien prepara NO debería ser quien valida calidad
   - Evita conflictos de interés

3. **Revisión Periódica**:
   - Revisa permisos cada 3-6 meses
   - Revoca accesos de usuarios inactivos

4. **Documentación**:
   - Mantén registro de quién tiene qué permisos
   - Documenta cambios importantes

---

## 📝 Notas Importantes

- ⚠️ Los cambios de permisos son **inmediatos**
- ⚠️ Los usuarios deben **recargar la página** para ver los cambios
- ⚠️ Solo los **Administradores** pueden gestionar permisos
- ⚠️ Los permisos se guardan en Supabase de forma segura
- ⚠️ Cada cambio de permisos queda registrado (auditoría)

---

## 🆘 Solución de Problemas

### **Usuario no puede acceder a un módulo**:
1. Verificar que tiene permiso de "Ver" activado
2. Pedirle que recargue la página (F5)
3. Revisar en Configuración → Usuarios → Permisos

### **Cambios no se reflejan**:
1. Recargar la página del usuario
2. Verificar que se guardaron los cambios
3. Revisar la consola del navegador (F12) por errores

### **No aparece el botón "Gestionar Permisos"**:
1. Solo los administradores lo ven
2. Verificar que estás en la pestaña "Usuarios"
3. Verificar que tu usuario tiene `is_admin = true`

---

**Última actualización**: 05 de Febrero, 2026  
**Versión del sistema**: 1.0.0
