import { supabase } from "./supabase"

export async function logDownload(params: {
    fileName: string
    fileType: string
    skuCode?: string
}) {
    try {
        console.log("[audit] logDownload called:", params)
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
            console.warn("[audit] No session — aborting log")
            return
        }
        console.log("[audit] Session OK, user:", session.user.id)

        // Fetch user profile info for logging (denormalized log)
        const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, area')
            .eq('id', session.user.id)
            .single()

        const { error } = await supabase.from('download_logs').insert({
            user_id: session.user.id,
            full_name: profile?.full_name || session.user.email,
            area: profile?.area || 'N/A',
            file_name: params.fileName,
            file_type: params.fileType,
            sku_code: params.skuCode,
        })
        if (error) console.error("Error inserting download_log:", error.message)
    } catch (error) {
        console.error("Error logging download:", error)
    }
}
