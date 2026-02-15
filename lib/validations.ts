import { z } from "zod"
import { SUCURSALES } from "@/lib/production-constants"

// ============================================================
// Login & Registration Schemas
// ============================================================

export const LoginSchema = z.object({
    email: z
        .string()
        .min(1, "El correo es obligatorio")
        .email("Formato de correo inválido")
        .max(255, "El correo no puede exceder 255 caracteres"),
    password: z
        .string()
        .min(6, "La contraseña debe tener al menos 6 caracteres")
        .max(128, "La contraseña no puede exceder 128 caracteres"),
})

export const RegisterSchema = LoginSchema.extend({
    full_name: z
        .string()
        .min(2, "El nombre debe tener al menos 2 caracteres")
        .max(100, "El nombre no puede exceder 100 caracteres")
        .regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/, "El nombre solo puede contener letras y espacios"),
    role: z.enum(
        ["preparador", "gerente_sucursal", "director_operaciones", "gerente_calidad", "mostrador", "cajera", "director_compras"],
        { errorMap: () => ({ message: "Selecciona un rol válido" }) }
    ),
    sucursal: z
        .string()
        .min(1, "La sucursal es obligatoria")
        .refine((val) => SUCURSALES.includes(val), "Selecciona una sucursal válida"),
})

// ============================================================
// Bitácora Form Schema
// ============================================================

/** Helper to parse optional numeric string fields */
const optionalNumericString = z
    .string()
    .transform((val) => (val === "" ? null : val))
    .nullable()

/** Schema for submitting a Bitácora record */
export const BitacoraSchema = z.object({
    sucursal: z
        .string()
        .min(1, "La sucursal es obligatoria")
        .refine((val) => SUCURSALES.includes(val), "Selecciona una sucursal válida"),
    nombre_preparador: z
        .string()
        .min(1, "El nombre del preparador es obligatorio")
        .max(200, "El nombre no puede exceder 200 caracteres"),
    fecha_fabricacion: z
        .string()
        .min(1, "La fecha de fabricación es obligatoria")
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido (YYYY-MM-DD)"),
    codigo_producto: z
        .string()
        .min(1, "El código del producto es obligatorio")
        .max(20, "Código de producto inválido")
        .regex(/^[A-Z0-9]+$/, "El código solo puede contener letras mayúsculas y números"),
    tamano_lote: z
        .string()
        .min(1, "El tamaño de lote es obligatorio")
        .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, "El tamaño de lote debe ser un número positivo"),
    ph: z
        .string()
        .refine(
            (val) => {
                if (val === "") return true // Optional when empty
                const num = parseInt(val)
                return !isNaN(num) && num >= 0 && num <= 14 && val === num.toString()
            },
            "El pH debe ser un entero entre 0 y 14"
        )
        .default(""),
    solidos_medicion_1: optionalNumericString.default(""),
    temp_med1: optionalNumericString.default(""),
    solidos_medicion_2: optionalNumericString.default(""),
    temp_med2: optionalNumericString.default(""),
    viscosidad_seg: optionalNumericString.default(""),
    temperatura: optionalNumericString.default(""),
    color: z.enum(["CONFORME", "NO CONFORME"], {
        errorMap: () => ({ message: "Selecciona conformidad del color" }),
    }),
    apariencia: z
        .string()
        .min(1, "La apariencia es obligatoria"),
    aroma: z.enum(["CONFORME", "NO CONFORME"], {
        errorMap: () => ({ message: "Selecciona conformidad del aroma" }),
    }),
    contaminacion_microbiologica: z.enum(["SIN PRESENCIA", "CON PRESENCIA"], {
        errorMap: () => ({ message: "Selecciona estado de contaminación" }),
    }),
    observaciones: z
        .string()
        .max(1000, "Las observaciones no pueden exceder 1000 caracteres")
        .default(""),
})

// ============================================================
// Type Exports (inferred from schemas)
// ============================================================

export type LoginInput = z.infer<typeof LoginSchema>
export type RegisterInput = z.infer<typeof RegisterSchema>
export type BitacoraInput = z.infer<typeof BitacoraSchema>

// ============================================================
// Validation Helpers
// ============================================================

/**
 * Validates data against a Zod schema and returns either
 * the parsed data or a formatted error object.
 */
export function validateForm<T>(
    schema: z.ZodSchema<T>,
    data: unknown
): { success: true; data: T } | { success: false; errors: Record<string, string> } {
    const result = schema.safeParse(data)

    if (result.success) {
        return { success: true, data: result.data }
    }

    const errors: Record<string, string> = {}
    for (const issue of result.error.issues) {
        const path = issue.path.join(".")
        if (!errors[path]) {
            errors[path] = issue.message
        }
    }

    return { success: false, errors }
}

/**
 * Returns the first error message from a validation result,
 * useful for showing a single toast notification.
 */
export function getFirstError(errors: Record<string, string>): string {
    const values = Object.values(errors)
    return values.length > 0 ? values[0] : "Datos inválidos"
}
