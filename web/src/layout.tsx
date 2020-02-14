import React, { ReactNode, SVGProps } from "react";
import { Size, Vector } from "./geometry";
import { assert } from "./utils";

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
    stroke = "#000000",
    ...props
}: CustomSvgProps<SVGLineElement, { start: Vector; end: Vector }>) {
    return (
        <line
            x1={start.x}
            x2={end.x}
            y1={start.y}
            y2={end.y}
            stroke={stroke}
            {...props}
        />
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

export function place(at: Vector, layout: Layout, key: string, id: number) {
    return (
        <Group translate={at} key={`${key}-${id}`}>
            {layout.nodes}
        </Group>
    );
}

export function toExprLayout(layout: Layout): ExprLayout {
    return { ...layout, inline: false, underlines: null };
}

// Underlinging a layout means it's inline.
export function underline(
    layout: Layout,
    children: [number, Underline][] = [],
): ExprLayout {
    return {
        ...layout,
        inline: true,
        underlines: { width: layout.size.width, children },
    };
}

function stack(
    children: Layout[],
    corner: (size: Size, ix: number) => Vector,
): Layout {
    let size = Size.zero;
    const nodes: ReactNode[] = [];
    children.forEach((child, ix) => {
        // Make sure that if we are stacking something we aren't discarding underlines.
        assert(!(child as ExprLayout).underlines);
        const pos = corner(size, ix);
        nodes.push(place(pos, child, "stack", ix));
        size = size.extend(pos, child.size);
    });
    return { size, nodes };
}

export function stackHorizontal(margin: number, ...children: Layout[]) {
    return stack(children, (x, i) =>
        i === 0 ? Vector.zero : x.top_right.dx(margin),
    );
}

export function stackVertical(margin: number, ...children: Layout[]) {
    return stack(children, (x, i) =>
        i === 0 ? Vector.zero : x.bottom_left.dy(margin),
    );
}
