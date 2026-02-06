-- ============================================
-- SCRIPT DE LIMPIEZA DE BASE DE DATOS
-- Sistema de Permisos V2
-- ============================================
-- 
-- ADVERTENCIA: Este script eliminará las tablas del sistema antiguo
-- Asegúrate de tener un backup antes de ejecutar
--
-- Fecha: 05 de Febrero, 2026
-- ============================================

-- ============================================
-- PASO 1: VERIFICAR TABLAS EXISTENTES
-- ============================================

SELECT 
    table_name,
    CASE 
        WHEN table_name IN ('profiles', 'user_roles_v2', 'module_access_levels', 
                           'bitacora_produccion_calidad', 'download_logs') 
        THEN '✅ ACTIVA'
        WHEN table_name IN ('user_permissions', 'role_permissions', 'user_roles', 'system_modules')
        THEN '❌ OBSOLETA'
        ELSE '⚠️ REVISAR'
    END as estado
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY estado, table_name;

-- ============================================
-- PASO 2: ELIMINAR TABLAS OBSOLETAS
-- ============================================

-- Eliminar tabla de permisos de usuarios (sistema antiguo)
DROP TABLE IF EXISTS user_permissions CASCADE;

-- Eliminar tabla de permisos de roles (sistema antiguo)
DROP TABLE IF EXISTS role_permissions CASCADE;

-- Eliminar tabla de roles (sistema antiguo)
DROP TABLE IF EXISTS user_roles CASCADE;

-- Eliminar tabla de módulos del sistema (sistema antiguo)
DROP TABLE IF EXISTS system_modules CASCADE;

-- ============================================
-- PASO 3: ELIMINAR FUNCIONES OBSOLETAS
-- ============================================

-- Eliminar función de permisos antigua
DROP FUNCTION IF EXISTS get_user_permissions(uuid);

-- Eliminar función de verificación de permisos antigua
DROP FUNCTION IF EXISTS check_user_permission(uuid, text, text);

-- ============================================
-- PASO 4: VERIFICAR LIMPIEZA
-- ============================================

-- Verificar tablas restantes
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Resultado esperado:
-- bitacora_produccion_calidad
-- download_logs
-- module_access_levels
-- profiles
-- user_roles_v2

-- ============================================
-- PASO 5: VERIFICAR DATOS CRÍTICOS
-- ============================================

-- Verificar roles (debe mostrar 8)
SELECT COUNT(*) as total_roles, 
       'Esperado: 8' as nota
FROM user_roles_v2;

-- Verificar permisos (debe mostrar 40: 8 roles × 5 módulos)
SELECT COUNT(*) as total_permisos,
       'Esperado: 40' as nota
FROM module_access_levels;

-- Verificar usuarios
SELECT COUNT(*) as total_usuarios
FROM profiles;

-- Ver detalle de roles
SELECT role_key, role_name, description 
FROM user_roles_v2 
ORDER BY role_name;

-- Ver resumen de permisos por rol
SELECT 
    r.role_name,
    COUNT(mal.module_key) as modulos_con_acceso,
    SUM(CASE WHEN mal.access_level = 'AC' THEN 1 ELSE 0 END) as acceso_completo,
    SUM(CASE WHEN mal.access_level = 'AP' THEN 1 ELSE 0 END) as acceso_parcial,
    SUM(CASE WHEN mal.access_level = 'AR' THEN 1 ELSE 0 END) as acceso_restringido
FROM user_roles_v2 r
LEFT JOIN module_access_levels mal ON r.role_key = mal.role_key
GROUP BY r.role_name
ORDER BY r.role_name;

-- ============================================
-- PASO 6: VERIFICAR FUNCIONES ACTIVAS
-- ============================================

-- Listar funciones existentes
SELECT routine_name, routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public'
ORDER BY routine_name;

-- Resultado esperado:
-- get_user_permissions_v2 | FUNCTION

-- ============================================
-- PASO 7: VERIFICAR POLÍTICAS RLS
-- ============================================

-- Ver políticas activas
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ============================================
-- PASO 8: PRUEBA DE PERMISOS
-- ============================================

-- Probar función de permisos (reemplaza con un user_id real)
-- SELECT * FROM get_user_permissions_v2('341f7692-e69b-429d-8501-14f406da342b');

-- ============================================
-- RESUMEN DE LIMPIEZA
-- ============================================

SELECT 
    'Limpieza completada' as estado,
    (SELECT COUNT(*) FROM information_schema.tables 
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE') as tablas_restantes,
    (SELECT COUNT(*) FROM user_roles_v2) as roles_activos,
    (SELECT COUNT(*) FROM module_access_levels) as permisos_configurados,
    (SELECT COUNT(*) FROM profiles) as usuarios_registrados;

-- ============================================
-- FIN DEL SCRIPT
-- ============================================
