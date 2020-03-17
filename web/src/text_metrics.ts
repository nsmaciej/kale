import { Size } from "geometry";
import { KaleTheme } from "theme";

export interface TextStyle {
    weight?: number;
    italic?: boolean;
}

export default class TextMetrics {
    static global: TextMetrics;

    private readonly _metricsCache: { [content: string]: number } = {};
    private readonly _textElement: SVGTextElement;

    static async loadGlobal(theme: KaleTheme): Promise<void> {
        const font = `${theme.expr.fontSizePx}px ${theme.expr.fontFamily}`;
        // Types provided by types/font_loading.d.ts
        await document.fonts.load(font);
        await document.fonts.load(`italic ${font}`);
        await document.fonts.load(`bold ${font}`);
        await document.fonts.load(`bold italic ${font}`);
        TextMetrics.global = new TextMetrics(theme);
    }

    constructor(private readonly theme: KaleTheme) {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        // Note display none would cause the text to not render.
        svg.style.visibility = "hidden";
        svg.style.position = "absolute";

        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.style.fontFamily = this.theme.expr.fontFamily;
        text.style.fontSize = `${this.theme.expr.fontSizePx}px`;
        // This is very important, otherwise inline editing breaks on trailing spaces. Before this
        // my approach was replacing every space with NBSP, but the kerning would often work out
        // differently.
        text.style.whiteSpace = "pre";
        svg.appendChild(text);
        this._textElement = text;
        document.body.appendChild(svg);
    }

    get space(): Size {
        // Measure the non-breaking space.
        return this.measure("\xa0");
    }

    measure(text: string, { weight = 400, italic = false }: TextStyle = {}): Size {
        // Font-weight of 400 is the same as normal.
        const key = [weight, +italic, text].join("");
        const HEIGHT_FUDGE_FACTOR = 1.3;
        // I don't why, but this is important to the text lining up with inline editors.
        const height = Math.round(this.theme.expr.fontSizePx * HEIGHT_FUDGE_FACTOR);
        if (key in this._metricsCache) {
            return new Size(this._metricsCache[key], height);
        }
        this._textElement.textContent = text;
        this._textElement.style.fontWeight = weight.toString();
        this._textElement.style.fontStyle = italic ? "italic" : "normal";
        const width = Math.round(this._textElement.getComputedTextLength());
        this._metricsCache[key] = width;
        return new Size(width, height);
    }
}
