import React, { ReactNode } from "react";

import { Size, Vector, vec } from "./geometry";
import { max } from "./utils";
import { Group, UnderlineLine } from "./components";

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

    materialiseUnderlines(): Layout {
        const layout = new Layout(this.nodes, this.size);
        const LINE_GAP = 3;
        for (const x of this.underlines) {
            const pos = vec(x.offset, this.size.height + x.level * LINE_GAP);
            layout.nodes.push(
                <UnderlineLine start={pos} end={pos.dx(x.length)} />,
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
