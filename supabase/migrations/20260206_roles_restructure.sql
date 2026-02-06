-- =====================================================
-- REESTRUCTURACIÓN DE ROLES Y PERMISOS - QUALITY HUB GINEZ
-- Sistema simplificado con roles de puesto y niveles AC/AP/AR
-- =====================================================

-- 1. LIMPIAR SISTEMA ANTERIOR (Opcional - comentado por seguridad)
-- DROP TABLE IF EXISTS user_permissions CASCADE;
-- DROP TABLE IF EXISTS role_permissions CASCADE;
-- DROP TABLE IF EXISTS user_role_assignments CASCADE;
-- DROP TABLE IF EXISTS user_roles CASCADE;
-- DROP TABLE IF EXISTS system_modules CASCADE;

-- 2. ACTUALIZAR TABLA DE PERFILES
-- Agregar columna de rol/puesto y sucursal
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'Preparador',
ADD COLUMN IF NOT EXISTS sucursal TEXT;

-- Comentar: El campo 'area' y 'position' se mantienen por compatibilidad pero ya no son obligatorios

-- 3. CREAR TABLA DE ROLES (Puestos)
CREATE TABLE IF NOT EXISTS user_roles_v2 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_key TEXT UNIQUE NOT NULL, -- 'admin', 'preparador', 'gerente_sucursal', etc.
    role_name TEXT NOT NULL, -- 'Administrador', 'Preparador', etc.
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. CREAR TABLA DE MÓDULOS CON NIVELES DE ACCESO
CREATE TABLE IF NOT EXISTS module_access_levels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_key TEXT NOT NULL REFERENCES user_roles_v2(role_key) ON DELETE CASCADE,
    module_key TEXT NOT NULL, -- 'catalogo', 'bitacora', 'control_calidad', etc.
    access_level TEXT NOT NULL CHECK (access_level IN ('AC', 'AP', 'AR')), -- Acceso Completo, Parcial, Restringido
    
    -- Permisos específicos por nivel (se definen según el módulo)
    can_view BOOLEAN DEFAULT FALSE,
    can_download BOOLEAN DEFAULT FALSE,
    can_create BOOLEAN DEFAULT FALSE,
    can_edit BOOLEAN DEFAULT FALSE,
    can_delete BOOLEAN DEFAULT FALSE,
    can_export BOOLEAN DEFAULT FALSE,
    
    -- Filtros disponibles (JSON con array de filtros permitidos)
    available_filters JSONB DEFAULT '[]'::jsonb,
    
    -- Tabs/secciones visibles (JSON con array de tabs)
    visible_tabs JSONB DEFAULT '[]'::jsonb,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(role_key, module_key)
);

-- =====================================================
-- INSERTAR ROLES (PUESTOS)
-- =====================================================

INSERT INTO user_roles_v2 (role_key, role_name, description) VALUES
    ('admin', 'Administrador', 'Acceso total al sistema'),
    ('preparador', 'Preparador', 'Personal de preparación de productos'),
    ('gerente_sucursal', 'Gerente de Sucursal', 'Gerente de sucursal'),
    ('director_operaciones', 'Director de Operaciones', 'Director de operaciones'),
    ('gerente_calidad', 'Gerente de Calidad y Desarrollo', 'Gerente de calidad y desarrollo'),
    ('mostrador', 'Mostrador', 'Personal de mostrador'),
    ('cajera', 'Cajera', 'Personal de caja'),
    ('director_compras', 'Director de Compras', 'Director de compras')
ON CONFLICT (role_key) DO NOTHING;

-- =====================================================
-- CONFIGURAR PERMISOS POR ROL Y MÓDULO
-- =====================================================

-- ADMINISTRADOR - Acceso Completo a Todo
INSERT INTO module_access_levels (role_key, module_key, access_level, can_view, can_download, can_create, can_edit, can_delete, can_export, available_filters, visible_tabs) VALUES
    ('admin', 'catalogo', 'AC', TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, '["sucursal", "categoria", "producto"]'::jsonb, '["all"]'::jsonb),
    ('admin', 'bitacora', 'AC', TRUE, FALSE, TRUE, TRUE, TRUE, TRUE, '["sucursal", "fecha", "categoria", "producto"]'::jsonb, '["all"]'::jsonb),
    ('admin', 'control_calidad', 'AC', TRUE, FALSE, FALSE, TRUE, TRUE, TRUE, '["sucursal", "fecha", "estado", "categoria", "producto"]'::jsonb, '["all"]'::jsonb),
    ('admin', 'reportes', 'AC', TRUE, FALSE, FALSE, FALSE, FALSE, TRUE, '["sucursal", "fecha", "categoria", "producto"]'::jsonb, '["calidad_control", "analisis_comercial"]'::jsonb),
    ('admin', 'configuracion', 'AC', TRUE, FALSE, TRUE, TRUE, TRUE, FALSE, '[]'::jsonb, '["perfil", "usuarios", "auditoria"]'::jsonb)
ON CONFLICT (role_key, module_key) DO UPDATE SET
    access_level = EXCLUDED.access_level,
    can_view = EXCLUDED.can_view,
    can_download = EXCLUDED.can_download,
    can_create = EXCLUDED.can_create,
    can_edit = EXCLUDED.can_edit,
    can_delete = EXCLUDED.can_delete,
    can_export = EXCLUDED.can_export,
    available_filters = EXCLUDED.available_filters,
    visible_tabs = EXCLUDED.visible_tabs;

-- PREPARADOR
INSERT INTO module_access_levels (role_key, module_key, access_level, can_view, can_download, can_create, can_edit, can_delete, can_export, available_filters, visible_tabs) VALUES
    ('preparador', 'catalogo', 'AC', TRUE, TRUE, FALSE, FALSE, FALSE, FALSE, '["categoria", "producto"]'::jsonb, '["all"]'::jsonb),
    ('preparador', 'bitacora', 'AC', TRUE, FALSE, TRUE, TRUE, FALSE, FALSE, '["fecha", "categoria", "producto"]'::jsonb, '["all"]'::jsonb),
    ('preparador', 'control_calidad', 'AP', TRUE, FALSE, FALSE, FALSE, FALSE, FALSE, '["fecha", "estado", "categoria", "producto"]'::jsonb, '["all"]'::jsonb),
    ('preparador', 'reportes', 'AP', TRUE, FALSE, FALSE, FALSE, FALSE, FALSE, '["fecha", "categoria", "producto"]'::jsonb, '["calidad_control"]'::jsonb),
    ('preparador', 'configuracion', 'AP', TRUE, FALSE, FALSE, FALSE, FALSE, FALSE, '[]'::jsonb, '["perfil"]'::jsonb)
ON CONFLICT (role_key, module_key) DO UPDATE SET
    access_level = EXCLUDED.access_level,
    can_view = EXCLUDED.can_view,
    can_download = EXCLUDED.can_download,
    can_create = EXCLUDED.can_create,
    can_edit = EXCLUDED.can_edit,
    can_delete = EXCLUDED.can_delete,
    can_export = EXCLUDED.can_export,
    available_filters = EXCLUDED.available_filters,
    visible_tabs = EXCLUDED.visible_tabs;

-- GERENTE DE SUCURSAL
INSERT INTO module_access_levels (role_key, module_key, access_level, can_view, can_download, can_create, can_edit, can_delete, can_export, available_filters, visible_tabs) VALUES
    ('gerente_sucursal', 'catalogo', 'AC', TRUE, TRUE, FALSE, FALSE, FALSE, FALSE, '["categoria", "producto"]'::jsonb, '["all"]'::jsonb),
    ('gerente_sucursal', 'bitacora', 'AR', FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, '[]'::jsonb, '[]'::jsonb),
    ('gerente_sucursal', 'control_calidad', 'AP', TRUE, FALSE, FALSE, FALSE, FALSE, FALSE, '["fecha", "estado", "categoria", "producto"]'::jsonb, '["all"]'::jsonb),
    ('gerente_sucursal', 'reportes', 'AP', TRUE, FALSE, FALSE, FALSE, FALSE, FALSE, '["fecha", "categoria", "producto"]'::jsonb, '["calidad_control"]'::jsonb),
    ('gerente_sucursal', 'configuracion', 'AP', TRUE, FALSE, FALSE, FALSE, FALSE, FALSE, '[]'::jsonb, '["perfil"]'::jsonb)
ON CONFLICT (role_key, module_key) DO UPDATE SET
    access_level = EXCLUDED.access_level,
    can_view = EXCLUDED.can_view,
    can_download = EXCLUDED.can_download,
    can_create = EXCLUDED.can_create,
    can_edit = EXCLUDED.can_edit,
    can_delete = EXCLUDED.can_delete,
    can_export = EXCLUDED.can_export,
    available_filters = EXCLUDED.available_filters,
    visible_tabs = EXCLUDED.visible_tabs;

-- DIRECTOR DE OPERACIONES
INSERT INTO module_access_levels (role_key, module_key, access_level, can_view, can_download, can_create, can_edit, can_delete, can_export, available_filters, visible_tabs) VALUES
    ('director_operaciones', 'catalogo', 'AC', TRUE, TRUE, FALSE, FALSE, FALSE, FALSE, '["categoria", "producto"]'::jsonb, '["all"]'::jsonb),
    ('director_operaciones', 'bitacora', 'AR', FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, '[]'::jsonb, '[]'::jsonb),
    ('director_operaciones', 'control_calidad', 'AP', TRUE, FALSE, FALSE, FALSE, FALSE, FALSE, '["fecha", "estado", "categoria", "producto"]'::jsonb, '["all"]'::jsonb),
    ('director_operaciones', 'reportes', 'AP', TRUE, FALSE, FALSE, FALSE, FALSE, FALSE, '["fecha", "categoria", "producto"]'::jsonb, '["calidad_control"]'::jsonb),
    ('director_operaciones', 'configuracion', 'AP', TRUE, FALSE, FALSE, FALSE, FALSE, FALSE, '[]'::jsonb, '["perfil"]'::jsonb)
ON CONFLICT (role_key, module_key) DO UPDATE SET
    access_level = EXCLUDED.access_level,
    can_view = EXCLUDED.can_view,
    can_download = EXCLUDED.can_download,
    can_create = EXCLUDED.can_create,
    can_edit = EXCLUDED.can_edit,
    can_delete = EXCLUDED.can_delete,
    can_export = EXCLUDED.can_export,
    available_filters = EXCLUDED.available_filters,
    visible_tabs = EXCLUDED.visible_tabs;

-- GERENTE DE CALIDAD Y DESARROLLO
INSERT INTO module_access_levels (role_key, module_key, access_level, can_view, can_download, can_create, can_edit, can_delete, can_export, available_filters, visible_tabs) VALUES
    ('gerente_calidad', 'catalogo', 'AC', TRUE, TRUE, FALSE, FALSE, FALSE, FALSE, '["categoria", "producto"]'::jsonb, '["all"]'::jsonb),
    ('gerente_calidad', 'bitacora', 'AR', FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, '[]'::jsonb, '[]'::jsonb),
    ('gerente_calidad', 'control_calidad', 'AC', TRUE, FALSE, FALSE, TRUE, TRUE, TRUE, '["sucursal", "fecha", "estado", "categoria", "producto"]'::jsonb, '["all"]'::jsonb),
    ('gerente_calidad', 'reportes', 'AP', TRUE, FALSE, FALSE, FALSE, FALSE, FALSE, '["fecha", "categoria", "producto"]'::jsonb, '["calidad_control"]'::jsonb),
    ('gerente_calidad', 'configuracion', 'AP', TRUE, FALSE, FALSE, FALSE, FALSE, FALSE, '[]'::jsonb, '["perfil"]'::jsonb)
ON CONFLICT (role_key, module_key) DO UPDATE SET
    access_level = EXCLUDED.access_level,
    can_view = EXCLUDED.can_view,
    can_download = EXCLUDED.can_download,
    can_create = EXCLUDED.can_create,
    can_edit = EXCLUDED.can_edit,
    can_delete = EXCLUDED.can_delete,
    can_export = EXCLUDED.can_export,
    available_filters = EXCLUDED.available_filters,
    visible_tabs = EXCLUDED.visible_tabs;

-- MOSTRADOR
INSERT INTO module_access_levels (role_key, module_key, access_level, can_view, can_download, can_create, can_edit, can_delete, can_export, available_filters, visible_tabs) VALUES
    ('mostrador', 'catalogo', 'AC', TRUE, TRUE, FALSE, FALSE, FALSE, FALSE, '["categoria", "producto"]'::jsonb, '["all"]'::jsonb),
    ('mostrador', 'bitacora', 'AR', FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, '[]'::jsonb, '[]'::jsonb),
    ('mostrador', 'control_calidad', 'AR', FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, '[]'::jsonb, '[]'::jsonb),
    ('mostrador', 'reportes', 'AR', FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, '[]'::jsonb, '[]'::jsonb),
    ('mostrador', 'configuracion', 'AP', TRUE, FALSE, FALSE, FALSE, FALSE, FALSE, '[]'::jsonb, '["perfil"]'::jsonb)
ON CONFLICT (role_key, module_key) DO UPDATE SET
    access_level = EXCLUDED.access_level,
    can_view = EXCLUDED.can_view,
    can_download = EXCLUDED.can_download,
    can_create = EXCLUDED.can_create,
    can_edit = EXCLUDED.can_edit,
    can_delete = EXCLUDED.can_delete,
    can_export = EXCLUDED.can_export,
    available_filters = EXCLUDED.available_filters,
    visible_tabs = EXCLUDED.visible_tabs;

-- CAJERA
INSERT INTO module_access_levels (role_key, module_key, access_level, can_view, can_download, can_create, can_edit, can_delete, can_export, available_filters, visible_tabs) VALUES
    ('cajera', 'catalogo', 'AC', TRUE, TRUE, FALSE, FALSE, FALSE, FALSE, '["categoria", "producto"]'::jsonb, '["all"]'::jsonb),
    ('cajera', 'bitacora', 'AR', FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, '[]'::jsonb, '[]'::jsonb),
    ('cajera', 'control_calidad', 'AR', FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, '[]'::jsonb, '[]'::jsonb),
    ('cajera', 'reportes', 'AR', FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, '[]'::jsonb, '[]'::jsonb),
    ('cajera', 'configuracion', 'AP', TRUE, FALSE, FALSE, FALSE, FALSE, FALSE, '[]'::jsonb, '["perfil"]'::jsonb)
ON CONFLICT (role_key, module_key) DO UPDATE SET
    access_level = EXCLUDED.access_level,
    can_view = EXCLUDED.can_view,
    can_download = EXCLUDED.can_download,
    can_create = EXCLUDED.can_create,
    can_edit = EXCLUDED.can_edit,
    can_delete = EXCLUDED.can_delete,
    can_export = EXCLUDED.can_export,
    available_filters = EXCLUDED.available_filters,
    visible_tabs = EXCLUDED.visible_tabs;

-- DIRECTOR DE COMPRAS
INSERT INTO module_access_levels (role_key, module_key, access_level, can_view, can_download, can_create, can_edit, can_delete, can_export, available_filters, visible_tabs) VALUES
    ('director_compras', 'catalogo', 'AC', TRUE, TRUE, FALSE, FALSE, FALSE, FALSE, '["categoria", "producto"]'::jsonb, '["all"]'::jsonb),
    ('director_compras', 'bitacora', 'AR', FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, '[]'::jsonb, '[]'::jsonb),
    ('director_compras', 'control_calidad', 'AP', TRUE, FALSE, FALSE, FALSE, FALSE, FALSE, '["fecha", "estado", "categoria", "producto"]'::jsonb, '["all"]'::jsonb),
    ('director_compras', 'reportes', 'AP', TRUE, FALSE, FALSE, FALSE, FALSE, FALSE, '["fecha", "categoria", "producto"]'::jsonb, '["calidad_control"]'::jsonb),
    ('director_compras', 'configuracion', 'AP', TRUE, FALSE, FALSE, FALSE, FALSE, FALSE, '[]'::jsonb, '["perfil"]'::jsonb)
ON CONFLICT (role_key, module_key) DO UPDATE SET
    access_level = EXCLUDED.access_level,
    can_view = EXCLUDED.can_view,
    can_download = EXCLUDED.can_download,
    can_create = EXCLUDED.can_create,
    can_edit = EXCLUDED.can_edit,
    can_delete = EXCLUDED.can_delete,
    can_export = EXCLUDED.can_export,
    available_filters = EXCLUDED.available_filters,
    visible_tabs = EXCLUDED.visible_tabs;

-- =====================================================
-- FUNCIÓN PARA OBTENER PERMISOS DE USUARIO (V2)
-- =====================================================

CREATE OR REPLACE FUNCTION get_user_permissions_v2(p_user_id UUID)
RETURNS TABLE (
    module_key TEXT,
    access_level TEXT,
    can_view BOOLEAN,
    can_download BOOLEAN,
    can_create BOOLEAN,
    can_edit BOOLEAN,
    can_delete BOOLEAN,
    can_export BOOLEAN,
    available_filters JSONB,
    visible_tabs JSONB
) AS $$
DECLARE
    v_user_role TEXT;
BEGIN
    -- Obtener el rol del usuario desde profiles
    SELECT role INTO v_user_role
    FROM profiles
    WHERE id = p_user_id;
    
    -- Si no tiene rol, retornar vacío
    IF v_user_role IS NULL THEN
        RETURN;
    END IF;
    
    -- Retornar permisos según su rol
    RETURN QUERY
    SELECT 
        mal.module_key,
        mal.access_level,
        mal.can_view,
        mal.can_download,
        mal.can_create,
        mal.can_edit,
        mal.can_delete,
        mal.can_export,
        mal.available_filters,
        mal.visible_tabs
    FROM module_access_levels mal
    WHERE mal.role_key = v_user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- ÍNDICES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_module_access_levels_role ON module_access_levels(role_key);
CREATE INDEX IF NOT EXISTS idx_module_access_levels_module ON module_access_levels(module_key);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- =====================================================
-- RLS (Row Level Security)
-- =====================================================

ALTER TABLE module_access_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles_v2 ENABLE ROW LEVEL SECURITY;

-- Todos pueden ver los roles
CREATE POLICY "Anyone can view roles v2" ON user_roles_v2 FOR SELECT USING (TRUE);

-- Todos pueden ver niveles de acceso
CREATE POLICY "Anyone can view access levels" ON module_access_levels FOR SELECT USING (TRUE);

-- =====================================================
-- COMENTARIOS
-- =====================================================

COMMENT ON TABLE user_roles_v2 IS 'Roles/Puestos del sistema (v2 - simplificado)';
COMMENT ON TABLE module_access_levels IS 'Niveles de acceso (AC/AP/AR) por rol y módulo';
COMMENT ON COLUMN module_access_levels.access_level IS 'AC=Acceso Completo, AP=Acceso Parcial, AR=Acceso Restringido';
COMMENT ON COLUMN module_access_levels.available_filters IS 'Array JSON de filtros disponibles para este rol en este módulo';
COMMENT ON COLUMN module_access_levels.visible_tabs IS 'Array JSON de tabs/secciones visibles para este rol en este módulo';
