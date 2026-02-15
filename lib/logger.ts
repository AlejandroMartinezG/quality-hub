import { supabase } from './supabase'

export type AuditAction =
    | 'LOGIN_SUCCESS'
    | 'LOGIN_FAILURE'
    | 'LOGOUT'
    | 'CREATE_RECORD'
    | 'UPDATE_RECORD'
    | 'DELETE_RECORD'
    | 'EXPORT_DATA'
    | 'USER_APPROVAL'
    | 'USER_REJECTION'
    | 'ROLE_CHANGE'

interface LogEntry {
    action: AuditAction
    user_id?: string
    details?: Record<string, any>
    resource_id?: string
    resource_type?: string
}

/**
 * Logs a security-relevant action to the audit_logs table.
 * Designed to be non-blocking (fire and forget).
 */
export async function logAuditAction(entry: LogEntry) {
    try {
        const { data: { session } } = await supabase.auth.getSession()
        const user = session?.user

        const payload = {
            action: entry.action,
            user_id: entry.user_id || user?.id || 'anonymous',
            details: entry.details || {},
            resource_id: entry.resource_id,
            resource_type: entry.resource_type,
            ip_address: null, // Client-side can't reliably get IP without an external service or Edge Function
            user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
            created_at: new Date().toISOString()
        }

        // We explicitly do NOT await this to prevent blocking the UI
        // Supabase will handle the request in the background
        const { error } = await supabase.from('audit_logs').insert(payload)

        if (error) {
            // In dev, we might see this if the table doesn't exist yet
            console.warn("Audit log failed (table 'audit_logs' might be missing):", error.message)
        }
    } catch (error) {
        // Silently fail in production to avoid disrupting user experience
        if (process.env.NODE_ENV === 'development') {
            console.warn("Audit logging exception:", error)
        }
    }
}
