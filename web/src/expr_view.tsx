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
    Group,
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
    // This also needs to be large enough to allow bottom-most underlines to render.
    selectionPaddingPx: 5,
    selectionRadiusPx: 3,
};

interface ExprViewProps {
    expr: Expr;
    frozen?: boolean;
    selection?: Optional<Expr>;
    onClick?: (expr: Expr) => void;
}

interface ExprViewState {
    hoverHighlight: Optional<Expr>;
}

// This needs to be a class component so we can nicely pass it to the layout helper.
//TODO: Support a prop indicating if the view has focus. (Otherwise dim selection)
export default class ExprView extends Component<ExprViewProps> {
    state: ExprViewState = { hoverHighlight: null };

    onClick(event: React.MouseEvent, expr: Expr) {
        event.stopPropagation();
        this.props.onClick?.(expr);
    }
    onHover(event: React.MouseEvent, expr: Optional<Expr>) {
        event.stopPropagation();
        this.setState({ hoverHighlight: expr });
    }

    render() {
        const { nodes, size } = new ExprLayoutHelper(this).layout(
            this.props.expr,
        );
        const { width, height } = size.pad(KALE_THEME.selectionPaddingPx * 2);
        const padding = vec(
            KALE_THEME.selectionPaddingPx,
            KALE_THEME.selectionPaddingPx,
        );
        return (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width={width}
                height={height}
                // SVGs are inline by default, this leads to a scourge of invisible space
                // characters. Make it a block instead.
                display="block"
            >
                <Group translate={padding}>{nodes}</Group>
            </svg>
        );
    }
}

interface TextProperties {
    italic?: boolean;
    bold?: boolean;
    colour?: string;
    title?: string;
}

export class LayoutNotSupported extends Error {}

// See https://vanseodesign.com/web-design/svg-text-baseline-alignment/ for excellent discussion
// on SVG text aligment properties.
const Code = styled.text<{ cursor?: string }>`
    font-size: ${KALE_THEME.fontSizePx}px;
    font-family: ${KALE_THEME.fontFamily};
    dominant-baseline: text-before-edge;
`;

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
                    onMouseOver={e => this.parentView.onHover(e, expr)}
                    onMouseOut={e => this.parentView.onHover(e, null)}
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
        const selected = this.parentView.props.selection === expr;
        const highlighted = this.parentView.state.hoverHighlight === expr;
        if (selected || highlighted) {
            const { size, inline, underlines, nodes: layoutNodes } = layout;
            const padding = KALE_THEME.selectionPaddingPx;
            const nodes = (
                <>
                    <rect
                        x={-padding}
                        y={-padding}
                        width={size.width + padding * 2}
                        height={size.height + padding * 2}
                        rx={KALE_THEME.selectionRadiusPx}
                        fill={selected ? KALE_THEME.selectionColour : "#eee"}
                    />
                    {layoutNodes}
                </>
            );
            return { size, inline, underlines, nodes };
        }
        return layout;
    }

    visitList(expr: E.List): ExprLayout {
        //TODO: Add a larger clickable area to the list ruler.
        if (expr.data.comment)
            throw new LayoutNotSupported("List comments are not yet supported");
        let listSize = Size.zero;
        let nodes: ReactNode[] = [];
        for (const line of expr.list) {
            const layout = this.layout(line);
            const pos = listSize.bottom_left.dy(
                // Skip first line.
                listSize.height ? KALE_THEME.lineSpacing : 0,
            );
            if (layout.underlines !== null) {
                nodes.push(
                    place(
                        pos.dy(KALE_THEME.fontSizePx + 5),
                        layoutUnderlines(layout.underlines, true),
                        "underlines",
                        line.id,
                    ),
                );
            }
            nodes.push(place(pos, layout, "line", line.id));
            listSize = listSize.extend(pos, layout.size);
        }

        const ruler = {
            size: size(10, 0),
            nodes: (
                <Line
                    start={vec(3, 5)}
                    end={vec(3, listSize.height)}
                    onClick={e => this.parentView.onClick(e, expr)}
                    onMouseOver={e => this.parentView.onHover(e, expr)}
                    onMouseOut={e => this.parentView.onHover(e, null)}
                />
            ),
        };
        return toExprLayout(
            stackHorizontal(0, ruler, { nodes, size: listSize }),
        );
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
        return this.layoutText(expr, `<${expr.data.comment ?? "HOLE"}>`, {
            colour: "#ff0000",
        });
    }

    visitCall(expr: E.Call): ExprLayout {
        //TODO: Add the comment back.
        const args = expr.args.map(x => this.layout(x));
        //FIXME: This forces top-level call underlines to materialise, find a nicer way to do this.
        const inline =
            isCallInline(args) && expr !== this.parentView.props.expr;
        const inlineMargin = TextMetrics.global.measure("\xa0").width; // Non-breaking space.
        const fnName = this.layoutText(expr, expr.fn, { bold: !inline });
        assert(fnName.inline);

        if (inline) {
            const underlines: [number, Underline][] = [];
            const nodes: ReactNode[] = [];
            let size = Size.zero;

            let i = 0;
            for (const arg of args) {
                // Skip adding the margin to the first argument.
                const pos = size.top_right.dx(size.width ? inlineMargin : 0);
                nodes.push(place(pos, arg, "arg", expr.args[i].id));
                if (arg.underlines)
                    // Sadly we have to account for the size of fnName straight away.
                    underlines.push([
                        pos.x + fnName.size.width + inlineMargin,
                        arg.underlines,
                    ]);
                size = size.extend(pos, arg.size);
                i++;
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
            ...args.map((arg, ix) => {
                // Materialise all underlines.
                if (!arg.underlines) return arg;
                const underlines = place(
                    vec(0, KALE_THEME.fontSizePx + 5),
                    layoutUnderlines(arg.underlines),
                    "underlines",
                    expr.args[ix].id,
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

function isCallInline(args: readonly ExprLayout[]): boolean {
    if (args.length === 0) {
        return true;
    }

    if (!args.every(x => x.inline)) {
        return false;
    }

    // Our situation won't improve much from here on by making the function not-inline.
    if (args.length === 1) {
        return true;
    }

    // Do we need a line break?
    const LINE_BREAK_POINT = 200;
    const lineWidth = args.map(x => x.size.width).reduce((x, y) => x + y, 0);
    if (lineWidth > LINE_BREAK_POINT && args.length > 0) {
        return false;
    }

    // Is the expression too nested?
    const underlineHeights = args.map(x => underlineTreeHeight(x.underlines));
    const MAX_NESTING_LEVEL = 3;
    return max(underlineHeights) < MAX_NESTING_LEVEL;
}
