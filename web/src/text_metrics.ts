import { size, Size } from "./geometry";
import THEME from "./theme";

interface TextStyle {
    bold?: boolean;
    italic?: boolean;
}

export default class TextMetrics {
    static global: TextMetrics;

    private readonly _metricsCache: { [content: string]: number } = {};
    private readonly _textElement: SVGTextElement;

    static async loadGlobal(): Promise<void> {
        // Types provided by types/font_loading.d.ts
        await document.fonts.load(`${THEME.fontSizePx}px ${THEME.fontFamily}`);
        await document.fonts.load(
            `italic ${THEME.fontSizePx}px ${THEME.fontFamily}`,
        );
        await document.fonts.load(
            `bold ${THEME.fontSizePx}px ${THEME.fontFamily}`,
        );
        await document.fonts.load(
            `bold italic ${THEME.fontSizePx}px ${THEME.fontFamily}`,
        );
        TextMetrics.global = new TextMetrics();
    }

    constructor() {
        const svg = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "svg",
        );
        // Note display none would cause the text to not render.
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

    measure(
        text: string,
        { bold = false, italic = false }: TextStyle = {},
    ): Size {
        const key = [+bold, +italic, text].join("");
        const HEIGHT_FUDGE_FACTOR = 1.3;
        const height = THEME.fontSizePx * HEIGHT_FUDGE_FACTOR;
        if (key in this._metricsCache) {
            return size(this._metricsCache[key], height);
        }
        this._textElement.textContent = text;
        this._textElement.style.fontWeight = bold ? "bold" : "normal";
        this._textElement.style.fontStyle = italic ? "italic" : "normal";
        const width = this._textElement.getComputedTextLength();
        this._metricsCache[key] = width;
        return size(width, height);
    }
}
