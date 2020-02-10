import React, { ReactNode } from "react";
import { vec, Size, Vector } from "./geometry";
import TextMetrics from "./text_metrics";

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
    containsList: boolean;
}

export function containInBox({ nodes, size, containsList }: Layout): Layout {
    const padding = 5;
    const newSize = size.pad(padding * 2);
    return {
        size: newSize,
        containsList,
        nodes: (
            <>
                <rect
                    width={newSize.width}
                    height={newSize.height}
                    rx="3"
                    fill="#f56342"
                />
                <Group translate={vec(padding, padding)}>{nodes}</Group>
            </>
        ),
    };
}

//TODO: Rewrite to lazily compute layout.
export class Stack {
    readonly driftMargin: number;
    readonly lineMargin: number;

    private nodes: ReactNode[] = [];
    private size = Size.zero;
    private containsList = false;

    // How much to shift the next argument left, or if it's a contains-list, how far down.
    private driftX = 0;
    private currentLineY = 0;
    private nextLineY = 0;

    constructor() {
        this.driftMargin = TextMetrics.global.measure("\xa0").width; // Non-breaking space.
        //TODO: This should be based on the current text size.
        this.lineMargin = 8;
    }

    private place(position: Vector, layout: Layout) {
        this.nodes.push(<Group translate={position}>{layout.nodes}</Group>);
        this.size = this.size.extend(position, layout.size);
    }

    stackRight(layout: Layout) {
        this.place(vec(this.driftX, this.currentLineY), layout);
        this.containsList = this.containsList || layout.containsList;
        this.driftX += layout.size.width + this.driftMargin;
        this.nextLineY = this.size.height + this.lineMargin;
    }
    stackDown(layout: Layout) {
        this.currentLineY = this.nextLineY;
        this.place(vec(0, this.currentLineY), layout);
        this.containsList = true;
        this.driftX = layout.size.width + this.driftMargin;
        this.nextLineY = this.size.height + this.lineMargin;
    }

    resetDrift() {
        this.driftX = 0;
        this.currentLineY = this.nextLineY;
    }

    layout(): Layout {
        return {
            nodes: this.nodes,
            size: this.size,
            containsList: this.containsList,
        };
    }
}

export function stackDown(children: Layout[]): Layout {
    const stack = new Stack();
    for (const x of children) stack.stackDown(x);
    return stack.layout();
}
