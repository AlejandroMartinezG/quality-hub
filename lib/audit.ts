import { supabase } from "./supabase"

export async function logDownload(params: {
    fileName: string
    fileType: string
    skuCode?: string
}) {
    try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return

        // Fetch user profile info for logging (denormalized log)
        const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, area')
            .eq('id', session.user.id)
            .single()

        await supabase.from('download_logs').insert({
            user_id: session.user.id,
            full_name: profile?.full_name || session.user.email,
            area: profile?.area || 'N/A',
            file_name: params.fileName,
            file_type: params.fileType,
            sku_code: params.skuCode,
        })
    } catch (error) {
        console.error("Error logging download:", error)
    }
}
