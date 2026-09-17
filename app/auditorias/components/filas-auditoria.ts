/**
 * Arma los renglones de `auditoria_lotes` a partir de registros de la bitácora.
 *
 * Los valores del operador se COPIAN, no se referencian: el registro original se
 * puede editar después desde Control de Calidad, y el reporte de auditoría debe
 * seguir mostrando lo que decía el día de la visita.
 *
 * Lo usan tanto la creación de la auditoría como el ajuste posterior de lotes,
 * para que la foto se tome siempre igual.
 */
export function filasDesdeLotes(auditoriaId: string, lotes: any[]) {
    return lotes.map(l => ({
        auditoria_id: auditoriaId,
        measurement_id: l.id,
        lote_producto: l.lote_producto,
        codigo_producto: l.codigo_producto,
        nombre_preparador: l.nombre_preparador,
        fecha_fabricacion: l.fecha_fabricacion,
        tamano_lote: l.tamano_lote,
        ph_operador: l.ph,
        solidos_1_operador: l.solidos_medicion_1,
        solidos_2_operador: l.solidos_medicion_2,
        apariencia_operador: l.apariencia,
        color_operador: l.color,
        aroma_operador: l.aroma,
        resultado: 'PENDIENTE',
    }))
}

/** Un lote con alguna medición de Calidad capturada: quitarlo perdería trabajo. */
export function tieneMediciones(fila: any): boolean {
    return [
        'ph_calidad', 'solidos_1_calidad', 'solidos_2_calidad',
        'temp_1_calidad', 'temp_2_calidad',
        'apariencia_calidad', 'color_calidad', 'aroma_calidad', 'notas',
    ].some(c => fila[c] !== null && fila[c] !== undefined && fila[c] !== '')
}
