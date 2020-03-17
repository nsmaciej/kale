import { Padding } from "geometry";
import { assert } from "utils";

export interface Highlight {
    fill(focused: boolean): string;
    stroke(focused: boolean): string;
}

export function fillStroke(
    fill = "none",
    stroke = "none",
    blurredFill = fill,
    blurredStroke = stroke,
): Highlight {
    return {
        fill(focused: boolean) {
            return focused ? fill : blurredFill;
        },
        stroke(focused: boolean) {
            return focused ? stroke : blurredStroke;
        },
    };
}

export const DefaultTheme = {
    borderRadius: 4,

    colour: {
        mainText: "#404040",
        subtleText: "#7b7b7b",
        grey: "#e4e4e4",
        disabled: "#d8d8d8",
        active: "#003fb7",
        clickable: "#1b65f1",
        subtleClickable: "#ccc",
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

    blanks: {
        padding: new Padding(0, 10),
        highlight: fillStroke("#f7f7f7", "#dcdcdc"),
        hover: fillStroke("#efefef", "#dcdcdc"),
        textColour: "#909090",
    },

    highlight: {
        padding: new Padding(3),
        mainPadding: new Padding(3, 20, 3, 3),
        radius: 3,
        selection: fillStroke("#f2f7ff", "#4375f9", "#fcfdff", "#b8ccff"),
        hover: fillStroke(undefined, "#cecece"),
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

    features: {
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
