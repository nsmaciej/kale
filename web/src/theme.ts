import { Vec } from "./geometry";

export default {
    // Text.
    fontSizePx: 13,
    fontFamily: "iA Writer Quattro",

    // Interface and decoration colours.
    decorationColour: "#6a6a6a",
    selectionColour: "#edf5ff",
    selectionStrokeColour: "#9fcbff",
    highlightStrokeColour: "#cecece",
    commentColour: "#16a831",
    exprViewPaddingPx: 12,

    // Code colours.
    variableColour: "#248af0",
    literalColour: "#f59a11",
    holeColour: "#ff0000",

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
};
