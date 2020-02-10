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

// This essentially works like a typewriter. Calling stack 'types' a block. Calling clear 'presses'
// the Enter key.
export class Stack {
    private previousLines: Layout[][] = [];
    private currentLine: Layout[] = [];

    static CLEAR: "clear" = "clear";

    static fromList(blocks: (Layout | typeof Stack.CLEAR)[]): Layout {
        const stack = new Stack();
        for (const x of blocks) {
            if (x == "clear") {
                stack.clear();
            } else {
                stack.stack(x);
            }
        }
        return stack.layout();
    }

    stack(layout: Layout) {
        this.currentLine.push(layout);
    }

    // Idempotent, calling when the current line is empty does nothing.
    clear() {
        if (this.currentLine) {
            this.previousLines.push(this.currentLine);
            this.currentLine = [];
        }
    }

    // Calling layout clears any pending lines.
    layout(): Layout {
        this.clear();

        const driftMargin = TextMetrics.global.measure("\xa0").width; // Non-breaking space.
        const lineMargin = 8; //TODO: This should be based on the current text size.

        const nodes: ReactNode[] = [];
        let size = Size.zero;
        let containsList = this.previousLines.length > 1;

        for (const line of this.previousLines) {
            // Don't add the line margin to the first line.
            const lineY = size.height + (size.height ? lineMargin : 0);
            let lineX = 0;
            for (const block of line) {
                const pos = vec(lineX, lineY);
                size = size.extend(pos, block.size);
                nodes.push(<Group translate={pos}>{block.nodes}</Group>);
                lineX += block.size.width + driftMargin;
                containsList = containsList || block.containsList;
            }
        }

        return { size, nodes, containsList };
    }
}
