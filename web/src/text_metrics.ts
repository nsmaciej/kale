import { Size } from "geometry";
import { KaleTheme } from "theme";

interface TextStyle {
    bold?: boolean;
    italic?: boolean;
}

export default class TextMetrics {
    static global: TextMetrics;

    private readonly _metricsCache: { [content: string]: number } = {};
    private readonly _textElement: SVGTextElement;

    static async loadGlobal(theme: KaleTheme): Promise<void> {
        // Types provided by types/font_loading.d.ts
        await document.fonts.load(`${theme.fontSizePx}px ${theme.fontFamily}`);
        await document.fonts.load(`italic ${theme.fontSizePx}px ${theme.fontFamily}`);
        await document.fonts.load(`bold ${theme.fontSizePx}px ${theme.fontFamily}`);
        await document.fonts.load(`bold italic ${theme.fontSizePx}px ${theme.fontFamily}`);
        TextMetrics.global = new TextMetrics(theme);
    }

    constructor(private readonly theme: KaleTheme) {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        // Note display none would cause the text to not render.
        svg.style.visibility = "hidden";
        svg.style.position = "absolute";

        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.style.fontFamily = this.theme.fontFamily;
        text.style.fontSize = `${this.theme.fontSizePx}px`;
        svg.appendChild(text);
        this._textElement = text;
        document.body.appendChild(svg);
    }

    measure(text: string, { bold = false, italic = false }: TextStyle = {}): Size {
        const key = [+bold, +italic, text].join("");
        const HEIGHT_FUDGE_FACTOR = 1.3;
        const height = this.theme.fontSizePx * HEIGHT_FUDGE_FACTOR;
        if (key in this._metricsCache) {
            return new Size(this._metricsCache[key], height);
        }
        const nbsp = "\xa0"; // Without this we can't measure trailing spaces.
        this._textElement.textContent = text.replace(/ /g, nbsp);
        this._textElement.style.fontWeight = bold ? "bold" : "normal";
        this._textElement.style.fontStyle = italic ? "italic" : "normal";
        const width = this._textElement.getComputedTextLength();
        this._metricsCache[key] = width;
        return new Size(width, height);
    }
}
