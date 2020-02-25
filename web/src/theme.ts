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

    // Code colours.
    variableColour: "#248af0",
    literalColour: "#f59a11",
    holeColour: "#ff0000",

    // This also needs to be large enough to allow bottom-most underlines to render.
    selectionPaddingPx: new Vec(5, 3),
    selectionRadiusPx: 3,
    //TODO: This should be based on the current text size.
    lineSpacingPx: 8,
    createCircleR: 2,
    //TODO: This should be based on the current text size.
    createCircleMaxR: 6,

    // Layout.
    lineBreakPointPx: 300,
};
