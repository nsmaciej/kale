import * as ReactDOM from "react-dom";
import React, { Component, ReactNode } from "react";
import styled, { createGlobalStyle } from "styled-components";

import { Expr, ExprVisitor } from "./expr";
import { Size, size, vec } from "./geometry";
import { ExprLayout, Group, Underline } from "./layout";
import * as E from "./expr";
import SAMPLE_EXPR from "./sample";
import TextMetrics from "./text_metrics";

export const KALE_THEME = {
    fontSizePx: 16,
    fontFamily: "iA Writer Quattro",
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
    return {
        size: TextMetrics.global.measure(text),
        nodes: (
            <Code fill={colour} fontStyle={italic ? "italic" : undefined}>
                {title && <title>{title}</title>}
                {text}
            </Code>
        ),
        underlines: null,
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
            if (layout.underlines !== null) {
                //TODO: Layout the underlines.
            }
            nodes.push(
                <Group translate={size.bottom_left}>{layout.nodes}</Group>,
            );
            size = size.extend(size.bottom_left, layout.size);
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

        const argLayout = new CallLayoutHelper(expr.args).layout();
        return {
            underlines: argLayout.underlines,
            size: size(
                argLayout.size.width + fnName.size.width,
                Math.max(argLayout.size.height, fnName.size.height),
            ),
            nodes: (
                <>
                    {fnName.nodes}
                    <Group translate={fnName.size.top_right}>
                        {argLayout.nodes}
                    </Group>
                </>
            ),
        };
    }
}

function max(list: number[]): number {
    return list.reduce((a, b) => Math.max(a, b));
}

function underlineTreeHeight(underline: null | Underline): number {
    return underline === null
        ? 0
        : 1 + max(underline.childeren.map(x => underlineTreeHeight(x)));
}

export class CallLayoutHelper {
    private lines: ExprLayout[][] = [];
    private exprLayoutHelper = new ExprLayoutHelper();
    // If true we should render the underlines on the args.
    private isBlock: boolean;

    constructor(callArgs: Readonly<Expr[]>) {
        const containsBlock = this.breakIntoLines(callArgs);
        // The call is a block if it contains another block or has multiple lines or is very nested.
        // Making a deeply nested call a block means that the underlines will stop piling up.
        this.isBlock =
            containsBlock ||
            this.lines.length > 1 ||
            max(this.lines[0].map(x => underlineTreeHeight(x.underlines))) > 2;
    }

    private breakIntoLines(callArgs: Readonly<Expr[]>): boolean {
        if (callArgs.length === 0) {
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
        for (const arg of callArgs) {
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
        //TODO: This should be based on the current text size. Leave space for underlines.
        const lineMargin = 8;

        const nodes: ReactNode[] = [];
        let size = Size.zero;
        for (const line of this.lines) {
            // Don't add the line margin to the first line.
            const lineY = size.height + (size.height ? lineMargin : 0);
            let lineX = 0;
            for (const arg of line) {
                const pos = vec(lineX, lineY);
                size = size.extend(pos, arg.size);
                nodes.push(<Group translate={pos}>{arg.nodes}</Group>);
                if (this.isBlock && arg.underlines !== null) {
                    //TODO: Draw the underlines or line to the left.
                }
                lineX += arg.size.width + driftMargin;
            }
        }

        //TODO: Stack the underlines if this isn't a block.
        return { size, nodes, underlines: null };
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
    ReactDOM.render(
        <Editor expr={SAMPLE_EXPR} />,
        document.getElementById("main"),
    );
});
