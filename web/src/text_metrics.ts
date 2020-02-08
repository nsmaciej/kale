import { size, Size } from "./geometry"

export interface Theme {
    fontSizePx: number,
    fontFamily: string,
}

export default class TextMetrics {
    static global: TextMetrics

    private _theme: Theme
    private _metricsCache: { [content: string]: number } = {}
    private _textElement: SVGTextElement

    static async loadGlobal(theme: Theme): Promise<void> {
        // Types provided by types/font_loading.d.ts
        await document.fonts.load(`${theme.fontSizePx}px ${theme.fontFamily}`)
        TextMetrics.global = new TextMetrics(theme)
    }

    constructor(theme: Theme) {
        this._theme = theme
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
        // It has to be visibility instead of display none. Not really sure why.
        svg.setAttribute("width", "1")
        svg.setAttribute("height", "1")
        svg.setAttribute("viewBox", "0 0 1 1")
        svg.style.visibility = "hidden"
        svg.style.position = "absolute"

        const text = document.createElementNS("http://www.w3.org/2000/svg", "text")
        text.style.fontFamily = this._theme.fontFamily
        text.style.fontSize = `${this._theme.fontSizePx}px`
        svg.appendChild(text)
        this._textElement = text
        document.body.appendChild(svg)
    }

    measure(text: string): Size {
        if (text in this._metricsCache) {
            return size(this._metricsCache[text], this._theme.fontSizePx)
        }
        this._textElement.textContent = text
        const width = this._textElement.getComputedTextLength()
        this._metricsCache[text] = width
        return size(width, this._theme.fontSizePx)
    }
}