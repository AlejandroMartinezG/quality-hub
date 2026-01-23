# plan.md — Quality Hub GINEZ (sitio 100% estático en GitHub Pages)
**Objetivo:** construir un portal tipo “Quality Hub” para consulta y descarga de documentación de **Materias Primas (MP)** y **Productos Terminados (PT)**, con UI basada en el prototipo de Lovable (cards + tablas + detalle con documentos).  
**Restricciones clave:** 100% estático (sin backend), **datos en Google Sheets**, **PDFs en Google Drive**, despliegue en **GitHub Pages** con **GitHub Actions**.

---

## 1) Alcance funcional (MVP)
### 1.1 Módulos (Panel Principal)
Pantalla `/` con cards de módulos:
- **Catálogo** (activo)
- Bitácora de Producción (Próximamente)
- Control de Calidad (Próximamente)
- Inventarios (Próximamente)
- Reportes (Próximamente)
- Configuración (Próximamente)

> Debe verse como el prototipo: encabezado con logo GINEZ + subtítulo “Sistema de Gestión: Calidad y Documentación”, cards limpias, badge “Próximamente” para módulos inactivos.

### 1.2 Catálogo
Ruta `/catalog` con 2 cards:
- **Materias Primas (MP)** → `/catalog/raw-materials`
- **Productos Terminados (PT)** → `/catalog/finished-products`

### 1.3 Materias Primas (MP)
- Tabla con columnas (mínimo):
  - `code`, `name`, `transport_name`, `functional_category`, `chemical_family`, `disposition`
- **Búsqueda global**: por `code`, `name`, `cas`, `transport_name`, `functional_category`, `chemical_family`, `disposition`
- **Filtros avanzados**:
  - `functional_category` (multi-select)
  - `chemical_family` (multi-select)
  - `disposition` (multi-select)
- Click en fila → detalle: `/catalog/raw-materials/[code]`
- Detalle MP con:
  - Header: icono + `code` + badges (categoría/uso/disposición) + nombre
  - Cards de info: “Clasificación Química”, “Seguridad y Transporte”, “Información de Almacén”
  - Sección “Documentación” con botones **Ver** y **Descargar** para:
    - Ficha Técnica (TDS)
    - Hoja de Seguridad (SDS)
    - Certificado de Análisis — CEDIS
    - Certificado de Análisis — Sucursales
    - Información de Etiquetado

### 1.4 Productos Terminados (PT)
- `/catalog/finished-products`: menú por **familias** (cards):
  - Cuidado del Hogar
  - Lavandería
  - Línea Automotriz
  - Línea Antibacterial
  - Cuidado Personal
- `/catalog/finished-products/[family]`: menú por **categorías** (cards) según familia:
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
  - **Automotriz**
    - (definir categorías en sheet)
  - **Antibacterial**
    - (definir categorías en sheet)
  - **Cuidado Personal**
    - Jabones Líquidos para Manos
    - Shampoo Capilar
    - Enjuague Capilar
    - Cremas Corporales
- `/catalog/finished-products/[family]/[category]`:
  - Tabla con columnas:
    - `sku_code`, `variant`, `base_product`, `status`, `updated_at`
  - **Búsqueda global** por `sku_code`, `base_product`, `variant`
  - Filtros: `status`, (opcional) `variant`
  - Click → detalle `/catalog/finished-products/[family]/[category]/[sku_code]`
- Detalle PT con:
  - Header con `sku_code`, nombre base, badges de `family`, `status`, `variant`
  - Cards de información general + formulación (si se captura en sheet)
  - Sección “Documentación del Producto” con **Ver/Descargar**:
    - Ficha Técnica (TDS)
    - Hoja de Seguridad (SDS)
    - Parámetros de Calidad Internos
    - Información de Etiquetado

---

## 2) Decisiones técnicas (cerradas)
- **Sitio público**: cualquiera con el link.
- **Sin autenticación** (en MVP).
- **Datos**: 1 Google Sheet con 2 pestañas: `MP` y `PT`.
- **Documentos**: PDFs en Google Drive; en el Sheet se guardan **FILE_IDs** (no URLs largas).
- **Build estático**: Next.js export → carpeta `out/`.
- **Deploy**: GitHub Pages vía GitHub Actions.

---

## 3) Arquitectura: 100% estático + build-time data
### 3.1 Componentes
- **Frontend**: Next.js (App Router) + Tailwind CSS
- **UI kit**: shadcn/ui + lucide-react
- **Tabla**: TanStack Table
- **Búsqueda**: Fuse.js (fuzzy) + filtros por campos
- **Validación**: Zod
- **Datos generados**: JSON (generado en pipeline)

### 3.2 Flujo de datos (build)
1) GitHub Actions descarga CSV publicado desde Google Sheets:
   - `SHEET_MP_CSV_URL`
   - `SHEET_PT_CSV_URL`
2) Script `scripts/build-data.mjs`:
   - parsea CSV
   - valida con zod
   - produce:
     - `data/raw-materials.json`
     - `data/finished-products.json` (agrupado por family → category)
   - construye enlaces a Drive (ver 4)
3) `next build` + export → `out/`
4) Se publica `out/` en GitHub Pages

---

## 4) Google Drive: Ver y Descargar sin “UI de Drive”
### 4.1 Convención: usar FILE_ID
En el Sheet, guardar únicamente el `FILE_ID` de cada PDF.

El script genera:
- **Ver**: `https://drive.google.com/file/d/<FILE_ID>/view?usp=sharing`
- **Descargar**: `https://drive.google.com/uc?export=download&id=<FILE_ID>`

**Requisito:** cada PDF debe tener permiso “Cualquiera con el enlace puede ver”.

> Fallback: si algún PDF no descarga directo por restricciones/tamaño, el botón “Ver” siempre debe funcionar.

---

## 5) Google Sheets: diseño de datos (lo que tú mantienes)
### 5.1 Estructura del Sheet
Un solo archivo con dos pestañas:
- **MP**
- **PT**

### 5.2 Encabezados exactos
#### 5.2.1 Pestaña MP
**Requeridos**
- `code`
- `name`
- `cas`
- `transport_name`
- `functional_category`
- `chemical_family`
- `disposition`

**Opcionales**
- `provider`
- `provider_code`
- `lead_time_days`

**Docs (FILE_IDs)**
- `tds_file_id`
- `sds_file_id`
- `coa_cedis_file_id`
- `coa_branches_file_id`
- `label_file_id`

#### 5.2.2 Pestaña PT
**Requeridos**
- `family`
- `category`
- `sku_code`
- `base_product`
- `variant`
- `status` (Activo/Inactivo)
- `updated_at` (YYYY-MM-DD)

**Docs (FILE_IDs)**
- `tds_file_id`
- `sds_file_id`
- `internal_qc_file_id`
- `label_file_id`

---

## 6) Publicación del Sheet para consumo por Actions (sin credenciales)
Publicar a la web como CSV (por pestaña):
1) Google Sheets → **Archivo → Compartir → Publicar en la web**
2) Seleccionar pestaña `MP` → formato `CSV` → Publicar → copiar URL
3) Repetir con pestaña `PT`

Variables resultantes:
- `SHEET_MP_CSV_URL`
- `SHEET_PT_CSV_URL`

---

## 7) Rutas y estructura del proyecto (para Antigravity)
### 7.1 Estructura sugerida
- `app/`
  - `page.tsx` (Panel)
  - `catalog/`
    - `page.tsx`
    - `raw-materials/`
      - `page.tsx`
      - `[code]/page.tsx`
    - `finished-products/`
      - `page.tsx`
      - `[family]/page.tsx`
      - `[family]/[category]/page.tsx`
      - `[family]/[category]/[sku]/page.tsx`
- `components/`
  - `AppShell.tsx`, `Breadcrumbs.tsx`, `ModuleCard.tsx`, `DocCard.tsx`, `DataTable.tsx`, `Filters.tsx`
- `data/` (generado en CI)
- `scripts/build-data.mjs`
- `.github/workflows/deploy.yml`
- `next.config.js`
- `README.md`

---

## 8) GitHub Pages + Next export (config)
### 8.1 `next.config.js`
- `output: "export"`
- `basePath` y `assetPrefix` con `NEXT_PUBLIC_BASE_PATH`

Ejemplo:
- repo = `quality-hub` → `NEXT_PUBLIC_BASE_PATH=/quality-hub`

### 8.2 Workflow (GitHub Actions)
Pipeline:
1) checkout
2) setup node
3) `npm ci`
4) `node scripts/build-data.mjs`
5) `npm run build` (export)
6) deploy GitHub Pages

Variables en GitHub:
- `SHEET_MP_CSV_URL`
- `SHEET_PT_CSV_URL`
- `NEXT_PUBLIC_BASE_PATH`

---

## 9) Validaciones (obligatorio)
El build debe fallar si:
- faltan columnas requeridas
- duplicados de `code` (MP) o `sku_code` (PT)
- `updated_at` inválida
- `family/category` vacíos en PT

---

## 10) Seguridad / límites reales
- El sitio es público.
- Si Drive está “cualquiera con link”, los PDFs son accesibles vía URL.

---

## 11) Qué haces tú vs qué hace Antigravity
### 11.1 Tú haces
- Crear el Sheet con pestañas `MP` y `PT`
- Subir/organizar PDFs en Drive y asignar permisos
- Pegar `*_file_id` en el Sheet
- Publicar MP/PT como CSV y copiar URLs

### 11.2 Antigravity hace
- Crear proyecto Next + Tailwind + shadcn/ui
- Implementar rutas/componentes/tablas
- Implementar búsqueda y filtros
- Crear `build-data.mjs` (CSV→JSON + links Drive)
- Configurar Pages (basePath/export)
- Crear workflow deploy
- README

---

## 12) Criterios de aceptación (DoD)
- Navegación completa (panel→catálogo→MP/PT→detalle)
- Búsqueda y filtros funcionando
- Ver/Descargar funcionando
- Deploy automático con Actions
- Falla controlada si Sheet trae errores

---

## 13) PROMPT para Google Antigravity (pégalo tal cual)
Crea un repositorio `quality-hub` con Next.js (App Router) + Tailwind y salida 100% estática para GitHub Pages.

1) UI siguiendo el prototipo Lovable: header GINEZ, cards de módulos, breadcrumb, tablas con buscador y filtros, badges de estado/disposición, páginas de detalle con cards y sección Documentación.
2) Rutas:
- `/` (Panel principal con módulos; Catálogo activo, demás Próximamente)
- `/catalog`
- `/catalog/raw-materials`
- `/catalog/raw-materials/[code]`
- `/catalog/finished-products`
- `/catalog/finished-products/[family]`
- `/catalog/finished-products/[family]/[category]`
- `/catalog/finished-products/[family]/[category]/[sku]`

3) Datos:
- Consumir 2 CSV publicados desde Google Sheets (variables):
  - `SHEET_MP_CSV_URL`
  - `SHEET_PT_CSV_URL`
- Implementar `scripts/build-data.mjs` que:
  - descarga CSV
  - parsea
  - valida con zod
  - genera `data/raw-materials.json` y `data/finished-products.json` (agrupado family→category)
  - construye links Drive:
    - view: `https://drive.google.com/file/d/<id>/view?usp=sharing`
    - download: `https://drive.google.com/uc?export=download&id=<id>`

4) UI/Libs:
- shadcn/ui, lucide-react, @tanstack/react-table, fuse.js
- filtros avanzados MP: functional_category, chemical_family, disposition
- filtros PT: status y (opcional) variant

5) GitHub Pages:
- `next.config.js` con `output: "export"`, `basePath` y `assetPrefix` usando `NEXT_PUBLIC_BASE_PATH`.
- workflow `.github/workflows/deploy.yml`:
  - checkout → setup node → npm ci → node scripts/build-data.mjs → npm run build → deploy pages.

6) Documentación:
- README con columnas exactas del Sheet, publicación CSV, variables, y proceso de actualización.

Entregables: proyecto completo listo para ejecutar y desplegar en GitHub Pages.
