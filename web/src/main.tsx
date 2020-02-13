import * as ReactDOM from "react-dom";
import React, { Component, ReactNode } from "react";
import styled, { createGlobalStyle } from "styled-components";

import { assert, max } from "./utils";
import { Expr, ExprVisitor } from "./expr";
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
import * as E from "./expr";
import SAMPLE_EXPR from "./sample";
import TextMetrics from "./text_metrics";

export const KALE_THEME = {
    fontSizePx: 16,
    fontFamily: "iA Writer Quattro",
    //TODO: This should be based on the current text size.
    lineSpacing: 16,
    underlineColour: "#6a6a6a",
};

class LayoutNotSupported extends Error {}

//TODO: Refactor, just stuff to make the demo look nice.
const GlobalStyle = createGlobalStyle`
body {
    margin: 60px 40px;
}
h1 {
    margin: 30px 0;
}
`;

// See https://vanseodesign.com/web-design/svg-text-baseline-alignment/ for excellent discussion
// on SVG text aligment properties.
const Code = styled.text`
    font-size: ${KALE_THEME.fontSizePx}px;
    font-family: ${KALE_THEME.fontFamily};
    dominant-baseline: text-before-edge;
`;

interface TextProperties {
    italic?: boolean;
    bold?: boolean;
    colour?: string;
    title?: string;
}

function layoutText(
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
            >
                {title && <title>{title}</title>}
                {text}
            </Code>
        ),
        underlines: null,
        inline: true,
    };
}

class ExprLayoutHelper implements ExprVisitor<ExprLayout> {
    visitList(expr: E.List): ExprLayout {
        if (expr.comment)
            throw new LayoutNotSupported("List comments are not supported");
        let size = Size.zero;
        let nodes: ReactNode[] = [];
        for (const line of expr.list) {
            const layout = line.visit(this);
            const pos = size.bottom_left.dy(
                // Skip first line.
                size.height ? KALE_THEME.lineSpacing : 0,
            );
            if (layout.underlines !== null) {
                nodes.push(
                    place(
                        pos.dy(KALE_THEME.fontSizePx + 5),
                        layoutUnderline(layout.underlines),
                    ),
                );
            }
            nodes.push(place(pos, layout));
            size = size.extend(pos, layout.size);
        }

        const ruler = {
            size: new Size(10, 0),
            nodes: <Line start={vec(3, 5)} end={vec(3, size.height + 5)} />,
        };
        return toExprLayout(stackHorizontal(0, ruler, { nodes, size }));
    }

    visitLiteral(expr: E.Literal): ExprLayout {
        const content =
            expr.type === "str" ? `"${expr.content}"` : expr.content;
        return layoutText(content, { title: expr.comment, colour: "#f59a11" });
    }

    visitVariable(expr: E.Variable): ExprLayout {
        return layoutText(expr.name, {
            title: expr.comment,
            colour: "#248af0",
        });
    }

    visitHole(expr: E.Hole): ExprLayout {
        //TODO: Wrap this in a nice box or something.
        return layoutText(expr.comment ?? "HOLE", { colour: "#ff0000" });
    }

    visitCall(expr: E.Call): ExprLayout {
        //TODO: Add the comment back.
        return new CallLayoutHelper(expr).layout();
    }
}

function underlineTreeHeight(underline: null | Underline): number {
    return underline === null
        ? 0
        : 1 + max(underline.children.map(x => underlineTreeHeight(x[1])));
}

function layoutUnderline(underline: Underline): Layout {
    function layout(ix: number, underline: Underline, pos: Vector): ReactNode {
        // It took a while, but black, crispEdge, 0.5 stroke lines work well. They looks equally
        // well at full and half-pixel multiples; and look good on high-dpi screens.
        return (
            <React.Fragment key={ix}>
                <Line
                    start={pos}
                    end={pos.dx(underline.width)}
                    strokeWidth={0.5}
                    shapeRendering="crispEdges"
                    stroke={KALE_THEME.underlineColour}
                />
                {underline.children.map(([offset, next], ix) =>
                    layout(ix, next, pos.dx(offset).dy(4)),
                )}
            </React.Fragment>
        );
    }
    return {
        nodes: layout(0, underline, Vector.zero),
        size: size(underline.width, 1),
    };
}

export class CallLayoutHelper {
    private readonly args: Readonly<ExprLayout[]> = [];
    private readonly exprLayoutHelper = new ExprLayoutHelper();
    // If false we should render the underlines on the args.
    private readonly inline: boolean;

    constructor(private readonly expr: E.Call) {
        this.args = this.expr.args.map(x => x.visit(this.exprLayoutHelper));

        this.inline = this.args.every(x => x.inline);
        // Staying inline is not easy. Two more tests follow: does the call fit within an arbitrary
        // width and is the underline tree shallow enough.
        if (this.inline) {
            const LINE_BREAK_POINT = 200;
            const lineWidth = this.args
                .map(x => x.size.width)
                .reduce((x, y) => x + y, 0);
            this.inline = lineWidth < LINE_BREAK_POINT;

            if (this.inline) {
                const underlineHeights = this.args.map(x =>
                    underlineTreeHeight(x.underlines),
                );
                const MAX_NESTING_LEVEL = 3;
                this.inline = max(underlineHeights) < MAX_NESTING_LEVEL;
            }
        }
    }

    layout(): ExprLayout {
        const inlineMargin = TextMetrics.global.measure("\xa0").width; // Non-breaking space.
        const fnName = layoutText(this.expr.fn, { bold: !this.inline });
        assert(fnName.inline);
        const nodes: ReactNode[] = [];
        let size = Size.zero;

        if (this.inline) {
            const underlines: [number, Underline][] = [];
            for (const arg of this.args) {
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
                stackHorizontal(inlineMargin, fnName, { nodes, size }),
                underlines,
            );
        }

        const argStack = stackVertical(
            KALE_THEME.lineSpacing,
            ...this.args.map(arg => {
                // Materialise all underlines.
                if (!arg.underlines) return arg;
                const underlines = place(
                    vec(0, KALE_THEME.fontSizePx + 5),
                    layoutUnderline(arg.underlines),
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

class ExprView extends Component<{ expr: Expr }> {
    render() {
        return this.props.expr.visit(new ExprLayoutHelper()).nodes;
    }
}

class Editor extends Component<{ expr: Expr }> {
    render() {
        // As I understand it, viewBox is not a required property.
        return (
            <>
                <GlobalStyle />
                <h1 style={{ fontFamily: KALE_THEME.fontFamily }}>
                    Kale Editor
                </h1>
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    style={{ width: "100%" }}
                    height="500"
                >
                    <ExprView expr={this.props.expr} />
                </svg>
            </>
        );
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    await TextMetrics.loadGlobal(KALE_THEME);
    // new E.Call("print", [new E.Call("hello"), new E.Call("world")])
    ReactDOM.render(
        <Editor expr={SAMPLE_EXPR} />,
        document.getElementById("main"),
    );
});
