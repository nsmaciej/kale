import { Offset } from "geometry";
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
    // Text.
    fontSizePx: 12,
    fontFamily: "iA Writer Quattro",
    mainTextColour: "#404040",
    subtleTextColour: "#7b7b7b",

    // Generic settings.
    grey: "#e4e4e4",
    disabledColour: "#d8d8d8",
    clickableColour: "#1b65f1",
    clickableSubtleColour: "#ccc",
    activeColour: "#003fb7",
    borderRadiusPx: 4,

    // Interface and decoration colours.
    decorationColour: "#6a6a6a",
    listRulerStroke: "#000000",
    exprViewPaddingPx: 8,
    disabledExprColour: "#cccccc",

    // Code colours.
    callColour: "#000000",
    commentColour: "#00b508",
    variableColour: "#248af0",
    literalColour: "#ef6c00",
    blanks: {
        padding: new Offset(10, 0),
        highlight: fillStroke("#f7f7f7", "#dcdcdc"),
        hover: fillStroke("#efefef", "#dcdcdc"),
        textColour: "#909090",
    },

    // Selection and highlights.
    hoverHighlight: fillStroke(undefined, "#cecece"),
    selection: {
        paddingPx: new Offset(3),
        radiusPx: 3,
        highlight: fillStroke("#f2f7ff", "#4375f9", "#fcfdff", "#b8ccff"),
    },

    // Create Circle.
    createCircle: {
        radius: 2,
        maxRadius: 6, //TODO: This should be based on the current text size.
    },

    // Layout.
    lineBreakPointPx: 300,
    underlineSpacingPx: 3,
    lineSpacingPx: 6, // Should be bigger than the selection padding.

    // Settings.
    showingShortcuts: true,
    showingToyBox: true,
};

// The main padding needs to be greather than the selection padding.
assert(DefaultTheme.exprViewPaddingPx >= DefaultTheme.selection.paddingPx.x);
assert(DefaultTheme.exprViewPaddingPx >= DefaultTheme.selection.paddingPx.y);
// Selection padding needs to fit in the line-height.
assert(DefaultTheme.selection.paddingPx.y < DefaultTheme.lineSpacingPx);

export type KaleTheme = typeof DefaultTheme;

// Augument the DefaultTheme type.
// See: https://github.com/styled-components/styled-components-website/issues/447
// and DefaultTheme comments for more.
declare module "styled-components" {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    export interface DefaultTheme extends KaleTheme {}
}
