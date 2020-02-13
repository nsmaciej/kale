import React, { ReactNode, SVGProps } from "react";
import { vec, Size, Vector } from "./geometry";
import TextMetrics from "./text_metrics";
import { Expr } from "./expr";

// A type for components that have custom props but pass everything else on.
type CustomSvgProps<Element, CustomProps> = CustomProps &
    Omit<SVGProps<Element>, keyof CustomProps>;

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

export function Line({
    start,
    end,
    ...props
}: CustomSvgProps<SVGLineElement, { start: Vector; end: Vector }>) {
    return <line x1={start.x} x2={end.x} y1={start.y} y2={end.y} {...props} />;
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

export function place(at: Vector, layout: Layout) {
    return <Group translate={at}>{layout.nodes}</Group>;
}

export function stackHorizontal(...children: Layout[]): Layout {
    let size = Size.zero;
    const nodes: ReactNode[] = [];
    for (const child of children) {
        nodes.push(place(size.top_right, child));
        size = size.extend(size.top_right, child.size);
    }
    return { size, nodes };
}
