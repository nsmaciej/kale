import { Offset } from "geometry";
import { assert } from "utils";

export const DefaultTheme = {
    // Text.
    fontSizePx: 13,
    fontFamily: "iA Writer Quattro",
    mainTextColour: "#404040",
    subtleTextColour: "#7b7b7b",

    // Generic colours.
    disabledColour: "#d8d8d8",
    grey: "#e4e4e4",
    clickableGrey: "#ccc",
    clickableColour: "#1b65f1",
    borderRadiusPx: 4,

    // Interface and decoration colours.
    decorationColour: "#6a6a6a",
    listRulerStroke: "#000000",
    highlightStroke: "#cecece",
    exprViewPaddingPx: 8,
    disabledExprColour: "#cccccc",

    // Code colours.
    callColour: "#000000",
    commentColour: "#00b508",
    variableColour: "#248af0",
    literalColour: "#ef6c00",
    blanks: {
        padding: new Offset(10, 1),
        stroke: "#dcdcdc",
        fill: "#f7f7f7",
        fillHover: "#efefef",
        textColour: "#909090",
    },

    // Selection and highlights.
    selection: {
        paddingPx: new Offset(3),
        radiusPx: 3,
        blurredFill: "#fcfdff",
        blurredStroke: "#d7e9ff",
        fill: "#edf5ff",
        stroke: "#9fcbff",
    },

    // Create Circle.
    createCircle: {
        radius: 2,
        maxRadius: 6, //TODO: This should be based on the current text size.
    },

    // Layout.
    lineBreakPointPx: 300,
    underlineSpacingPx: 3,
    lineSpacingPx: 8, //TODO: This should be based on the current text size.

    // Settings.
    showingShortcuts: true,
    showingToyBox: true,
};

// The main padding needs to be greather than the selection padding.
assert(DefaultTheme.exprViewPaddingPx >= DefaultTheme.selection.paddingPx.x);
assert(DefaultTheme.exprViewPaddingPx >= DefaultTheme.selection.paddingPx.y);

export type KaleTheme = typeof DefaultTheme;

// Augument the DefaultTheme type.
// See: https://github.com/styled-components/styled-components-website/issues/447
// and DefaultTheme comments for more.
declare module "styled-components" {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    export interface DefaultTheme extends KaleTheme {}
}
