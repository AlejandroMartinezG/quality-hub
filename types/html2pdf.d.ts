declare module 'html2pdf.js' {
    interface Html2PdfOptions {
        margin?: number | [number, number, number, number]
        filename?: string
        image?: { type?: string; quality?: number }
        html2canvas?: Record<string, unknown>
        jsPDF?: Record<string, unknown>
        pagebreak?: {
            mode?: string | string[]
            before?: string | string[]
            after?: string | string[]
            avoid?: string | string[]
        }
        enableLinks?: boolean
    }

    interface Html2PdfWorker {
        set(opt: Html2PdfOptions): Html2PdfWorker
        from(element: HTMLElement | string): Html2PdfWorker
        save(filename?: string): Promise<void>
        toPdf(): Html2PdfWorker
        output(type?: string): Promise<unknown>
    }

    function html2pdf(element?: HTMLElement, opt?: Html2PdfOptions): Html2PdfWorker

    export default html2pdf
}
