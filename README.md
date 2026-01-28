# Quality Hub GINEZ

Sistema de Gestión Documental del Laboratorio de Calidad y Desarrollo para GINEZ. Portal estático para consulta y descarga de documentación de Materias Primas (MP) y Productos Terminados (PT).

## 🚀 Características

- **100% Estático**: Sitio generado con Next.js, desplegable en GitHub Pages
- **Datos desde Google Sheets**: Actualiza el catálogo editando tu Sheet
- **Documentos en Google Drive**: PDFs accesibles con enlaces Ver/Descargar
- **Optimización de Rendimiento**: Uso de `useDeferredValue` para búsquedas y filtros ultra fluidos
- **Identidad GINEZ**: Colores institucionales (#16149a, #c32420) e iconografía personalizada
- **Documentación Inteligente**: Iconos de documentos con estados "disponible" e "inactivo" para mejor visibilidad
- **Responsive**: Diseño adaptable a móviles y escritorio

## 📋 Estructura del Proyecto

```
quality-hub/
├── app/                    # Páginas (App Router)
│   ├── page.tsx           # Panel Principal
│   ├── catalog/
│   │   ├── page.tsx       # Catálogo
│   │   ├── raw-materials/ # Materias Primas
│   │   └── finished-products/ # Productos Terminados
├── components/            # Componentes React
├── data/                  # JSON generado (build time)
├── lib/                   # Utilidades y tipos
├── scripts/
│   └── build-data.mjs    # Script de procesamiento CSV→JSON
└── .github/workflows/
    └── deploy.yml        # GitHub Actions para deploy
```

## 📊 Configuración del Google Sheet

### Crear el Sheet

1. Crea un nuevo Google Sheet
2. Crea dos pestañas: `MP` y `PT`

### Pestaña MP (Materias Primas)

Encabezados exactos (primera fila):

| Columna | Requerida | Descripción |
|---------|-----------|-------------|
| `code` | ✅ | Código único de la materia prima |
| `name` | ✅ | Nombre de la materia prima |
| `cas` | ❌ | Número CAS |
| `transport_name` | ❌ | Nombre de transporte |
| `functional_category` | ✅ | Categoría funcional |
| `chemical_family` | ✅ | Familia química |
| `disposition` | ✅ | Disposición (Aprobado/En Revisión/Rechazado) |
| `provider` | ❌ | Nombre del proveedor |
| `provider_code` | ❌ | Código del proveedor |
| `lead_time_days` | ❌ | Tiempo de entrega en días |
| `tds_file_id` | ❌ | FILE_ID del PDF de Ficha Técnica |
| `sds_file_id` | ❌ | FILE_ID del PDF de Hoja de Seguridad |
| `coa_cedis_file_id` | ❌ | FILE_ID del Certificado CEDIS |
| `coa_branches_file_id` | ❌ | FILE_ID del Certificado Sucursales |
| `label_file_id` | ❌ | FILE_ID de Info de Etiquetado |

### Pestaña PT (Productos Terminados)

Encabezados exactos (primera fila):

| Columna | Requerida | Descripción |
|---------|-----------|-------------|
| `family` | ✅ | Familia del producto |
| `category` | ✅ | Categoría del producto |
| `sku_code` | ✅ | Código SKU único |
| `base_product` | ✅ | Nombre del producto base |
| `variant` | ❌ | Variante del producto |
| `status` | ✅ | Estado: `Activo` o `Inactivo` |
| `updated_at` | ✅ | Fecha de actualización (YYYY-MM-DD) |
| `tds_file_id` | ❌ | FILE_ID del PDF de Ficha Técnica |
| `sds_file_id` | ❌ | FILE_ID del PDF de Hoja de Seguridad |
| `internal_qc_file_id` | ❌ | FILE_ID de Parámetros de Calidad |
| `label_file_id` | ❌ | FILE_ID de Info de Etiquetado |

### ¿Qué es el FILE_ID?

El FILE_ID es el identificador único de un archivo en Google Drive. Lo encuentras en la URL del archivo:

```
https://drive.google.com/file/d/1ABC123XYZ789/view
                              ↑____________↑
                              Este es el FILE_ID
```

**Importante**: Cada PDF debe tener permiso "Cualquiera con el enlace puede ver".

## 📤 Publicar el Sheet como CSV

1. Abre tu Google Sheet
2. Ve a **Archivo → Compartir → Publicar en la web**
3. Selecciona pestaña `MP` → formato **CSV** → clic en **Publicar**
4. Copia la URL generada (esta es tu `SHEET_MP_CSV_URL`)
5. Repite para la pestaña `PT` (esta es tu `SHEET_PT_CSV_URL`)

## ⚙️ Variables en GitHub

Ve a tu repositorio → **Settings → Secrets and variables → Actions → Variables** y crea:

| Variable | Valor | Descripción |
|----------|-------|-------------|
| `SHEET_MP_CSV_URL` | URL del paso 4 | URL CSV de Materias Primas |
| `SHEET_PT_CSV_URL` | URL del paso 5 | URL CSV de Productos Terminados |
| `NEXT_PUBLIC_BASE_PATH` | `/nombre-repo` | Ej: `/quality-hub` si tu repo se llama `quality-hub` |

## 🔄 Proceso de Actualización

1. **Edita el Sheet**: Agrega, modifica o elimina registros en tu Google Sheet
2. **Sube PDFs a Drive**: Si hay nuevos documentos, súbelos y copia el FILE_ID
3. **Actualiza FILE_IDs**: Pega los FILE_IDs en las columnas correspondientes
4. **Dispara el deploy**: Ve a Actions → Deploy to GitHub Pages → Run workflow

Los cambios se reflejarán en minutos.

## 🛠️ Desarrollo Local

```bash
# Instalar dependencias
npm install

# Generar datos de muestra (sin Google Sheets)
npm run build-data

# Iniciar servidor de desarrollo
npm run dev

# Construir para producción
npm run build
```

### Variables de entorno para desarrollo

Crea un archivo `.env.local`:

```env
SHEET_MP_CSV_URL=tu-url-csv-mp
SHEET_PT_CSV_URL=tu-url-csv-pt
NEXT_PUBLIC_BASE_PATH=
```

## 📁 Familias de Productos Terminados

Las familias disponibles son:

- **Cuidado del Hogar**
  - Limpiadores Líquidos Multiusos
  - Detergentes Líquidos para Trastes
  - Aromatizantes Ambientales
  - Especialidades Cuidado del Hogar
  - Bases Limpiadores Líquidos Multiusos
  - Bases Aromatizantes Ambientales

- **Lavandería**
  - Detergentes Líquidos para Ropa
  - Suavizantes Líquidos para Telas
  - Especialidades Lavandería

- **Línea Automotriz** (categorías por definir)

- **Línea Antibacterial** (categorías por definir)

- **Cuidado Personal**
  - Jabones Líquidos para Manos
  - Shampoo Capilar
  - Enjuague Capilar
  - Cremas Corporales

## 🔒 Seguridad

- El sitio es **público** (sin autenticación en MVP)
- Los PDFs en Drive deben tener permiso "Cualquiera con el enlace"
- No se almacenan credenciales en el código

## 📦 Tecnologías

- [Next.js 14](https://nextjs.org/) - Framework React
- [Tailwind CSS](https://tailwindcss.com/) - Estilos
- [shadcn/ui](https://ui.shadcn.com/) - Componentes UI
- [TanStack Table](https://tanstack.com/table) - Tablas avanzadas
- [Fuse.js](https://www.fusejs.io/) - Búsqueda fuzzy
- [Zod](https://zod.dev/) - Validación de datos
- [Lucide React](https://lucide.dev/) - Iconos

## 📄 Licencia

Uso interno GINEZ.
