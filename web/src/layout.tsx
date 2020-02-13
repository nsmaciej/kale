import React, { ReactNode } from "react";
import { vec, Size, Vector } from "./geometry";
import TextMetrics from "./text_metrics";
import { Expr } from "./expr";

export function Group({
    children,
    translate = Vector.zero,
}: {
    children: ReactNode;
    translate?: Vector;
}) {
    return (
        <g transform={`translate(${translate.x} ${translate.y})`}>{children}</g>
    );
}

export interface Layout {
    size: Size;
    nodes: ReactNode;
}

export interface Underline {
    width: number;
    // Offset and underline.
    children: [number, Underline][];
}

export interface ExprLayout extends Layout {
    // Pending underlines, only inline layouts can be underlined.
    underlines: null | Underline;
    // Whether a layout is inline (nee "not contains-block").
    inline: boolean;
}
