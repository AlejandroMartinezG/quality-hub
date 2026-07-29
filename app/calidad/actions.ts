'use server'

import { supabaseAdmin } from '@/lib/supabase-admin'

interface UpdateBitacoraPayload {
    id: number
    ph: number | null
    solidos_medicion_1: number | null
    solidos_medicion_2: number | null
    apariencia: string
    color: string
    aroma: string
    tamano_lote: number | null
    fecha_fabricacion: string
    lote_producto: string
}

export async function updateBitacoraRecord(payload: UpdateBitacoraPayload, accessToken: string) {
    if (!accessToken) return { success: false, message: 'No autorizado' }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(accessToken)
    if (authError || !user) return { success: false, message: 'No autorizado' }

    const { id, ...fields } = payload
    const { error } = await supabaseAdmin
        .from('bitacora_produccion_calidad')
        .update(fields)
        .eq('id', id)

    if (error) return { success: false, message: error.message }
    return { success: true }
}
