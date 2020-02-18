import React, { ReactNode, SVGProps } from "react";
import { Size, Vector, vec } from "./geometry";
import { max } from "./utils";

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

export interface Underline {
    level: number;
    offset: number;
    length: number;
}

export class Layout {
    nodes: ReactNode[] = [];
    inline = false;
    underlines: Underline[] = [];
    isUnderlined = false;

    constructor(node: ReactNode = null, public size = Size.zero) {
        this.nodes = [node];
    }

    stack(direction: "v" | "h", margin: number, layout: Layout) {
        const size = this.size.pad(this.size.isZero() ? 0 : margin);
        const pos = direction == "v" ? size.bottom_left : size.top_right;
        this.place(pos, layout);
    }

    place(pos: Vector, layout: Layout, index = this.nodes.length) {
        this.size = this.size.extend(pos, layout.size);
        this.nodes.splice(
            index,
            0,
            <Group translate={pos}>{layout.nodes.flat()}</Group>,
        );
        if (layout.underlines.length) {
            for (const x of layout.underlines) {
                this.underlines.push({
                    level: x.level + +layout.isUnderlined,
                    length: x.length,
                    offset: x.offset + pos.x,
                });
            }
        }
        if (layout.isUnderlined) {
            this.underlines.push({
                level: 0,
                length: layout.size.width,
                offset: pos.x,
            });
        }
    }

    underlinesHeight() {
        return max(this.underlines.map(x => x.level)) + +this.isUnderlined;
    }

    materialiseUnderlines(theme: { underlineColour: string }): Layout {
        const layout = new Layout(this.nodes, this.size);
        const LINE_GAP = 3;
        // It took a while, but black, crispEdge, 0.5 stroke lines work well. They looks equally
        // well at full and half-pixel multiples; and look good on high-dpi screens.
        for (const x of this.underlines) {
            const pos = vec(x.offset, this.size.height + x.level * LINE_GAP);
            layout.nodes.push(
                <Line
                    start={pos}
                    end={pos.dx(x.length)}
                    strokeWidth={0.5}
                    shapeRendering="crispEdges"
                    stroke={theme.underlineColour}
                />,
            );
        }
        return layout;
    }
}

type StackLayout = (Layout[] | Layout)[];

function stack(direction: "v" | "h", margin: number, children: StackLayout) {
    const layout = new Layout();
    for (const x of children.flat()) layout.stack(direction, margin, x);
    return layout;
}

export const hstack = (margin: number, ...children: StackLayout) =>
    stack("h", margin, children);
export const vstack = (margin: number, ...children: StackLayout) =>
    stack("v", margin, children);
