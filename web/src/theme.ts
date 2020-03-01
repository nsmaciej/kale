import { Vec } from "./geometry";
import { assert } from "utils";

export const DefaultTheme = {
    // Text.
    fontSizePx: 13,
    fontFamily: "iA Writer Quattro",
    buttonTextColour: "#1b65f1",
    disabledButtonTextColour: "#d8d8d8",

    // Interface and decoration colours.
    decorationColour: "#6a6a6a",
    highlightStroke: "#cecece",
    exprViewPaddingPx: 8,

    // Code colours.
    commentColour: "#00b508",
    variableColour: "#248af0",
    literalColour: "#ef6c00",
    blanks: {
        padding: new Vec(10, 1),
        stroke: "#dcdcdc",
        fill: "#fdfdfd",
        fillHover: "#efefef",
        textColour: "#909090",
    },

    // Selection and highlights.
    selection: {
        paddingPx: new Vec(3),
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

//TODO: Get rid of this.
export default DefaultTheme;

// The main padding needs to be greather than the selection padding.
assert(DefaultTheme.exprViewPaddingPx >= DefaultTheme.selection.paddingPx.x);
assert(DefaultTheme.exprViewPaddingPx >= DefaultTheme.selection.paddingPx.y);

export type ThemeType = typeof DefaultTheme;
