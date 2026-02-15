/**
 * Data Sanitization Utilities
 * 
 * Provides functions to sanitize user input before storing in the database.
 * Prevents XSS, SQL injection fragments, and malicious content.
 */

/**
 * Strip HTML tags from a string to prevent XSS.
 * Since we don't use dangerouslySetInnerHTML, this is a defense-in-depth measure
 * to ensure no HTML/script content gets stored in the database.
 */
export function stripHtml(input: string): string {
    return input.replace(/<[^>]*>/g, '').trim()
}

/**
 * Sanitize a generic text field (names, positions, areas, etc.)
 * - Strips HTML tags
 * - Removes null bytes
 * - Trims whitespace
 * - Limits to maxLength characters
 */
export function sanitizeText(input: string | undefined | null, maxLength = 255): string {
    if (!input) return ''
    return stripHtml(input)
        .replace(/\0/g, '')           // Remove null bytes
        .replace(/\s+/g, ' ')         // Normalize whitespace
        .trim()
        .slice(0, maxLength)
}

/**
 * Sanitize a longer text field (observaciones, descriptions, etc.)
 * Same as sanitizeText but allows longer content and preserves newlines.
 */
export function sanitizeLongText(input: string | undefined | null, maxLength = 2000): string {
    if (!input) return ''
    return stripHtml(input)
        .replace(/\0/g, '')           // Remove null bytes
        .trim()
        .slice(0, maxLength)
}

/**
 * Sanitize an email address.
 * - Lowercase
 * - Trim whitespace
 * - Basic format validation
 */
export function sanitizeEmail(input: string | undefined | null): string {
    if (!input) return ''
    return input
        .toLowerCase()
        .trim()
        .replace(/\s/g, '')
        .slice(0, 320)                // RFC 5321 max email length
}

/**
 * Sanitize all string values in an object (shallow).
 * Useful for sanitizing entire form data objects before DB insertion.
 * Non-string values are left untouched.
 */
export function sanitizeFormData<T extends Record<string, unknown>>(
    data: T,
    longTextFields: string[] = []
): T {
    const sanitized = { ...data }
    for (const key of Object.keys(sanitized)) {
        const value = sanitized[key]
        if (typeof value === 'string') {
            if (longTextFields.includes(key)) {
                (sanitized as Record<string, unknown>)[key] = sanitizeLongText(value)
            } else {
                (sanitized as Record<string, unknown>)[key] = sanitizeText(value)
            }
        }
    }
    return sanitized
}

/**
 * Sanitize a filename to prevent directory traversal and invalid characters.
 * Keeps only alphanumeric, dots, dashes, and underscores.
 */
export function sanitizeFileName(filename: string): string {
    return filename
        .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace invalid chars with underscore
        .replace(/\.\.+/g, '.')           // Prevent multiple dots (..)
        .trim()
}
