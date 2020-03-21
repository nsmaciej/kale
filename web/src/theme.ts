import { Padding } from "geometry";
import { assert } from "utils";

type HighlightPair = [string | undefined, string | undefined];

export class Highlight {
    strokeWidth = 0.5;
    private readonly focusedPair: HighlightPair;
    private blurredPair: HighlightPair;
    private blankPair?: HighlightPair;
    animates = false;

    constructor(readonly name: string, fill?: string, stroke?: string) {
        this.focusedPair = [fill, stroke];
        this.blurredPair = [fill, stroke];
    }

    withStrokeWidth(strokeWidth: number): this {
        this.strokeWidth = strokeWidth;
        return this;
    }
    withAnimation(): this {
        this.animates = true;
        return this;
    }
    blurred(fill?: string, stroke?: string): this {
        this.blurredPair = [fill, stroke];
        return this;
    }
    blank(fill?: string, stroke?: string): this {
        this.blankPair = [fill, stroke];
        return this;
    }

    fill(focused: boolean) {
        return (focused ? this.focusedPair : this.blurredPair)[0];
    }
    stroke(focused: boolean) {
        return (focused ? this.focusedPair : this.blurredPair)[1];
    }
    blankFill(focused: boolean): string | undefined {
        return this.blankPair?.[0] ?? this.fill(focused);
    }
    blankStroke(focused: boolean): string | undefined {
        return this.blankPair?.[1] ?? this.stroke(focused);
    }
}

export const DefaultTheme = {
    borderRadius: 4,
    boxShadow: "0 0 0 1px #10161a1a, 0 2px 4px #10161a33, 0 8px 24px #10161a33",
    // Mostly used by popover's triangle, since the 24px spread shadow above clips.
    boxShadowSmall: "0 0 0 1px #10161a1a, 0 2px 4px #10161a33",

    colour: {
        clickable: "#1b65f1",
        active: "#003fb7",
        brand: "#0ba902",
        error: "#f44336",
        background: "#ffffff",
        innerBackground: "#f9f9f9",
        grey: "#e4e4e4",
        disabled: "#d8d8d8",
        subtleClickable: "#cccccc",
        subtleText: "#7b7b7b",
        mainText: "#404040",
    },

    expr: {
        fontSizePx: 12,
        fontFamily: "iA Writer Quattro",
    },

    exprList: {
        borderRadius: 8,
        padding: new Padding(4),
    },

    exprView: {
        // This can be used to horizontally align things like headings to the text inside ExprView.
        get padding() {
            return DefaultTheme.highlight.mainPadding.add(new Padding(1));
        },
        get frozenPadding() {
            return DefaultTheme.highlight.padding.add(new Padding(1));
        },
    },

    syntaxColour: {
        call: "#000000",
        comment: "#00b508",
        variable: "#248af0",
        literal: "#ef6c00",
        disabled: "#cccccc",
        underline: "#6a6a6a",
        listRuler: "#000000",
    },

    blank: {
        padding: new Padding(0, 10),
        textColour: "#909090",
        resting: new Highlight("selection", "#f7f7f7", "#dcdcdc"),
    },

    highlight: {
        padding: new Padding(3),
        mainPadding: new Padding(3, 20, 3, 3),
        radius: 3,
        selection: new Highlight("selection", "#f5f9ff80", "#0000ff")
            .blurred("#fcfdff80", "#b8ccff")
            .withAnimation(),
        hover: new Highlight("hover", undefined, "#cecece").blank("#efefef", "#dcdcdc"),
        contextMenu: new Highlight("context", undefined, "#0000ff").withStrokeWidth(1),
        // This is actually the branding colour.
        droppable: new Highlight("droppable", "#ffffff00", "#0ba902").withStrokeWidth(1),
    },

    createCircle: {
        stroke: "#6a6a6a",
        radius: 2,
        maxRadius: 6, //TODO: This should be based on the current text size.
    },

    layout: {
        lineBreakPoint: 300,
        underlineSpacing: 3,
        lineSpacing: 7, // Should be bigger than the selection padding.
    },

    feature: {
        exprListShortcuts: true,
        toyBox: true,
    },
};

assert(
    DefaultTheme.highlight.padding.bottom + DefaultTheme.highlight.padding.top <
        DefaultTheme.layout.lineSpacing,
    "Vertical highlight padding needs to fit in the line-height",
);
assert(
    DefaultTheme.highlight.mainPadding.contains(DefaultTheme.highlight.padding),
    "Main padding needs to be at least as big as the normal padding",
);

export type KaleTheme = typeof DefaultTheme;

// Augument the DefaultTheme type.
// See: https://github.com/styled-components/styled-components-website/issues/447
// and DefaultTheme comments for more.
declare module "styled-components" {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    export interface DefaultTheme extends KaleTheme {}
}
