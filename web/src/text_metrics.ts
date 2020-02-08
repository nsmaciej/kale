import { size, Size } from "./geometry"

// Eventually this will be passed to TextMetrics somehow.
export const KALE_THEME = {
    fontSizePx: 16,
    fontFamily: "'iA Writer Quattro', monospace",
}

export default class TextMetrics {
    private static _global: TextMetrics;

    private _metricsCache: { [content: string]: number } = {}
    private _textElement: SVGTextElement

    static get global(): TextMetrics {
        // This needs to be lazy because we use the DOM.
        if (TextMetrics._global) return TextMetrics._global;
        return TextMetrics._global = new TextMetrics();
    }

    constructor() {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
        // It has to be visibility instead of display none. Not really sure why.
        svg.setAttribute("width", "1")
        svg.setAttribute("height", "1")
        svg.setAttribute("viewBox", "0 0 1 1")
        svg.style.visibility = "hidden"
        svg.style.position = "absolute"

        const text = document.createElementNS("http://www.w3.org/2000/svg", "text")
        text.style.fontFamily = KALE_THEME.fontFamily
        text.style.fontSize = `${KALE_THEME.fontSizePx}px`
        svg.appendChild(text)
        this._textElement = text
        document.body.appendChild(svg)
    }

    measure(text: string): Size {
        if (text in this._metricsCache) {
            return size(this._metricsCache[text], KALE_THEME.fontSizePx)
        }
        this._textElement.textContent = text
        const width = this._textElement.getComputedTextLength()
        this._metricsCache[text] = width
        return size(width, KALE_THEME.fontSizePx)
    }
}