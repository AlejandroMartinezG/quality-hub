// Raw Materials (MP) types
export interface RawMaterial {
    code: string
    name: string
    cas: string | null
    transport_name: string | null
    functional_category: string
    chemical_family: string
    disposition: string
    provider: string | null
    provider_code: string | null
    lead_time_days: number | null
    // Document links (generated from FILE_IDs)
    tds_view_url: string | null
    tds_download_url: string | null
    sds_view_url: string | null
    sds_download_url: string | null
    coa_cedis_view_url: string | null
    coa_cedis_download_url: string | null
    coa_branches_view_url: string | null
    coa_branches_download_url: string | null
    label_view_url: string | null
    label_download_url: string | null
}

// Finished Products (PT) types
export interface FinishedProduct {
    family: string
    family_slug: string
    category: string
    category_slug: string
    sku_code: string
    name: string
    base_product: string
    variant: string
    status: "Activo" | "Inactivo"
    updated_at: string
    // Document links
    tds_view_url: string | null
    tds_download_url: string | null
    sds_view_url: string | null
    sds_download_url: string | null
    coa_view_url: string | null
    coa_download_url: string | null
    label_view_url: string | null
    label_download_url: string | null
}

// Grouped structure for finished products
export interface FinishedProductsData {
    families: FamilyGroup[]
}

export interface FamilyGroup {
    name: string
    slug: string
    categories: CategoryGroup[]
    products?: FinishedProduct[]
}

export interface CategoryGroup {
    name: string
    slug: string
    products: FinishedProduct[]
}

// Family and Category definitions
export const FAMILIES: Record<string, string[]> = {
    "Cuidado del Hogar": [
        "Limpiador Líquido Multiusos",
        "Detergente líquido para Trates",
        "Especialidad Cuidado del Hogar",
        "Aromatizantes Ambientales",
        "Base de Limpiador Líquido Multiusos",
        "Base de Aromatizantes Ambientales",
    ],
    "Lavandería": [
        "Detergente Líquido para Ropa",
        "Suavizantes Líquidos para Telas",
        "Especialidad Lavandería",
    ],
    "Línea Automotriz": ["Automotriz"],
    "Línea Antibacterial": ["Antibacterial"],
    "Cuidado Personal": [
        "Jabón Líquido para Manos",
        "Shampoo Capilar",
        "Enjuague Capilar",
        "Crema Corporal",
    ],
}
