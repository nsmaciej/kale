import React, { Component, ReactNode } from "react";
import styled from "styled-components";

import { Optional, assert, max } from "./utils";
import { Size, size, vec, Vector } from "./geometry";
import {
    ExprLayout,
    Underline,
    Layout,
    Line,
    place,
    toExprLayout,
    underline,
    stackHorizontal,
    stackVertical,
} from "./layout";
import { Expr, ExprVisitor } from "./expr";
import * as E from "./expr";
import TextMetrics from "./text_metrics";

export const KALE_THEME = {
    fontSizePx: 13,
    fontFamily: "iA Writer Quattro",
    //TODO: This should be based on the current text size.
    lineSpacing: 10,
    underlineColour: "#6a6a6a",
    selectionColour: "#d8eeff",
    variableColour: "#248af0",
    literalColour: "#f59a11",
};

interface ExprViewProps {
    expr: Expr;
    frozen?: boolean;
    selection?: Optional<Expr>;
    onClick?: (expr: Expr) => void;
}

// This needs to be a class component so we can nicely pass it to the layout helper.
//TODO: Support a prop indicating if the view has focus. (Otherwise dim selection)
export default class ExprView extends Component<ExprViewProps> {
    onClick(event: React.MouseEvent, expr: Expr) {
        event.stopPropagation();
        this.props.onClick?.(expr);
    }
    render() {
        return this.props.expr.visit(new ExprLayoutHelper(this)).nodes;
    }
}

interface TextProperties {
    italic?: boolean;
    bold?: boolean;
    colour?: string;
    title?: string;
}

export class LayoutNotSupported extends Error {}

class ExprLayoutHelper implements ExprVisitor<ExprLayout> {
    constructor(private readonly parentView: ExprView) {}

    private layoutText(
        expr: Expr,
        text: string,
        { italic, colour, title, bold }: TextProperties = {},
    ): ExprLayout {
        const size = TextMetrics.global.measure(text);
        return {
            size,
            nodes: (
                <Code
                    fill={colour}
                    fontStyle={italic ? "italic" : undefined}
                    fontWeight={bold ? "bold" : undefined}
                    onClick={e => this.parentView.onClick(e, expr)}
                >
                    {title && <title>{title}</title>}
                    {text}
                </Code>
            ),
            underlines: null,
            inline: true,
        };
    }

    layout(expr: Expr): ExprLayout {
        const layout = expr.visit(this);
        if (this.parentView.props.selection === expr) {
            const { size, inline, underlines, nodes } = layout;
            const PADDING = 3;
            return {
                size,
                inline,
                underlines,
                nodes: (
                    <>
                        <rect
                            x={-PADDING}
                            y={-PADDING}
                            width={size.width + PADDING * 2}
                            height={size.height + PADDING * 2}
                            rx={3}
                            fill={KALE_THEME.selectionColour}
                        />
                        {nodes}
                    </>
                ),
            };
        }
        return layout;
    }

    visitList(expr: E.List): ExprLayout {
        //TODO: Add a larger clickable area to the list ruler.
        if (expr.data.comment)
            throw new LayoutNotSupported("List comments are not yet supported");
        let size = Size.zero;
        let nodes: ReactNode[] = [];
        for (const line of expr.list) {
            const layout = this.layout(line);
            const pos = size.bottom_left.dy(
                // Skip first line.
                size.height ? KALE_THEME.lineSpacing : 0,
            );
            if (layout.underlines !== null) {
                nodes.push(
                    place(
                        pos.dy(KALE_THEME.fontSizePx + 5),
                        layoutUnderlines(layout.underlines, true),
                    ),
                );
            }
            nodes.push(place(pos, layout));
            size = size.extend(pos, layout.size);
        }

        const ruler = {
            size: new Size(10, 0),
            nodes: (
                <Line
                    start={vec(3, 5)}
                    end={vec(3, size.height)}
                    onClick={e => this.parentView.onClick(e, expr)}
                />
            ),
        };
        return toExprLayout(stackHorizontal(0, ruler, { nodes, size }));
    }

    visitLiteral(expr: E.Literal): ExprLayout {
        const content =
            expr.type === "str" ? `"${expr.content}"` : expr.content;
        return this.layoutText(expr, content, {
            title: expr.data.comment,
            colour: KALE_THEME.literalColour,
        });
    }

    visitVariable(expr: E.Variable): ExprLayout {
        return this.layoutText(expr, expr.name, {
            title: expr.data.comment,
            colour: KALE_THEME.variableColour,
        });
    }

    visitHole(expr: E.Hole): ExprLayout {
        //TODO: Wrap this in a nice box or something.
        return this.layoutText(expr, expr.data.comment ?? "HOLE", {
            colour: "#ff0000",
        });
    }

    visitCall(expr: E.Call): ExprLayout {
        //TODO: Add the comment back.
        const args = expr.args.map(x => this.layout(x));
        const inline = isCallInline(args);
        const inlineMargin = TextMetrics.global.measure("\xa0").width; // Non-breaking space.
        const fnName = this.layoutText(expr, expr.fn, { bold: !inline });
        assert(fnName.inline);

        if (inline) {
            const underlines: [number, Underline][] = [];
            const nodes: ReactNode[] = [];
            let size = Size.zero;

            for (const arg of args) {
                // Skip adding the margin to the first argument.
                const pos = size.top_right.dx(size.width ? inlineMargin : 0);
                nodes.push(place(pos, arg));
                if (arg.underlines)
                    // Sadly we have to account for the size of fnName straight away.
                    underlines.push([
                        pos.x + fnName.size.width + inlineMargin,
                        arg.underlines,
                    ]);
                size = size.extend(pos, arg.size);
            }
            return underline(
                args.length > 0
                    ? stackHorizontal(inlineMargin, fnName, { nodes, size })
                    : fnName,
                underlines,
            );
        }

        const argStack = stackVertical(
            KALE_THEME.lineSpacing,
            ...args.map(arg => {
                // Materialise all underlines.
                if (!arg.underlines) return arg;
                const underlines = place(
                    vec(0, KALE_THEME.fontSizePx + 5),
                    layoutUnderlines(arg.underlines),
                );
                return {
                    size: arg.size,
                    nodes: (
                        <>
                            {arg.nodes}
                            {underlines}
                        </>
                    ),
                };
            }),
        );
        return toExprLayout(stackHorizontal(inlineMargin, fnName, argStack));
    }
}

// See https://vanseodesign.com/web-design/svg-text-baseline-alignment/ for excellent discussion
// on SVG text aligment properties.
const Code = styled.text`
    font-size: ${KALE_THEME.fontSizePx}px;
    font-family: ${KALE_THEME.fontFamily};
    dominant-baseline: text-before-edge;
`;

function underlineTreeHeight(underline: null | Underline): number {
    return underline === null
        ? 0
        : 1 + max(underline.children.map(x => underlineTreeHeight(x[1])));
}

function layoutUnderlines(underline: Underline, skipFirst = false): Layout {
    function layout(
        level: number,
        ix: number,
        underline: Underline,
        pos: Vector,
    ): ReactNode {
        // It took a while, but black, crispEdge, 0.5 stroke lines work well. They looks equally
        // well at full and half-pixel multiples; and look good on high-dpi screens.
        const drawn = level > 0 || !skipFirst;
        return (
            <React.Fragment key={ix}>
                {drawn && (
                    <Line
                        start={pos}
                        end={pos.dx(underline.width)}
                        strokeWidth={0.5}
                        shapeRendering="crispEdges"
                        stroke={KALE_THEME.underlineColour}
                    />
                )}
                {underline.children.map(([offset, next], ix) =>
                    layout(
                        level + 1,
                        ix,
                        next,
                        pos.dx(offset).dy(drawn ? 3 : 0),
                    ),
                )}
            </React.Fragment>
        );
    }
    return {
        nodes: layout(0, 0, underline, Vector.zero),
        size: size(underline.width, 1),
    };
}

function isCallInline(args: ExprLayout[]): boolean {
    if (!args.every(x => x.inline)) {
        return false;
    }

    // Do we need a line break?
    const LINE_BREAK_POINT = 200;
    const lineWidth = args.map(x => x.size.width).reduce((x, y) => x + y, 0);
    if (lineWidth > LINE_BREAK_POINT) {
        return false;
    }

    // Is the expression too nested?
    const underlineHeights = args.map(x => underlineTreeHeight(x.underlines));
    const MAX_NESTING_LEVEL = 3;
    return max(underlineHeights) < MAX_NESTING_LEVEL;
}
