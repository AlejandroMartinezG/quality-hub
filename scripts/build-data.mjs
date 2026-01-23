#!/usr/bin/env node

/**
 * build-data.mjs
 * 
 * Downloads CSV data from Google Sheets, validates with Zod,
 * and generates JSON files for the Next.js static build.
 * 
 * Environment variables required:
 * - SHEET_MP_CSV_URL: URL to the published MP sheet CSV
 * - SHEET_PT_CSV_URL: URL to the published PT sheet CSV
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// We'll use dynamic imports for the packages
const Papa = (await import('papaparse')).default;
const { z } = await import('zod');

// =============================================================================
// Configuration
// =============================================================================

const SHEET_MP_CSV_URL = process.env.SHEET_MP_CSV_URL;
const SHEET_PT_CSV_URL = process.env.SHEET_PT_CSV_URL;

const DATA_DIR = path.join(__dirname, '..', 'data');

// =============================================================================
// Schemas
// =============================================================================

const RawMaterialSchema = z.object({
    code: z.string().min(1, 'code is required'),
    name: z.string().min(1, 'name is required'),
    cas: z.string().nullable().optional(),
    transport_name: z.string().nullable().optional(),
    functional_category: z.string().min(1, 'functional_category is required'),
    chemical_family: z.string().min(1, 'chemical_family is required'),
    disposition: z.string().min(1, 'disposition is required'),
    provider: z.string().nullable().optional(),
    provider_code: z.string().nullable().optional(),
    lead_time_days: z.coerce.number().nullable().optional(),
    // File IDs for documents
    tds_file_id: z.string().nullable().optional(),
    sds_file_id: z.string().nullable().optional(),
    coa_cedis_file_id: z.string().nullable().optional(),
    coa_branches_file_id: z.string().nullable().optional(),
    label_file_id: z.string().nullable().optional(),
});

const FinishedProductSchema = z.object({
    family: z.string().min(1, 'family is required'),
    category: z.string().min(1, 'category is required'),
    sku_code: z.string().min(1, 'sku_code is required'),
    base_product: z.string().min(1, 'base_product is required'),
    variant: z.string().nullable().optional(),
    status: z.enum(['Activo', 'Inactivo']),
    updated_at: z.string().refine(
        (val) => {
            if (!val) return true;
            const date = new Date(val);
            return !isNaN(date.getTime());
        },
        { message: 'updated_at must be a valid date (YYYY-MM-DD)' }
    ),
    // File IDs
    tds_file_id: z.string().nullable().optional(),
    sds_file_id: z.string().nullable().optional(),
    coa_file_id: z.string().nullable().optional(),
    label_file_id: z.string().nullable().optional(),
});

// =============================================================================
// Helper Functions
// =============================================================================

function extractDriveId(value) {
    if (!value) return null;
    const cleanValue = value.trim();
    if (!cleanValue) return null;

    // Regex to match file ID from various Google Drive URL formats
    // Matches /d/[ID]/ or id=[ID]
    const idRegex = /(?:\/d\/|id=)([\w-]+)/;
    const match = cleanValue.match(idRegex);

    // If it's a URL, return the matched ID, otherwise assume the whole string is the ID
    return match ? match[1] : cleanValue;
}

function getDriveViewUrl(value) {
    const fileId = extractDriveId(value);
    if (!fileId) return null;
    return `https://drive.google.com/file/d/${fileId}/view?usp=sharing`;
}

function getDriveDownloadUrl(value) {
    const fileId = extractDriveId(value);
    if (!fileId) return null;
    return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

function slugify(text) {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

function cleanValue(value) {
    if (value === undefined || value === null || value === '') {
        return null;
    }
    return typeof value === 'string' ? value.trim() : value;
}

async function fetchCSV(url) {
    console.log(`Fetching CSV from: ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch CSV: ${response.status} ${response.statusText}`);
    }
    return await response.text();
}

function parseCSV(csvText) {
    const result = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim().toLowerCase().replace(/\s+/g, '_'),
    });

    if (result.errors.length > 0) {
        console.warn('CSV parsing warnings:', result.errors);
    }

    return result.data;
}

// =============================================================================
// Processing Functions
// =============================================================================

function processRawMaterials(rawData) {
    console.log(`Processing ${rawData.length} raw materials...`);

    const materials = [];
    const codes = new Set();
    const errors = [];

    for (let i = 0; i < rawData.length; i++) {
        const row = rawData[i];
        const rowNum = i + 2; // Account for header row

        // Clean values
        const cleanedRow = {};
        for (const [key, value] of Object.entries(row)) {
            cleanedRow[key] = cleanValue(value);
        }

        // Validate with Zod
        const result = RawMaterialSchema.safeParse(cleanedRow);

        if (!result.success) {
            errors.push(`Row ${rowNum}: ${result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
            continue;
        }

        const data = result.data;

        // Check for duplicate codes
        if (codes.has(data.code)) {
            errors.push(`Row ${rowNum}: Duplicate code "${data.code}"`);
            continue;
        }
        codes.add(data.code);

        // Transform to output format with Drive URLs
        materials.push({
            code: data.code,
            name: data.name,
            cas: data.cas || null,
            transport_name: data.transport_name || null,
            functional_category: data.functional_category,
            chemical_family: data.chemical_family,
            disposition: data.disposition,
            provider: data.provider || null,
            provider_code: data.provider_code || null,
            lead_time_days: data.lead_time_days || null,
            // Generate Drive URLs
            tds_view_url: getDriveViewUrl(data.tds_file_id),
            tds_download_url: getDriveDownloadUrl(data.tds_file_id),
            sds_view_url: getDriveViewUrl(data.sds_file_id),
            sds_download_url: getDriveDownloadUrl(data.sds_file_id),
            coa_cedis_view_url: getDriveViewUrl(data.coa_cedis_file_id),
            coa_cedis_download_url: getDriveDownloadUrl(data.coa_cedis_file_id),
            coa_branches_view_url: getDriveViewUrl(data.coa_branches_file_id),
            coa_branches_download_url: getDriveDownloadUrl(data.coa_branches_file_id),
            label_view_url: getDriveViewUrl(data.label_file_id),
            label_download_url: getDriveDownloadUrl(data.label_file_id),
        });
    }

    if (errors.length > 0) {
        console.error('\n❌ Validation errors in raw materials:');
        errors.forEach(e => console.error(`  - ${e}`));
        throw new Error(`Found ${errors.length} validation errors in raw materials data`);
    }

    console.log(`✓ Validated ${materials.length} raw materials`);
    return materials;
}

function processFinishedProducts(rawData) {
    console.log(`Processing ${rawData.length} finished products...`);

    const products = [];
    const skuCodes = new Set();
    const errors = [];

    for (let i = 0; i < rawData.length; i++) {
        const row = rawData[i];
        const rowNum = i + 2;

        // Clean values
        const cleanedRow = {};
        for (const [key, value] of Object.entries(row)) {
            cleanedRow[key] = cleanValue(value);
        }

        // Validate
        const result = FinishedProductSchema.safeParse(cleanedRow);

        if (!result.success) {
            errors.push(`Row ${rowNum}: ${result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
            continue;
        }

        const data = result.data;

        // Check for duplicate SKU codes
        if (skuCodes.has(data.sku_code)) {
            errors.push(`Row ${rowNum}: Duplicate sku_code "${data.sku_code}"`);
            continue;
        }
        skuCodes.add(data.sku_code);

        // Check for empty family/category
        if (!data.family || data.family.trim() === '') {
            errors.push(`Row ${rowNum}: family cannot be empty`);
            continue;
        }
        if (!data.category || data.category.trim() === '') {
            errors.push(`Row ${rowNum}: category cannot be empty`);
            continue;
        }

        products.push({
            family: data.family,
            family_slug: slugify(data.family),
            category: data.category,
            category_slug: slugify(data.category),
            sku_code: data.sku_code,
            base_product: data.base_product,
            variant: data.variant || '',
            status: data.status,
            updated_at: data.updated_at,
            // Generate Drive URLs
            tds_view_url: getDriveViewUrl(data.tds_file_id),
            tds_download_url: getDriveDownloadUrl(data.tds_file_id),
            sds_view_url: getDriveViewUrl(data.sds_file_id),
            sds_download_url: getDriveDownloadUrl(data.sds_file_id),
            coa_view_url: getDriveViewUrl(data.coa_file_id),
            coa_download_url: getDriveDownloadUrl(data.coa_file_id),
            label_view_url: getDriveViewUrl(data.label_file_id),
            label_download_url: getDriveDownloadUrl(data.label_file_id),
        });
    }

    if (errors.length > 0) {
        console.error('\n❌ Validation errors in finished products:');
        errors.forEach(e => console.error(`  - ${e}`));
        throw new Error(`Found ${errors.length} validation errors in finished products data`);
    }

    // Group by family -> category
    const grouped = { families: [] };
    const familyMap = new Map();

    for (const product of products) {
        if (!familyMap.has(product.family_slug)) {
            familyMap.set(product.family_slug, {
                name: product.family,
                slug: product.family_slug,
                categories: new Map(),
            });
        }

        const family = familyMap.get(product.family_slug);

        if (!family.categories.has(product.category_slug)) {
            family.categories.set(product.category_slug, {
                name: product.category,
                slug: product.category_slug,
                products: [],
            });
        }

        family.categories.get(product.category_slug).products.push(product);
    }

    // Convert maps to arrays
    for (const [, family] of familyMap) {
        grouped.families.push({
            name: family.name,
            slug: family.slug,
            categories: Array.from(family.categories.values()),
        });
    }

    // Sort families and categories
    grouped.families.sort((a, b) => a.name.localeCompare(b.name));
    grouped.families.forEach(f => {
        f.categories.sort((a, b) => a.name.localeCompare(b.name));
    });

    console.log(`✓ Validated ${products.length} finished products in ${grouped.families.length} families`);
    return grouped;
}

// =============================================================================
// Main
// =============================================================================

async function main() {
    console.log('🚀 Building data files...\n');

    // Create data directory
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    // Check for required environment variables
    if (!SHEET_MP_CSV_URL) {
        console.warn('⚠️  SHEET_MP_CSV_URL not set. Using sample data.\n');
        generateSampleData();
        return;
    }

    try {
        // Fetch and process raw materials
        console.log('📥 Fetching raw materials data...');
        const mpCsv = await fetchCSV(SHEET_MP_CSV_URL);
        const mpRaw = parseCSV(mpCsv);
        const rawMaterials = processRawMaterials(mpRaw);

        fs.writeFileSync(
            path.join(DATA_DIR, 'raw-materials.json'),
            JSON.stringify(rawMaterials, null, 2)
        );
        console.log(`✓ Wrote data/raw-materials.json\n`);

        // Fetch and process finished products
        if (SHEET_PT_CSV_URL && SHEET_PT_CSV_URL !== 'DUMMY_URL' && SHEET_PT_CSV_URL !== '') {
            console.log('📥 Fetching finished products data...');
            const ptCsv = await fetchCSV(SHEET_PT_CSV_URL);
            const ptRaw = parseCSV(ptCsv);
            const finishedProducts = processFinishedProducts(ptRaw);

            fs.writeFileSync(
                path.join(DATA_DIR, 'finished-products.json'),
                JSON.stringify(finishedProducts, null, 2)
            );
            console.log(`✓ Wrote data/finished-products.json\n`);
        } else {
            console.log('⏭️  Skipping finished products (URL not set)\n');
        }

        console.log('✅ Data build complete!');
    } catch (error) {
        console.error('\n❌ Build failed:', error.message);
        process.exit(1);
    }
}

function generateSampleData() {
    console.log('📝 Generating sample data for development...\n');

    // Sample raw materials
    const sampleRawMaterials = [
        {
            code: 'MP-001',
            name: 'Tensioactivo Aniónico',
            cas: '68585-34-2',
            transport_name: 'Sustancia líquida no regulada',
            functional_category: 'Tensioactivo',
            chemical_family: 'Sulfatos de Alquilo',
            disposition: 'Aprobado',
            provider: 'Proveedor Alpha',
            provider_code: 'PA-1001',
            lead_time_days: 15,
            tds_view_url: null,
            tds_download_url: null,
            sds_view_url: null,
            sds_download_url: null,
            coa_cedis_view_url: null,
            coa_cedis_download_url: null,
            coa_branches_view_url: null,
            coa_branches_download_url: null,
            label_view_url: null,
            label_download_url: null,
        },
        {
            code: 'MP-002',
            name: 'Fragancia Lavanda',
            cas: null,
            transport_name: 'Aceite esencial',
            functional_category: 'Fragancia',
            chemical_family: 'Aceites Esenciales',
            disposition: 'Aprobado',
            provider: 'Proveedor Beta',
            provider_code: 'PB-2001',
            lead_time_days: 10,
            tds_view_url: null,
            tds_download_url: null,
            sds_view_url: null,
            sds_download_url: null,
            coa_cedis_view_url: null,
            coa_cedis_download_url: null,
            coa_branches_view_url: null,
            coa_branches_download_url: null,
            label_view_url: null,
            label_download_url: null,
        },
        {
            code: 'MP-003',
            name: 'Colorante Azul',
            cas: '3844-45-9',
            transport_name: 'Colorante soluble',
            functional_category: 'Colorante',
            chemical_family: 'Colorantes Sintéticos',
            disposition: 'En Revisión',
            provider: 'Proveedor Gamma',
            provider_code: 'PG-3001',
            lead_time_days: 20,
            tds_view_url: null,
            tds_download_url: null,
            sds_view_url: null,
            sds_download_url: null,
            coa_cedis_view_url: null,
            coa_cedis_download_url: null,
            coa_branches_view_url: null,
            coa_branches_download_url: null,
            label_view_url: null,
            label_download_url: null,
        },
    ];

    // Sample finished products
    const sampleFinishedProducts = {
        families: [
            {
                name: 'Cuidado del Hogar',
                slug: 'cuidado-del-hogar',
                categories: [
                    {
                        name: 'Limpiadores Líquidos Multiusos',
                        slug: 'limpiadores-liquidos-multiusos',
                        products: [
                            {
                                family: 'Cuidado del Hogar',
                                family_slug: 'cuidado-del-hogar',
                                category: 'Limpiadores Líquidos Multiusos',
                                category_slug: 'limpiadores-liquidos-multiusos',
                                sku_code: 'PT-CH-001',
                                base_product: 'MultiClean Power',
                                variant: 'Lavanda 1L',
                                status: 'Activo',
                                updated_at: '2024-01-15',
                                tds_view_url: null,
                                tds_download_url: null,
                                sds_view_url: null,
                                sds_download_url: null,
                                coa_view_url: null,
                                coa_download_url: null,
                                label_view_url: null,
                                label_download_url: null,
                            },
                            {
                                family: 'Cuidado del Hogar',
                                family_slug: 'cuidado-del-hogar',
                                category: 'Limpiadores Líquidos Multiusos',
                                category_slug: 'limpiadores-liquidos-multiusos',
                                sku_code: 'PT-CH-002',
                                base_product: 'MultiClean Power',
                                variant: 'Cítrico 1L',
                                status: 'Activo',
                                updated_at: '2024-01-15',
                                tds_view_url: 'https://drive.google.com/file/d/1VuS5L_WGqnXz7PV55ecEDsMPwjYEjXEq/view?usp=sharing',
                                tds_download_url: 'https://drive.google.com/uc?export=download&id=1VuS5L_WGqnXz7PV55ecEDsMPwjYEjXEq',
                                sds_view_url: 'https://drive.google.com/file/d/1VuS5L_WGqnXz7PV55ecEDsMPwjYEjXEq/view?usp=sharing',
                                sds_download_url: 'https://drive.google.com/uc?export=download&id=1VuS5L_WGqnXz7PV55ecEDsMPwjYEjXEq',
                                coa_view_url: 'https://drive.google.com/file/d/1VuS5L_WGqnXz7PV55ecEDsMPwjYEjXEq/view?usp=sharing',
                                coa_download_url: 'https://drive.google.com/uc?export=download&id=1VuS5L_WGqnXz7PV55ecEDsMPwjYEjXEq',
                                label_view_url: 'https://drive.google.com/file/d/1VuS5L_WGqnXz7PV55ecEDsMPwjYEjXEq/view?usp=sharing',
                                label_download_url: 'https://drive.google.com/uc?export=download&id=1VuS5L_WGqnXz7PV55ecEDsMPwjYEjXEq',
                            },
                        ],
                    },
                    {
                        name: 'Detergentes Líquidos para Trastes',
                        slug: 'detergentes-liquidos-para-trastes',
                        products: [
                            {
                                family: 'Cuidado del Hogar',
                                family_slug: 'cuidado-del-hogar',
                                category: 'Detergentes Líquidos para Trastes',
                                category_slug: 'detergentes-liquidos-para-trastes',
                                sku_code: 'PT-CH-010',
                                base_product: 'DishPro Ultra',
                                variant: 'Limón 750ml',
                                status: 'Activo',
                                updated_at: '2024-02-01',
                                tds_view_url: 'https://drive.google.com/file/d/1VuS5L_WGqnXz7PV55ecEDsMPwjYEjXEq/view?usp=sharing',
                                tds_download_url: 'https://drive.google.com/uc?export=download&id=1VuS5L_WGqnXz7PV55ecEDsMPwjYEjXEq',
                                sds_view_url: 'https://drive.google.com/file/d/1VuS5L_WGqnXz7PV55ecEDsMPwjYEjXEq/view?usp=sharing',
                                sds_download_url: 'https://drive.google.com/uc?export=download&id=1VuS5L_WGqnXz7PV55ecEDsMPwjYEjXEq',
                                coa_view_url: 'https://drive.google.com/file/d/1VuS5L_WGqnXz7PV55ecEDsMPwjYEjXEq/view?usp=sharing',
                                coa_download_url: 'https://drive.google.com/uc?export=download&id=1VuS5L_WGqnXz7PV55ecEDsMPwjYEjXEq',
                                label_view_url: 'https://drive.google.com/file/d/1VuS5L_WGqnXz7PV55ecEDsMPwjYEjXEq/view?usp=sharing',
                                label_download_url: 'https://drive.google.com/uc?export=download&id=1VuS5L_WGqnXz7PV55ecEDsMPwjYEjXEq',
                            },
                        ],
                    },
                ],
            },
            {
                name: 'Lavandería',
                slug: 'lavanderia',
                categories: [
                    {
                        name: 'Detergentes Líquidos para Ropa',
                        slug: 'detergentes-liquidos-para-ropa',
                        products: [
                            {
                                family: 'Lavandería',
                                family_slug: 'lavanderia',
                                category: 'Detergentes Líquidos para Ropa',
                                category_slug: 'detergentes-liquidos-para-ropa',
                                sku_code: 'PT-LV-001',
                                base_product: 'CleanWash Premium',
                                variant: 'Original 2L',
                                status: 'Activo',
                                updated_at: '2024-01-20',
                                tds_view_url: 'https://drive.google.com/file/d/1VuS5L_WGqnXz7PV55ecEDsMPwjYEjXEq/view?usp=sharing',
                                tds_download_url: 'https://drive.google.com/uc?export=download&id=1VuS5L_WGqnXz7PV55ecEDsMPwjYEjXEq',
                                sds_view_url: 'https://drive.google.com/file/d/1VuS5L_WGqnXz7PV55ecEDsMPwjYEjXEq/view?usp=sharing',
                                sds_download_url: 'https://drive.google.com/uc?export=download&id=1VuS5L_WGqnXz7PV55ecEDsMPwjYEjXEq',
                                coa_view_url: 'https://drive.google.com/file/d/1VuS5L_WGqnXz7PV55ecEDsMPwjYEjXEq/view?usp=sharing',
                                coa_download_url: 'https://drive.google.com/uc?export=download&id=1VuS5L_WGqnXz7PV55ecEDsMPwjYEjXEq',
                                label_view_url: 'https://drive.google.com/file/d/1VuS5L_WGqnXz7PV55ecEDsMPwjYEjXEq/view?usp=sharing',
                                label_download_url: 'https://drive.google.com/uc?export=download&id=1VuS5L_WGqnXz7PV55ecEDsMPwjYEjXEq',
                            },
                        ],
                    },
                    {
                        name: 'Suavizantes Líquidos para Telas',
                        slug: 'suavizantes-liquidos-para-telas',
                        products: [
                            {
                                family: 'Lavandería',
                                family_slug: 'lavanderia',
                                category: 'Suavizantes Líquidos para Telas',
                                category_slug: 'suavizantes-liquidos-para-telas',
                                sku_code: 'PT-LV-020',
                                base_product: 'SuaveMax',
                                variant: 'Brisa Marina 1L',
                                status: 'Activo',
                                updated_at: '2024-01-25',
                                tds_view_url: 'https://drive.google.com/file/d/1VuS5L_WGqnXz7PV55ecEDsMPwjYEjXEq/view?usp=sharing',
                                tds_download_url: 'https://drive.google.com/uc?export=download&id=1VuS5L_WGqnXz7PV55ecEDsMPwjYEjXEq',
                                sds_view_url: 'https://drive.google.com/file/d/1VuS5L_WGqnXz7PV55ecEDsMPwjYEjXEq/view?usp=sharing',
                                sds_download_url: 'https://drive.google.com/uc?export=download&id=1VuS5L_WGqnXz7PV55ecEDsMPwjYEjXEq',
                                coa_view_url: 'https://drive.google.com/file/d/1VuS5L_WGqnXz7PV55ecEDsMPwjYEjXEq/view?usp=sharing',
                                coa_download_url: 'https://drive.google.com/uc?export=download&id=1VuS5L_WGqnXz7PV55ecEDsMPwjYEjXEq',
                                label_view_url: 'https://drive.google.com/file/d/1VuS5L_WGqnXz7PV55ecEDsMPwjYEjXEq/view?usp=sharing',
                                label_download_url: 'https://drive.google.com/uc?export=download&id=1VuS5L_WGqnXz7PV55ecEDsMPwjYEjXEq',
                            },
                        ],
                    },
                ],
            },
            {
                name: 'Cuidado Personal',
                slug: 'cuidado-personal',
                categories: [
                    {
                        name: 'Jabones Líquidos para Manos',
                        slug: 'jabones-liquidos-para-manos',
                        products: [
                            {
                                family: 'Cuidado Personal',
                                family_slug: 'cuidado-personal',
                                category: 'Jabones Líquidos para Manos',
                                category_slug: 'jabones-liquidos-para-manos',
                                sku_code: 'PT-CP-001',
                                base_product: 'HandCare Deluxe',
                                variant: 'Aloe Vera 300ml',
                                status: 'Activo',
                                updated_at: '2024-02-10',
                                tds_view_url: null,
                                tds_download_url: null,
                                sds_view_url: null,
                                sds_download_url: null,
                                coa_view_url: null,
                                coa_download_url: null,
                                label_view_url: null,
                                label_download_url: null,
                            },
                        ],
                    },
                ],
            },
            {
                name: 'Línea Automotriz',
                slug: 'linea-automotriz',
                categories: [],
            },
            {
                name: 'Línea Antibacterial',
                slug: 'linea-antibacterial',
                categories: [],
            },
        ],
    };

    fs.writeFileSync(
        path.join(DATA_DIR, 'raw-materials.json'),
        JSON.stringify(sampleRawMaterials, null, 2)
    );
    console.log('✓ Wrote data/raw-materials.json (sample)');

    fs.writeFileSync(
        path.join(DATA_DIR, 'finished-products.json'),
        JSON.stringify(sampleFinishedProducts, null, 2)
    );
    console.log('✓ Wrote data/finished-products.json (sample)');

    console.log('\n✅ Sample data generated!');
    console.log('\n💡 To use real data, set these environment variables:');
    console.log('   SHEET_MP_CSV_URL=<your-mp-sheet-csv-url>');
    console.log('   SHEET_PT_CSV_URL=<your-pt-sheet-csv-url>');
}

main();
