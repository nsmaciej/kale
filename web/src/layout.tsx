import React, { ReactNode } from "react";

import { Size, Vector } from "./geometry";
import { max } from "./utils";
import { Group } from "./components";

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

    copy() {
        return new Layout(this.nodes.slice(), this.size);
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
}

type StackLayout = (Layout[] | Layout)[];

function stack(column: boolean, margin: number, children: StackLayout) {
    const layout = new Layout();
    for (const x of children.flat()) {
        const size = layout.size.pad(layout.size.isZero() ? 0 : margin);
        const pos = column ? size.bottom_left : size.top_right;
        layout.place(pos, x);
    }
    return layout;
}

export const hstack = (margin: number, ...children: StackLayout) =>
    stack(false, margin, children);
export const vstack = (margin: number, ...children: StackLayout) =>
    stack(true, margin, children);
