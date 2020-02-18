import React, { ReactNode } from "react";

import { Size, Vector } from "./geometry";
import { Optional, max } from "./utils";
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
        for (const x of layout.underlines) {
            this.underlines.push({
                level: x.level + +layout.isUnderlined,
                length: x.length,
                offset: x.offset + pos.x,
            });
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

type StackLayout = (Optional<Layout>[] | Optional<Layout>)[];

function stack(column: boolean, margin: number, args: StackLayout) {
    const children = args.flat().filter(x => x != null);
    if (children.length === 1) {
        return children[0];
    }

    const layout = new Layout();
    for (const x of children.flat()) {
        // Do not use the margin for the first element.
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
