import { Vec } from "./geometry";

export default {
    // Text.
    fontSizePx: 13,
    fontFamily: "iA Writer Quattro",
    buttonTextColour: "#1b65f1",

    // Interface and decoration colours.
    decorationColour: "#6a6a6a",
    selectionColour: "#edf5ff",
    selectionStrokeColour: "#9fcbff",
    highlightStrokeColour: "#cecece",
    exprViewPaddingPx: 8,

    // Code colours.
    commentColour: "#00b508",
    variableColour: "#248af0",
    literalColour: "#ef6c00",
    holePillPadding: new Vec(10, 1),
    holeStrokeColour: "#dcdcdc",
    holeFillColour: "#f1f1f1",
    holeFillColourHover: "#dcdcdc", // Same as the stroke right now.
    holeColour: "#909090",

    // Selection and highlights.
    selectionPaddingPx: new Vec(3),
    selectionRadiusPx: 3,

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
