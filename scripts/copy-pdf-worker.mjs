import { copyFileSync, existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const src = join(__dirname, "..", "node_modules", "pdfjs-dist", "build", "pdf.worker.min.js")
const dest = join(__dirname, "..", "public", "pdf.worker.min.js")

if (existsSync(src)) {
    copyFileSync(src, dest)
    console.log("pdf.worker.min.js copiado a public/")
} else {
    console.warn("No se encontró pdfjs-dist/build/pdf.worker.min.js — omitiendo copia")
}
