# Quality Hub GINEZ

Sistema de Gestión de Calidad y Documentación para GINEZ. Aplicación web progresiva diseñada para el control de procesos de calidad, gestión de usuarios y consulta de documentación técnica.

## 🚀 Nuevas Características (v2.0)

Esta versión introduce una arquitectura dinámica basada en **Supabase**, permitiendo autenticación, gestión de datos en tiempo real y seguridad robusta.

### 🔐 Seguridad y Accesibilidad
- **Autenticación Segura**: Sistema de Login con correo y contraseña.
- **Control de Acceso Basado en Roles (RBAC)**:
  - **Administrador**: Acceso total a gestión de usuarios, auditoría completa, eliminación de registros y configuración global.
  - **Usuario**: Acceso a consulta de catálogo, creación de registros de calidad (visibilidad limitada a sus propios registros) y edición de su perfil básico.

### 🧪 Módulo de Bitácora de Producción
- **Registro de Lotes**: Interfaz guiada paso a paso para la creación de nuevos lotes de producción.
- **Generación Inteligente de Lotes**: Algoritmo automático que crea números de lote únicos basados en fecha, sucursal y producto.
- **Validación en Tiempo Real**: 
  - Comparación instantánea de mediciones (pH, % Sólidos) contra estándares predefinidos del producto.
  - Feedback visual inmediato (Conforme/Fuera de Rango) antes de guardar.
- **Integridad de Datos**: Campos dinámicos que se activan según la aplicabilidad de parámetros para cada familia de productos.

### 📊 Módulo de Control de Calidad
- **Tablero de Resultados**: "Historial de Mediciones" con visualización gráfica del estado general de la producción.
- **Indicadores Clave (KPIs)**: Tarjetas interactivas que muestran conteos y porcentajes de cumplimiento (Conformes, Semi-Conformes, No Conformes) filtrados en tiempo real.
- **Gestión Integral**:
  - Búsqueda potente por lote, producto o sucursal.
  - Opciones de edición y eliminación (protegidas por roles).
  - Cálculo automático de estatus global del lote.

### ⚙️ Módulo de Configuración
- **Perfil de Usuario**: Edición de datos personales (Nombre, Área, Puesto) y cambio seguro de credenciales (con verificación de correo).
- **Gestión de Usuarios (Admin)**:
  - Panel centralizado para ver todos los usuarios registrados.
  - Edición de roles y permisos.
  - Eliminación forzada de usuarios (preservando integridad de datos históricos).
- **Auditoría (Admin)**: Registro detallado de descargas y accesos a documentos críticos.

---

## 📋 Estructura Estática (Catálogo)
El módulo de catálogo mantiene su funcionalidad de alta disponibilidad:
- **Datos Sincronizados**: Conexión con Google Sheets para listas de precios y especificaciones.
- **Documentación en Drive**: Acceso directo a Fichas Técnicas y Hojas de Seguridad.

---

## 🛠️ Configuración para Desarrollo

### 1. Requisitos Previos
- Node.js 18+
- Cuenta en [Supabase](https://supabase.com/)

### 2. Variables de Entorno
Crea un archivo `.env.local` en la raíz del proyecto con las siguientes credenciales:

```env
# Google Sheets (Catálogo)
SHEET_MP_CSV_URL="tu_url_csv_materia_prima"
SHEET_PT_CSV_URL="tu_url_csv_producto_terminado"

# Supabase (Auth & Database)
NEXT_PUBLIC_SUPABASE_URL="https://tu-proyecto.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="tu-clave-anonima-publica"
```

### 3. Instalación y Ejecución

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev
# El sitio estará disponible en http://localhost:3000 (o 3001 si está ocupado)
```

## 📦 Stack Tecnológico Actualizado

- **Framework**: [Next.js 14](https://nextjs.org/) (App Router)
- **Base de Datos & Auth**: [Supabase](https://supabase.com/) (PostgreSQL)
- **Estilos**: [Tailwind CSS](https://tailwindcss.com/)
- **Componentes UI**: [shadcn/ui](https://ui.shadcn.com/)
- **Visualización de Datos**: Tarjetas reactivas personalizadas
- **Iconografía**: [Lucide React](https://lucide.dev/)

## 📝 Notas de Implementación

- **Validación de Correos**: Los cambios de correo electrónico requieren confirmación vía email para hacerse efectivos en el login, aunque la interfaz visual se actualiza para evitar confusión.
- **Integridad de Datos**: Al eliminar un usuario, sus registros de calidad históricos se conservan para fines de trazabilidad, pero el acceso de la cuenta se revoca inmediatamente.

## 📄 Licencia
Uso interno exclusivo para GINEZ.
