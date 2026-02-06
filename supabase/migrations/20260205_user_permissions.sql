-- =====================================================
-- SISTEMA DE PERMISOS Y ROLES - QUALITY HUB GINEZ
-- =====================================================

-- 1. Tabla de Roles
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabla de Módulos del Sistema
CREATE TABLE IF NOT EXISTS system_modules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    module_key TEXT UNIQUE NOT NULL, -- 'panel_principal', 'control_calidad', etc.
    module_name TEXT NOT NULL,
    module_description TEXT,
    module_icon TEXT, -- Nombre del icono de lucide-react
    module_route TEXT, -- Ruta en la app
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabla de Permisos de Usuario (relación user-module)
CREATE TABLE IF NOT EXISTS user_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    module_id UUID REFERENCES system_modules(id) ON DELETE CASCADE,
    can_view BOOLEAN DEFAULT FALSE,
    can_create BOOLEAN DEFAULT FALSE,
    can_edit BOOLEAN DEFAULT FALSE,
    can_delete BOOLEAN DEFAULT FALSE,
    can_export BOOLEAN DEFAULT FALSE,
    granted_by UUID REFERENCES auth.users(id), -- Admin que otorgó el permiso
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, module_id)
);

-- 4. Tabla de Asignación de Roles
CREATE TABLE IF NOT EXISTS user_role_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role_id UUID REFERENCES user_roles(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES auth.users(id),
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, role_id)
);

-- 5. Tabla de Permisos por Rol (template de permisos)
CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_id UUID REFERENCES user_roles(id) ON DELETE CASCADE,
    module_id UUID REFERENCES system_modules(id) ON DELETE CASCADE,
    can_view BOOLEAN DEFAULT FALSE,
    can_create BOOLEAN DEFAULT FALSE,
    can_edit BOOLEAN DEFAULT FALSE,
    can_delete BOOLEAN DEFAULT FALSE,
    can_export BOOLEAN DEFAULT FALSE,
    UNIQUE(role_id, module_id)
);

-- =====================================================
-- INSERTAR ROLES PREDEFINIDOS
-- =====================================================

INSERT INTO user_roles (name, description) VALUES
    ('Administrador', 'Acceso completo a todos los módulos del sistema'),
    ('Supervisor', 'Acceso a reportes y supervisión de calidad'),
    ('Operador', 'Acceso a registro de bitácora y control de calidad'),
    ('Consulta', 'Solo lectura de reportes y datos')
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- INSERTAR MÓDULOS DEL SISTEMA
-- =====================================================

INSERT INTO system_modules (module_key, module_name, module_description, module_icon, module_route, display_order) VALUES
    ('panel_principal', 'Panel Principal', 'Vista general del sistema', 'LayoutDashboard', '/', 1),
    ('catalogo', 'Catálogo', 'Gestión de productos y categorías', 'BookOpen', '/catalog', 2),
    ('control_calidad', 'Control Calidad', 'Gestión de mediciones y estándares', 'Activity', '/calidad', 3),
    ('bitacora', 'Bitácora', 'Registro de producción y calidad', 'ClipboardList', '/bitacora', 4),
    ('laboratorio', 'Laboratorio I+D', 'Investigación y desarrollo', 'FlaskConical', '/laboratorio', 5),
    ('reportes', 'Reportes', 'Análisis y visualización de datos', 'BarChart3', '/reportes', 6),
    ('configuracion', 'Configuración', 'Ajustes del sistema y usuarios', 'Settings', '/configuracion', 7)
ON CONFLICT (module_key) DO NOTHING;

-- =====================================================
-- PERMISOS POR ROL (TEMPLATES)
-- =====================================================

-- Administrador: Acceso completo a todo
INSERT INTO role_permissions (role_id, module_id, can_view, can_create, can_edit, can_delete, can_export)
SELECT 
    r.id,
    m.id,
    TRUE, TRUE, TRUE, TRUE, TRUE
FROM user_roles r
CROSS JOIN system_modules m
WHERE r.name = 'Administrador'
ON CONFLICT (role_id, module_id) DO NOTHING;

-- Supervisor: Ver todo, editar reportes y calidad
INSERT INTO role_permissions (role_id, module_id, can_view, can_create, can_edit, can_delete, can_export)
SELECT 
    r.id,
    m.id,
    TRUE,
    CASE WHEN m.module_key IN ('control_calidad', 'reportes') THEN TRUE ELSE FALSE END,
    CASE WHEN m.module_key IN ('control_calidad', 'reportes') THEN TRUE ELSE FALSE END,
    FALSE,
    TRUE
FROM user_roles r
CROSS JOIN system_modules m
WHERE r.name = 'Supervisor'
ON CONFLICT (role_id, module_id) DO NOTHING;

-- Operador: Acceso a bitácora y control de calidad
INSERT INTO role_permissions (role_id, module_id, can_view, can_create, can_edit, can_delete, can_export)
SELECT 
    r.id,
    m.id,
    CASE WHEN m.module_key IN ('panel_principal', 'catalogo', 'control_calidad', 'bitacora', 'reportes') THEN TRUE ELSE FALSE END,
    CASE WHEN m.module_key IN ('bitacora', 'control_calidad') THEN TRUE ELSE FALSE END,
    CASE WHEN m.module_key IN ('bitacora') THEN TRUE ELSE FALSE END,
    FALSE,
    FALSE
FROM user_roles r
CROSS JOIN system_modules m
WHERE r.name = 'Operador'
ON CONFLICT (role_id, module_id) DO NOTHING;

-- Consulta: Solo lectura
INSERT INTO role_permissions (role_id, module_id, can_view, can_create, can_edit, can_delete, can_export)
SELECT 
    r.id,
    m.id,
    CASE WHEN m.module_key IN ('panel_principal', 'catalogo', 'reportes') THEN TRUE ELSE FALSE END,
    FALSE, FALSE, FALSE, FALSE
FROM user_roles r
CROSS JOIN system_modules m
WHERE r.name = 'Consulta'
ON CONFLICT (role_id, module_id) DO NOTHING;

-- =====================================================
-- FUNCIONES AUXILIARES
-- =====================================================

-- Función para obtener permisos de un usuario
CREATE OR REPLACE FUNCTION get_user_permissions(p_user_id UUID)
RETURNS TABLE (
    module_key TEXT,
    module_name TEXT,
    module_route TEXT,
    can_view BOOLEAN,
    can_create BOOLEAN,
    can_edit BOOLEAN,
    can_delete BOOLEAN,
    can_export BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.module_key,
        m.module_name,
        m.module_route,
        COALESCE(up.can_view, FALSE) as can_view,
        COALESCE(up.can_create, FALSE) as can_create,
        COALESCE(up.can_edit, FALSE) as can_edit,
        COALESCE(up.can_delete, FALSE) as can_delete,
        COALESCE(up.can_export, FALSE) as can_export
    FROM system_modules m
    LEFT JOIN user_permissions up ON m.id = up.module_id AND up.user_id = p_user_id
    WHERE m.is_active = TRUE
    ORDER BY m.display_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para verificar si un usuario tiene permiso
CREATE OR REPLACE FUNCTION check_user_permission(
    p_user_id UUID,
    p_module_key TEXT,
    p_permission_type TEXT -- 'view', 'create', 'edit', 'delete', 'export'
)
RETURNS BOOLEAN AS $$
DECLARE
    v_has_permission BOOLEAN;
BEGIN
    SELECT 
        CASE p_permission_type
            WHEN 'view' THEN COALESCE(up.can_view, FALSE)
            WHEN 'create' THEN COALESCE(up.can_create, FALSE)
            WHEN 'edit' THEN COALESCE(up.can_edit, FALSE)
            WHEN 'delete' THEN COALESCE(up.can_delete, FALSE)
            WHEN 'export' THEN COALESCE(up.can_export, FALSE)
            ELSE FALSE
        END INTO v_has_permission
    FROM system_modules m
    LEFT JOIN user_permissions up ON m.id = up.module_id AND up.user_id = p_user_id
    WHERE m.module_key = p_module_key;
    
    RETURN COALESCE(v_has_permission, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- ÍNDICES PARA RENDIMIENTO
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_module ON user_permissions(module_id);
CREATE INDEX IF NOT EXISTS idx_user_role_assignments_user ON user_role_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- Los usuarios pueden ver sus propios permisos
CREATE POLICY "Users can view own permissions"
    ON user_permissions FOR SELECT
    USING (auth.uid() = user_id);

-- Solo admins pueden modificar permisos
CREATE POLICY "Only admins can modify permissions"
    ON user_permissions FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_permissions up
            JOIN system_modules m ON up.module_id = m.id
            WHERE up.user_id = auth.uid()
            AND m.module_key = 'configuracion'
            AND up.can_edit = TRUE
        )
    );

-- Todos pueden ver roles
CREATE POLICY "Anyone can view roles"
    ON user_roles FOR SELECT
    USING (TRUE);

-- Todos pueden ver módulos activos
CREATE POLICY "Anyone can view active modules"
    ON system_modules FOR SELECT
    USING (is_active = TRUE);

COMMENT ON TABLE user_permissions IS 'Permisos individuales de usuarios por módulo';
COMMENT ON TABLE user_roles IS 'Roles del sistema (Admin, Supervisor, Operador, etc.)';
COMMENT ON TABLE system_modules IS 'Módulos disponibles en el sistema';
COMMENT ON TABLE role_permissions IS 'Template de permisos por rol';
