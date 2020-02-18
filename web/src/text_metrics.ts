import { size, Size } from "./geometry";
import THEME from "./theme";

export default class TextMetrics {
    static global: TextMetrics;

    private readonly _metricsCache: { [content: string]: number } = {};
    private readonly _textElement: SVGTextElement;

    static async loadGlobal(): Promise<void> {
        // Types provided by types/font_loading.d.ts
        await document.fonts.load(`${THEME.fontSizePx}px ${THEME.fontFamily}`);
        TextMetrics.global = new TextMetrics();
    }

    constructor() {
        const svg = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "svg",
        );
        // It has to be visibility instead of display none. Not really sure why.
        svg.setAttribute("width", "1");
        svg.setAttribute("height", "1");
        svg.setAttribute("viewBox", "0 0 1 1");
        svg.style.visibility = "hidden";
        svg.style.position = "absolute";

        const text = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "text",
        );
        text.style.fontFamily = THEME.fontFamily;
        text.style.fontSize = `${THEME.fontSizePx}px`;
        svg.appendChild(text);
        this._textElement = text;
        document.body.appendChild(svg);
    }

    measure(text: string): Size {
        const HEIGHT_FUDGE_FACTOR = 1.3;
        const height = THEME.fontSizePx * HEIGHT_FUDGE_FACTOR;
        if (text in this._metricsCache) {
            return size(this._metricsCache[text], height);
        }
        this._textElement.textContent = text;
        const width = this._textElement.getComputedTextLength();
        this._metricsCache[text] = width;
        return size(width, height);
    }
}
