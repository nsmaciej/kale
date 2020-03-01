import { Vec } from "./geometry";
import { assert } from "utils";

const THEME = {
    // Text.
    fontSizePx: 13,
    fontFamily: "iA Writer Quattro",
    buttonTextColour: "#1b65f1",
    disabledButtonTextColour: "#d8d8d8",

    // Interface and decoration colours.
    decorationColour: "#6a6a6a",
    highlightStrokeColour: "#cecece",
    exprViewPaddingPx: 8,

    // Code colours.
    commentColour: "#00b508",
    variableColour: "#248af0",
    literalColour: "#ef6c00",
    blankPillPadding: new Vec(10, 1),
    blankStrokeColour: "#dcdcdc",
    blankFillColour: "#f7f7f7",
    blankFillColourHover: "#dcdcdc", // Same as the stroke right now.
    blankTextColour: "#909090",

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
    createCircleR: 2,
    createCircleMaxR: 6, //TODO: This should be based on the current text size.

    // Layout.
    lineBreakPointPx: 300,
    lineGap: 3,
    lineSpacingPx: 8, //TODO: This should be based on the current text size.

    // Settings.
    showingShortcuts: true,
    showingToyBox: true,
};

// The main padding needs to be greather than the selection padding.
assert(THEME.exprViewPaddingPx >= THEME.selection.paddingPx.x);
assert(THEME.exprViewPaddingPx >= THEME.selection.paddingPx.y);

export default THEME;
