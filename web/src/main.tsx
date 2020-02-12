import * as ReactDOM from "react-dom";
import React, { Component, ReactNode } from "react";
import styled, { createGlobalStyle } from "styled-components";

import { Expr, ExprVisitor } from "./expr";
import { Size, size, vec, Vector } from "./geometry";
import { ExprLayout, Group, Underline, Layout } from "./layout";
import * as E from "./expr";
import SAMPLE_EXPR from "./sample";
import TextMetrics from "./text_metrics";

export const KALE_THEME = {
    fontSizePx: 16,
    fontFamily: "iA Writer Quattro",
    //TODO: This should be based on the current text size.
    lineSpacing: 16,
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
// on SVG aligment properties.
const Code = styled.text`
    font-size: ${KALE_THEME.fontSizePx}px;
    font-family: ${KALE_THEME.fontFamily};
    dominant-baseline: text-before-edge;
`;

interface TextProperties {
    italic?: boolean;
    colour?: string;
    title?: string;
}

function layoutText(
    text: string,
    { italic, colour, title }: TextProperties = {},
): ExprLayout {
    const size = TextMetrics.global.measure(text);
    return {
        size,
        nodes: (
            <Code fill={colour} fontStyle={italic ? "italic" : undefined}>
                {title && <title>{title}</title>}
                {text}
            </Code>
        ),
        underlines: { width: size.width, children: [] },
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
                    <Group translate={pos.dy(KALE_THEME.fontSizePx + 5)}>
                        {layoutUnderline(layout.underlines).nodes}
                    </Group>,
                );
            }
            nodes.push(<Group translate={pos}>{layout.nodes}</Group>);
            size = size.extend(pos, layout.size);
        }
        return { nodes, size, underlines: null };
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
        const fnName = layoutText(expr.fn);
        if (expr.args.length == 0) {
            return fnName;
        }
        return new CallLayoutHelper(expr).layout();
    }
}

function max(list: number[]): number {
    return list.reduce((a, b) => Math.max(a, b), 0);
}

function underlineTreeHeight(underline: null | Underline): number {
    return underline === null
        ? 0
        : 1 + max(underline.children.map(x => underlineTreeHeight(x[1])));
}

function layoutUnderline(underline: Underline): Layout {
    function layout(underline: Underline, pos: Vector): ReactNode {
        const end = pos.dx(underline.width);
        return (
            <>
                <line
                    x1={pos.x}
                    x2={end.x}
                    y1={pos.y}
                    y2={end.y}
                    strokeWidth={0.4}
                    stroke="#cccccc"
                />
                {underline.children.map(([offset, next]) =>
                    layout(next, pos.dx(offset).dy(5)),
                )}
            </>
        );
    }
    return {
        nodes: layout(underline, Vector.zero),
        size: size(underline.width, 1),
    };
}

export class CallLayoutHelper {
    private lines: ExprLayout[][] = [];
    private exprLayoutHelper = new ExprLayoutHelper();
    // If true we should render the underlines on the args.
    private isBlock: boolean;

    constructor(private readonly expr: E.Call) {
        const containsBlock = this.breakIntoLines();
        // The call is a block if it contains another block or has multiple lines or is very nested.
        // Making a deeply nested call a block means that the underlines will stop piling up.
        this.isBlock =
            containsBlock ||
            this.lines.length > 1 ||
            max(this.lines[0].map(x => underlineTreeHeight(x.underlines))) > 2;
    }

    private breakIntoLines(): boolean {
        if (this.expr.args.length === 0) {
            throw new LayoutNotSupported("Call layout helper cannot be used");
        }
        const LINE_BREAK_POINT = 200;

        // Break the arguments up into lines.
        let currentLine: ExprLayout[] = [];
        let lineWidth = 0;
        const newLine = () => {
            if (currentLine.length > 0) {
                this.lines.push(currentLine);
                currentLine = [];
                lineWidth = 0;
            }
        };
        let containsBlock = false;
        for (const arg of this.expr.args) {
            const layout = arg.visit(this.exprLayoutHelper);
            if (layout.underlines === null) {
                newLine();
                containsBlock = true;
                this.lines.push([layout]);
            } else {
                if (lineWidth > LINE_BREAK_POINT) {
                    newLine();
                }
                currentLine.push(layout);
                lineWidth += layout.size.width;
            }
        }
        newLine();
        return containsBlock;
    }

    layout(): ExprLayout {
        const driftMargin = TextMetrics.global.measure("\xa0").width; // Non-breaking space.

        const nodes: ReactNode[] = [];
        let size = Size.zero;
        const underlineChildren: [number, Underline][] = [];
        const fnName = layoutText(this.expr.fn);
        for (const line of this.lines) {
            // Don't add the line margin to the first line.
            const lineY =
                size.height + (size.height ? KALE_THEME.lineSpacing : 0);
            let lineX = 0;
            for (const arg of line) {
                const pos = vec(lineX, lineY);
                size = size.extend(pos, arg.size);
                nodes.push(<Group translate={pos}>{arg.nodes}</Group>);
                if (arg.underlines !== null) {
                    if (this.isBlock) {
                        nodes.push(
                            <Group
                                translate={pos.dy(KALE_THEME.fontSizePx + 5)}
                            >
                                {layoutUnderline(arg.underlines).nodes}
                            </Group>,
                        );
                    } else {
                        underlineChildren.push([
                            lineX + driftMargin + fnName.size.width,
                            arg.underlines,
                        ]);
                    }
                }
                lineX += arg.size.width + driftMargin;
            }
        }

        const totalSize = new Size(
            size.width + driftMargin + fnName.size.width,
            Math.max(size.height, fnName.size.height),
        );

        let underlines: Underline | null = null;
        if (!this.isBlock) {
            underlines = {
                width: totalSize.width,
                children: underlineChildren,
            };
        }

        return {
            underlines,
            size: totalSize,
            nodes: (
                <>
                    {fnName.nodes}
                    <Group translate={fnName.size.top_right.dx(driftMargin)}>
                        {nodes}
                    </Group>
                </>
            ),
        };
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
