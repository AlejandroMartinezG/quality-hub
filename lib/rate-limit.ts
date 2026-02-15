/**
 * Client-Side Rate Limiter
 * 
 * Since this is a static export app with no API routes,
 * server-side rate limiting is handled by Supabase itself.
 * This module provides client-side throttling to prevent
 * rapid-fire requests (brute force protection at the UI level).
 */

interface RateLimitEntry {
    count: number
    firstAttempt: number
    lockedUntil: number | null
}

const rateLimitStore = new Map<string, RateLimitEntry>()

/**
 * Configuration for rate limiting behavior.
 */
interface RateLimitConfig {
    /** Maximum attempts allowed within the window */
    maxAttempts: number
    /** Time window in milliseconds */
    windowMs: number
    /** Lockout duration in milliseconds after exceeding maxAttempts */
    lockoutMs: number
}

const DEFAULT_CONFIG: RateLimitConfig = {
    maxAttempts: 5,
    windowMs: 60_000,      // 1 minute window
    lockoutMs: 300_000,    // 5 minute lockout
}

/**
 * Check if an action is rate limited.
 * Returns { allowed: true } or { allowed: false, retryAfterMs, message }.
 */
export function checkRateLimit(
    key: string,
    config: Partial<RateLimitConfig> = {}
): { allowed: true } | { allowed: false; retryAfterMs: number; message: string } {
    const { maxAttempts, windowMs, lockoutMs } = { ...DEFAULT_CONFIG, ...config }
    const now = Date.now()

    let entry = rateLimitStore.get(key)

    // Check if currently locked out
    if (entry?.lockedUntil && now < entry.lockedUntil) {
        const retryAfterMs = entry.lockedUntil - now
        const minutes = Math.ceil(retryAfterMs / 60_000)
        return {
            allowed: false,
            retryAfterMs,
            message: `Demasiados intentos. Intenta de nuevo en ${minutes} minuto${minutes !== 1 ? 's' : ''}.`
        }
    }

    // Reset if window has expired or lockout has passed
    if (!entry || (entry.lockedUntil && now >= entry.lockedUntil) || (now - entry.firstAttempt > windowMs)) {
        entry = { count: 0, firstAttempt: now, lockedUntil: null }
        rateLimitStore.set(key, entry)
    }

    // Increment attempt count
    entry.count++

    // Check if exceeded
    if (entry.count > maxAttempts) {
        entry.lockedUntil = now + lockoutMs
        const minutes = Math.ceil(lockoutMs / 60_000)
        return {
            allowed: false,
            retryAfterMs: lockoutMs,
            message: `Demasiados intentos. Tu cuenta ha sido bloqueada temporalmente por ${minutes} minutos.`
        }
    }

    return { allowed: true }
}

/**
 * Reset rate limit for a key (e.g., after successful login).
 */
export function resetRateLimit(key: string): void {
    rateLimitStore.delete(key)
}

/**
 * Get remaining attempts for a key.
 */
export function getRemainingAttempts(key: string, maxAttempts = DEFAULT_CONFIG.maxAttempts): number {
    const entry = rateLimitStore.get(key)
    if (!entry) return maxAttempts
    return Math.max(0, maxAttempts - entry.count)
}
