/**
 * Importa un reporte de producción de sucursal que SÍ trae mediciones.
 *
 * Se diferencia de `produccion-manual-to-sql.mjs` en que aquel es para lotes
 * fabricados sin equipo de medición —todos quedan en SIN MEDICION—, mientras
 * que aquí cada lote se evalúa con lo que haya: los medidos reciben su veredicto
 * (CONFORME / RETENER / NO CONFORME) y solo los que no traen nada quedan SIN
 * MEDICION.
 *
 *   node scripts/reporte-produccion-to-sql.mjs --check
 *   node scripts/reporte-produccion-to-sql.mjs
 *
 * Formato esperado de la hoja: FECHA · PRODUCTO · CANT · M1 · M2 · T1 · T2 · Ph
 *
 * El archivo no trae apariencia, color ni aroma: esas columnas quedan nulas.
 * No afectan el cálculo de FTQ, que en `analysis-utils.ts` se decide por sólidos.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import XLSX from 'xlsx'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const ARCHIVO = join(raiz, 'REPORTE DE PRODUCCION SEPTIEMBRE.xlsx')
const SALIDA = join(raiz, 'insert_reporte_produccion.sql')

const SUCURSAL = 'ATITALAQUIA'

/**
 * Oscar no tiene cuenta en la plataforma: estos lotes los capturó Juan Manuel
 * desde la suya, anotando el nombre de quien realmente fabricó. Es el mismo
 * criterio con el que ya estaban cargados sus dos lotes previos, así que
 * `user_id` apunta a Juan y `nombre_preparador` dice Oscar.
 */
const PREPARADOR = 'OSCAR HUGO CASTILLO RIVERA'
const CUENTA_CAPTURA = 'ESTRADA VELÁZQUEZ JUAN MANUEL'

const OBS = 'Registro capturado de forma manual a partir del reporte de producción de la sucursal.'

/**
 * Renglones que NO se inyectan porque ya están en la base.
 *
 * Juan alcanzó a capturar dos lotes del 22 de septiembre antes de que llegara
 * el reporte completo, y el reporte los incluye. Se reconocen porque coinciden
 * en cantidad y pH; además, ese día el Excel registra dos tandas de PINO, LIMLAV,
 * GIRIEL2 y DES, pero un solo COLGIN — si hubieran sido tandas distintas,
 * aparecerían dos. Se conservan las mediciones originales de la app.
 */
const YA_REGISTRADOS = new Set([
    3,    // COLGIN  22/09 · 200 → 260922-ATI-COLGIN200-01
    112,  // ESPESANTE25% 23/09 · 100 → 260922-ATI-ESP25100-01
])

/**
 * Códigos que la sucursal escribió distinto de como están en el catálogo.
 * Confirmados uno por uno con Calidad antes de importar.
 */
const CORRECCIONES = {
    'BLIMMAR2': 'BLIMMAR-2',
    'BLIMMAR': 'BLIMMAR-1',
    'SOSA10%': 'SOSA10',
    'SOSA100%': 'SOSA10',
    'ESPESANTE25%': 'ESP25',
    'ESPESANTE': 'ESP25',
    'REFARO DEL': 'REFARO-DEL',
    'BLIMCHIF': 'BLIMCHIC',
    'BLIMPERM': 'BLIMPER',
    'BPINO': 'BPINCRI',
}

/**
 * Correcciones de captura, por número de renglón del Excel.
 *
 * M1 y M2 son dos lecturas del mismo lote y deben coincidir. En el renglón 70
 * venían 11 y 1.5 —una siete veces la otra, imposible en el mismo bote— mientras
 * que los demás LIMMAR del mes leen entre 1.6 y 1.9. Es un punto decimal perdido
 * al teclear. Es el único par discordante de las 87 mediciones del archivo.
 */
const MEDICIONES_CORREGIDAS = {
    70: { m1: 1.1 },
}

const soloValidar = process.argv.includes('--check')

// ============================================================
// Catálogo
// ============================================================

/**
 * Extrae un objeto literal de production-constants.ts.
 *
 * El valor arranca en el primer `{` DESPUÉS del `=`, no en el primero que
 * aparezca: anotaciones como `Record<string, { solidos: boolean }>` traen llaves
 * propias y recortarían el bloque equivocado.
 */
function leerObjeto(fuente, nombre) {
    const i = fuente.indexOf(`export const ${nombre}`)
    if (i === -1) throw new Error(`No se encontró ${nombre} en production-constants.ts`)
    const m = /=\s*\{/.exec(fuente.slice(i))
    if (!m) throw new Error(`${nombre} no parece un objeto literal`)
    const a = i + m.index + m[0].length - 1
    let nivel = 0
    for (let j = a; j < fuente.length; j++) {
        if (fuente[j] === '{') nivel++
        else if (fuente[j] === '}') {
            nivel--
            // eslint-disable-next-line no-eval
            if (nivel === 0) return eval(`(${fuente.slice(a, j + 1)})`)
        }
    }
    throw new Error(`Bloque de ${nombre} sin cerrar`)
}

const constantes = readFileSync(join(raiz, 'lib', 'production-constants.ts'), 'utf8')
const CATEGORY_PRODUCTS = leerObjeto(constantes, 'CATEGORY_PRODUCTS')
const SUCURSAL_ACRONYMS = leerObjeto(constantes, 'SUCURSAL_ACRONYMS')
const PARAMETER_APPLICABILITY = leerObjeto(constantes, 'PARAMETER_APPLICABILITY')
const PRODUCT_STANDARDS = leerObjeto(constantes, 'PRODUCT_STANDARDS')
const PH_STANDARDS = leerObjeto(constantes, 'PH_STANDARDS')

const CATEGORIA_DE = {}
for (const [categoria, codigos] of Object.entries(CATEGORY_PRODUCTS)) {
    for (const c of codigos) if (!CATEGORIA_DE[c]) CATEGORIA_DE[c] = categoria
}

// ============================================================
// Evaluación — misma lógica que evaluateRecord() en la Bitácora
// ============================================================

/**
 * Decide el estado de calidad del lote.
 *
 * Sólidos usa la banda de tolerancia del ±5% sobre el estándar, igual que la
 * app: dentro del rango es conforme, entre el rango y la tolerancia es RETENER,
 * fuera de la tolerancia es NO CONFORME.
 *
 * Un producto al que no le aplica ningún parámetro —las bases, por ejemplo— NO
 * se marca SIN MEDICION: no hay nada que medir, así que queda CONFORME igual que
 * si lo hubiera capturado el operador en la app. Marcarlo sin medición lo sacaría
 * del FTQ sin razón.
 */
function evaluar(codigo, { m1, m2, ph }) {
    const aplica = PARAMETER_APPLICABILITY[codigo] || { solidos: false, ph: false }
    const tieneSolidos = m1 !== null && m2 !== null
    const tienePh = ph !== null
    const notas = []

    if (!aplica.solidos && !aplica.ph) {
        return { estado: 'CONFORME', notas: 'Producto sin parámetros fisicoquímicos aplicables.' }
    }
    if (!tieneSolidos && !tienePh) {
        return { estado: 'SIN MEDICION', notas: '' }
    }

    let estado = 'CONFORME'

    if (aplica.solidos && tieneSolidos) {
        const std = PRODUCT_STANDARDS[codigo]
        if (std && std.min !== undefined && std.max !== undefined) {
            const avg = (m1 + m2) / 2
            const minTol = std.min * 0.95
            const maxTol = std.max * 1.05
            if (avg >= std.min && avg <= std.max) {
                // conforme
            } else if (avg >= minTol && avg <= maxTol) {
                estado = 'RETENER'
                notas.push(`Sólidos: En tolerancia (${avg.toFixed(2)}%) [Std: ${std.min}-${std.max}]`)
            } else {
                estado = 'NO CONFORME'
                notas.push(`Sólidos: Fuera de rango (${avg.toFixed(2)}%) [Std: ${std.min}-${std.max}]`)
            }
        }
    } else if (aplica.solidos) {
        notas.push('Sólidos: sin medición registrada en el reporte de la sucursal')
    }

    if (aplica.ph && tienePh) {
        const std = PH_STANDARDS[codigo]
        if (std && (ph < std.min || ph > std.max)) {
            estado = 'NO CONFORME'
            notas.push(`pH: Fuera de rango (${ph}) [Std: ${std.min}-${std.max}]`)
        }
    } else if (aplica.ph) {
        notas.push('pH: sin medición registrada en el reporte de la sucursal')
    }

    return { estado, notas: notas.join('. ') }
}

// ============================================================
// Lectura
// ============================================================

const aFecha = valor => {
    if (typeof valor !== 'number') return null
    const d = XLSX.SSF.parse_date_code(valor)
    if (!d || d.y < 2000) return null
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
}

const num = v => {
    if (v === '' || v === null || v === undefined) return null
    const n = parseFloat(v)
    return isNaN(n) ? null : n
}

const libro = XLSX.readFile(ARCHIVO)
const arr = XLSX.utils.sheet_to_json(libro.Sheets[libro.SheetNames[0]], { header: 1, defval: '' })

const validas = []
const errores = []

for (let i = 1; i < arr.length; i++) {
    const r = arr[i]
    const renglon = i + 1
    const crudo = String(r[1] || '').trim().toUpperCase()

    // Filas en blanco y encabezados repetidos a media hoja.
    if (!crudo || crudo === 'PRODUCTO') continue
    if (YA_REGISTRADOS.has(renglon)) continue

    const codigo = CORRECCIONES[crudo] || crudo
    const fecha = aFecha(r[0])
    const cant = num(r[2])
    const fila = {
        renglon, codigo,
        fecha,
        cant,
        m1: num(r[3]), m2: num(r[4]),
        t1: num(r[5]), t2: num(r[6]),
        ph: num(r[7]),
        ...(MEDICIONES_CORREGIDAS[renglon] || {}),
    }

    const falla = []
    if (!CATEGORIA_DE[codigo]) falla.push(`código fuera del catálogo: "${crudo}"`)
    if (!fecha) falla.push(`fecha ilegible: "${r[0]}"`)
    if (cant === null || cant <= 0) falla.push(`cantidad inválida: "${r[2]}"`)

    if (falla.length) errores.push({ renglon, falla })
    else validas.push({ ...fila, categoria: CATEGORIA_DE[codigo], ...evaluar(codigo, fila) })
}

if (errores.length) {
    console.error(`\n${errores.length} renglón(es) con problemas — ninguno se incluyó:\n`)
    for (const e of errores) console.error(`  fila ${e.renglon}: ${e.falla.join(' · ')}`)
}

if (validas.length === 0) {
    console.error('\nNo quedó ningún renglón válido.')
    process.exit(1)
}

// ============================================================
// Resumen
// ============================================================

const conteo = {}
for (const v of validas) conteo[v.estado] = (conteo[v.estado] || 0) + 1

const fechas = validas.map(v => v.fecha).sort()
const corregidas = validas.filter(v => Object.values(CORRECCIONES).includes(v.codigo)).length

console.log(`\n${validas.length} lotes válidos`)
console.log(`  Sucursal:   ${SUCURSAL} (${SUCURSAL_ACRONYMS[SUCURSAL]})`)
console.log(`  Preparador: ${PREPARADOR}`)
console.log(`  Período:    ${fechas[0]} a ${fechas[fechas.length - 1]}`)
console.log(`  Códigos corregidos: ${corregidas}`)
console.log('\n  Veredictos:')
for (const [k, n] of Object.entries(conteo).sort()) console.log(`    ${k.padEnd(13)} ${n}`)

const noConformes = validas.filter(v => v.estado === 'NO CONFORME')
if (noConformes.length) {
    console.log('\n  Lotes NO CONFORME (no se les abre NCR automático):')
    for (const v of noConformes) {
        console.log(`    fila ${v.renglon}  ${v.fecha}  ${v.codigo}  —  ${v.notas}`)
    }
}

if (soloValidar) {
    console.log('\nModo --check: no se escribió ningún archivo.\n')
    process.exit(0)
}

// ============================================================
// SQL
// ============================================================

const esc = s => String(s).replace(/'/g, "''")
const n = v => v === null ? 'NULL' : v

const valores = validas.map(v =>
    `    ('${v.fecha}'::date, '${esc(v.codigo)}', '${esc(v.categoria)}', ${v.cant}, ` +
    `${n(v.ph)}, ${n(v.m1)}, ${n(v.m2)}, ${n(v.t1)}, ${n(v.t2)}, ` +
    `'${esc(v.estado)}', '${esc(v.notas)}')`
).join(',\n')

const sql = `-- Reporte de producción de ${SUCURSAL}, capturado a mano.
-- Preparador: ${PREPARADOR}
-- ${validas.length} lotes · ${fechas[0]} a ${fechas[fechas.length - 1]}
--
-- Generado por scripts/reporte-produccion-to-sql.mjs — no editar a mano.
--
-- Veredictos: ${Object.entries(conteo).map(([k, v]) => `${k} ${v}`).join(' · ')}
--
-- Los lotes con mediciones quedan con su estado real; los que no traen ninguna,
-- en SIN MEDICION, para que sumen volumen pero no entren al cálculo de FTQ.
-- Apariencia, color y aroma van nulos: el reporte de la sucursal no los incluye.

BEGIN;

WITH datos(fecha, codigo, familia, tamano, ph, m1, m2, t1, t2, estado, notas) AS (
  VALUES
${valores}
),
-- Oscar no tiene cuenta: los lotes se cargan bajo la de Juan Manuel, igual que
-- los dos que ya estaban capturados, pero conservando el nombre de quien fabricó.
cuenta AS (
  SELECT id
  FROM profiles
  WHERE full_name = '${esc(CUENTA_CAPTURA)}' AND sucursal = '${esc(SUCURSAL)}'
  LIMIT 1
),
numerados AS (
  SELECT
    d.*,
    ROW_NUMBER() OVER (PARTITION BY d.fecha, d.codigo ORDER BY d.tamano) AS seq,
    COALESCE((
      SELECT COUNT(*) FROM bitacora_produccion_calidad b
      WHERE b.sucursal = '${esc(SUCURSAL)}'
        AND b.codigo_producto = d.codigo
        AND b.fecha_fabricacion = d.fecha
    ), 0) AS previos
  FROM datos d
)
INSERT INTO bitacora_produccion_calidad
  (sucursal, nombre_preparador, fecha_fabricacion, codigo_producto,
   lote_producto, familia_producto, tamano_lote,
   ph, solidos_medicion_1, solidos_medicion_2, temp_med1, temp_med2,
   user_id, estado_calidad, observaciones, observaciones_calidad)
SELECT
  '${esc(SUCURSAL)}',
  '${esc(PREPARADOR)}',
  n.fecha,
  n.codigo,
  to_char(n.fecha, 'YYMMDD') || '-${SUCURSAL_ACRONYMS[SUCURSAL]}-' || n.codigo || n.tamano::int
    || '-' || lpad((n.previos + n.seq)::text, 2, '0'),
  n.familia,
  n.tamano,
  n.ph,
  n.m1,
  n.m2,
  n.t1,
  n.t2,
  c.id,
  n.estado,
  '${esc(OBS)}',
  NULLIF(n.notas, '')
FROM numerados n
CROSS JOIN cuenta c;

COMMIT;

-- La transacción protege contra una falla a medias: o entran los ${validas.length}
-- lotes o no entra ninguno. Las comprobaciones van DESPUÉS, en consultas aparte:
-- el editor de Supabase corre el script completo de un tirón.
`

writeFileSync(SALIDA, sql, 'utf8')
console.log(`\nSQL escrito en ${SALIDA}`)

console.log(`
Antes de inyectar, confirma que no haya ya registros en ese período:

  SELECT fecha_fabricacion, COUNT(*) AS lotes
  FROM bitacora_produccion_calidad
  WHERE sucursal = '${SUCURSAL}'
    AND fecha_fabricacion BETWEEN '${fechas[0]}' AND '${fechas[fechas.length - 1]}'
  GROUP BY fecha_fabricacion ORDER BY fecha_fabricacion;

Y que la cuenta de captura exista con ese nombre exacto:

  SELECT id, full_name FROM profiles
  WHERE sucursal = '${SUCURSAL}' AND full_name = '${CUENTA_CAPTURA}';

Después de inyectar, confirma que no se duplicaron lotes:

  SELECT lote_producto, COUNT(*)
  FROM bitacora_produccion_calidad
  WHERE sucursal = '${SUCURSAL}'
  GROUP BY lote_producto HAVING COUNT(*) > 1;
`)
