/**
 * Genera el SQL para inyectar producción capturada a mano.
 *
 * Caso de uso: a una sucursal se le descompone el equipo de medición y fabrica
 * lotes que no puede registrar en la Bitácora, porque el formulario exige las
 * mediciones. Esos lotes se capturan en `plantilla_produccion_manual.xlsx` y se
 * insertan con `estado_calidad = 'SIN MEDICION'`, para que su volumen cuente
 * pero queden fuera del cálculo de FTQ y Yield.
 *
 *   node scripts/produccion-manual-to-sql.mjs            # valida y genera el SQL
 *   node scripts/produccion-manual-to-sql.mjs --check     # solo valida, no escribe
 *
 * El consecutivo del número de lote NO se calcula aquí: va en el SQL, contando
 * los registros que ya existan de esa sucursal, producto y fecha. Calcularlo en
 * JavaScript colisionaría con lo que se haya capturado en la app desde que se
 * llenó la plantilla.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import XLSX from 'xlsx'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const PLANTILLA = join(raiz, 'plantilla_produccion_manual.xlsx')
const SALIDA = join(raiz, 'insert_produccion_manual.sql')

const soloValidar = process.argv.includes('--check')

// ============================================================
// Catálogo, leído del mismo archivo que usa la app
// ============================================================

/**
 * Extrae un objeto literal de production-constants.ts.
 *
 * Se lee del .ts en vez de duplicar el catálogo aquí: si alguien agrega un
 * producto a la app, este script lo acepta sin tocarse. Son literales planos,
 * así que basta recortar el bloque y evaluarlo.
 */
function leerObjeto(fuente, nombre) {
    const inicio = fuente.indexOf(`export const ${nombre}`)
    if (inicio === -1) throw new Error(`No se encontró ${nombre} en production-constants.ts`)

    // El valor arranca en el primer '{' DESPUÉS del '=', no en el primero que
    // aparezca: anotaciones como `Record<string, { solidos: boolean }>` traen
    // llaves propias y harían recortar el bloque equivocado.
    const m = /=\s*\{/.exec(fuente.slice(inicio))
    if (!m) throw new Error(`${nombre} no parece un objeto literal`)
    const llave = inicio + m.index + m[0].length - 1

    let nivel = 0
    for (let i = llave; i < fuente.length; i++) {
        if (fuente[i] === '{') nivel++
        else if (fuente[i] === '}') {
            nivel--
            if (nivel === 0) {
                // eslint-disable-next-line no-eval
                return eval(`(${fuente.slice(llave, i + 1)})`)
            }
        }
    }
    throw new Error(`Bloque de ${nombre} sin cerrar`)
}

const constantes = readFileSync(join(raiz, 'lib', 'production-constants.ts'), 'utf8')
const CATEGORY_PRODUCTS = leerObjeto(constantes, 'CATEGORY_PRODUCTS')
const SUCURSAL_ACRONYMS = leerObjeto(constantes, 'SUCURSAL_ACRONYMS')

/** Código → categoría. En la base la categoría se guarda en `familia_producto`. */
const CATEGORIA_DE = {}
for (const [categoria, codigos] of Object.entries(CATEGORY_PRODUCTS)) {
    for (const c of codigos) if (!CATEGORIA_DE[c]) CATEGORIA_DE[c] = categoria
}

// ============================================================
// Lectura de la plantilla
// ============================================================

/** Excel guarda las fechas como número de serie; aquí se vuelven YYYY-MM-DD. */
function aFecha(valor) {
    if (valor === '' || valor === null || valor === undefined) return null

    if (typeof valor === 'number') {
        const d = XLSX.SSF.parse_date_code(valor)
        if (!d) return null
        return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
    }

    const texto = String(valor).trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto

    // dd/mm/aaaa, que es como lo escribe Excel en español.
    const m = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`

    return null
}

const libro = XLSX.readFile(PLANTILLA)
const hoja = libro.Sheets['Produccion']
if (!hoja) throw new Error("La plantilla no tiene una hoja llamada 'Produccion'")

const filas = XLSX.utils.sheet_to_json(hoja, { defval: '' })
    .filter(f => String(f.codigo_producto || '').trim() !== '')

if (filas.length === 0) {
    console.error('La hoja Produccion está vacía. Llénala antes de correr el script.')
    process.exit(1)
}

// ============================================================
// Validación
// ============================================================

const validas = []
const errores = []

filas.forEach((f, i) => {
    const renglon = i + 2   // +1 por el encabezado, +1 porque Excel empieza en 1
    const sucursal = String(f.sucursal || '').trim().toUpperCase()
    const codigo = String(f.codigo_producto || '').trim().toUpperCase()
    const fecha = aFecha(f.fecha_fabricacion)
    const tamano = Number(f.tamano_lote)
    const preparador = String(f.nombre_preparador || '').trim()
    const obs = String(f.observaciones || '').trim()

    const falla = []
    if (!SUCURSAL_ACRONYMS[sucursal]) falla.push(`sucursal desconocida: "${f.sucursal}"`)
    if (!CATEGORIA_DE[codigo]) falla.push(`código fuera del catálogo: "${f.codigo_producto}"`)
    if (!fecha) falla.push(`fecha ilegible: "${f.fecha_fabricacion}"`)
    if (!Number.isFinite(tamano) || tamano <= 0) falla.push(`tamaño inválido: "${f.tamano_lote}"`)
    if (!preparador) falla.push('falta el preparador')

    if (falla.length) errores.push({ renglon, falla })
    else validas.push({ sucursal, codigo, fecha, tamano, preparador, obs, categoria: CATEGORIA_DE[codigo] })
})

if (errores.length) {
    console.error(`\n${errores.length} renglón(es) con problemas — ninguno se incluyó en el SQL:\n`)
    for (const e of errores) console.error(`  fila ${e.renglon}: ${e.falla.join(' · ')}`)
    console.error('')
}

if (validas.length === 0) {
    console.error('No quedó ningún renglón válido. No se generó SQL.')
    process.exit(1)
}

// Un solo preparador y una sola sucursal por corrida: el SQL resuelve el user_id
// con una subconsulta y mezclarlos daría atribuciones equivocadas.
const sucursales = [...new Set(validas.map(v => v.sucursal))]
const preparadores = [...new Set(validas.map(v => v.preparador))]

if (sucursales.length > 1 || preparadores.length > 1) {
    console.error('\nLa plantilla mezcla sucursales o preparadores:')
    console.error(`  sucursales: ${sucursales.join(', ')}`)
    console.error(`  preparadores: ${preparadores.join(', ')}`)
    console.error('Separa la carga en una corrida por cada combinación.\n')
    process.exit(1)
}

const sucursal = sucursales[0]
const preparador = preparadores[0]
const acronimo = SUCURSAL_ACRONYMS[sucursal]
const fechas = validas.map(v => v.fecha).sort()
const litros = validas.reduce((s, v) => s + v.tamano, 0)

console.log(`\n${validas.length} lotes válidos`)
console.log(`  Sucursal:   ${sucursal} (${acronimo})`)
console.log(`  Preparador: ${preparador}`)
console.log(`  Período:    ${fechas[0]} a ${fechas[fechas.length - 1]}`)
console.log(`  Volumen:    ${litros.toLocaleString('es-MX')} L equivalentes`)

if (soloValidar) {
    console.log('\nModo --check: no se escribió ningún archivo.\n')
    process.exit(0)
}

// ============================================================
// Generación del SQL
// ============================================================

const esc = s => String(s).replace(/'/g, "''")

const valores = validas.map(v =>
    `    ('${v.fecha}'::date, '${esc(v.codigo)}', '${esc(v.categoria)}', ${v.tamano}, '${esc(v.obs)}')`
).join(',\n')

const sql = `-- Producción registrada manualmente: equipo de medición fuera de servicio.
-- Sucursal: ${sucursal} · Preparador: ${preparador}
-- ${validas.length} lotes · ${fechas[0]} a ${fechas[fechas.length - 1]} · ${litros.toLocaleString('es-MX')} L
--
-- Generado por scripts/produccion-manual-to-sql.mjs — no editar a mano.
--
-- Estos lotes NO tienen datos de calidad. Se marcan con estado_calidad = 'SIN MEDICION'
-- para que el volumen cuente pero queden fuera del cálculo de FTQ y Yield.
--
-- El consecutivo del lote se calcula aquí contando los registros ya existentes
-- de esa sucursal, producto y fecha, para no colisionar con los capturados en la app.

BEGIN;

WITH datos(fecha, codigo, familia, tamano, obs) AS (
  VALUES
${valores}
),
preparador AS (
  SELECT id, full_name
  FROM profiles
  WHERE full_name = '${esc(preparador)}' AND sucursal = '${esc(sucursal)}'
  LIMIT 1
),
numerados AS (
  SELECT
    d.*,
    ROW_NUMBER() OVER (PARTITION BY d.fecha, d.codigo ORDER BY d.tamano) AS seq,
    COALESCE((
      SELECT COUNT(*) FROM bitacora_produccion_calidad b
      WHERE b.sucursal = '${esc(sucursal)}'
        AND b.codigo_producto = d.codigo
        AND b.fecha_fabricacion = d.fecha
    ), 0) AS previos
  FROM datos d
)
INSERT INTO bitacora_produccion_calidad
  (sucursal, nombre_preparador, fecha_fabricacion, codigo_producto,
   lote_producto, familia_producto, tamano_lote, user_id, estado_calidad, observaciones)
SELECT
  '${esc(sucursal)}',
  p.full_name,
  n.fecha,
  n.codigo,
  to_char(n.fecha, 'YYMMDD') || '-${acronimo}-' || n.codigo || n.tamano::int
    || '-' || lpad((n.previos + n.seq)::text, 2, '0'),
  n.familia,
  n.tamano,
  p.id,
  'SIN MEDICION',
  n.obs
FROM numerados n
CROSS JOIN preparador p;

COMMIT;

-- La transacción protege contra una falla a medias: o entran los ${validas.length}
-- lotes o no entra ninguno. Las comprobaciones van DESPUÉS, en consultas aparte:
-- el editor de Supabase corre el script completo de un tirón, así que un
-- "revisa y decide" antes del COMMIT nunca alcanza a leerse.
`

writeFileSync(SALIDA, sql, 'utf8')
console.log(`\nSQL escrito en ${SALIDA}`)

console.log(`
Antes de inyectar, confirma que no haya ya registros en ese período:

  SELECT fecha_fabricacion, COUNT(*) AS lotes
  FROM bitacora_produccion_calidad
  WHERE sucursal = '${sucursal}'
    AND fecha_fabricacion BETWEEN '${fechas[0]}' AND '${fechas[fechas.length - 1]}'
  GROUP BY fecha_fabricacion ORDER BY fecha_fabricacion;

Y que el preparador exista con ese nombre exacto:

  SELECT id, full_name FROM profiles
  WHERE sucursal = '${sucursal}' AND full_name = '${preparador}';

Después de inyectar, confirma que no se duplicaron lotes:

  SELECT lote_producto, COUNT(*)
  FROM bitacora_produccion_calidad
  WHERE sucursal = '${sucursal}'
  GROUP BY lote_producto HAVING COUNT(*) > 1;
`)
