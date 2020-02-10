import React, { Component, ReactNode } from "react";
import * as ReactDOM from "react-dom";
import styled, { createGlobalStyle } from "styled-components";

import { Expr, ExprVisitor, exprData } from "./expr";
import * as E from "./expr";
import { size, vec, Size, Vector } from "./geometry";
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
    font-weight: ${(props: { bold?: boolean }) =>
        props.bold ? "bold" : "normal"};
`;

const Comment = styled(Code)`
    font-style: italic;
`;

function Group({
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

interface Layout {
    size: Size;
    nodes: ReactNode;
    containsList: boolean;
}

function layoutCode(text: string, colour?: string): Layout {
    return {
        size: TextMetrics.global.measure(text),
        nodes: <Code fill={colour}>{text}</Code>,
        containsList: false,
    };
}

function layoutComment(comment: string): Layout {
    //TODO: In the future links to websites and functions inside comments should be clickable.
    return {
        size: TextMetrics.global.measure(comment),
        nodes: <Comment fill="#16a831">{comment}</Comment>,
        containsList: false,
    };
}

class ExprLayout implements ExprVisitor<Layout> {
    visitList(expr: E.List): Layout {
        if (expr.comment)
            throw new LayoutNotSupported("List comments are not supported");
        let size = Size.zero;
        const nodes = expr.list.map(x => {
            const line = x.visit(this);
            const bottomLeft = size.bottom_left;
            size = size
                .extend(bottomLeft, line.size)
                .pad_height(KALE_THEME.fontSizePx / 2);
            return (
                <Group translate={bottomLeft} key={x.id}>
                    {line.nodes}
                </Group>
            );
        });
        // A list is always contains-list.
        return { containsList: true, size, nodes };
    }

    visitLiteral(expr: E.Literal): Layout {
        if (expr.comment)
            throw new LayoutNotSupported("Literal comments are not supported");
        const content =
            expr.type === "str" ? `"${expr.content}"` : expr.content;
        return layoutCode(content, "#f59a11");
    }

    visitVariable(expr: E.Variable): Layout {
        if (expr.comment)
            throw new LayoutNotSupported("Variable comments are not supported");
        return layoutCode(expr.name, "#248af0");
    }

    visitHole(expr: E.Hole): Layout {
        if (expr.comment)
            throw new LayoutNotSupported("Hole comments are not supported");
        const dim = KALE_THEME.fontSizePx;
        //TODO: A hole might have to remmber what it contained before it became a hole.
        return {
            size: size(dim, dim),
            nodes: <rect width={dim} height={dim} rx="3" fill="#f56342" />,
            containsList: false,
        };
    }

    visitCall(expr: E.Call): Layout {
        //TODO: Comment might be placed inline for short enough non-containing-list calls.
        // Contains-list arguments layout downwards, while consecutive non-contains-list arguments
        // clump together. Comments are placed above the function name.
        let comment = expr.comment ? layoutComment(expr.comment) : null;
        const exprSize = TextMetrics.global.measure(expr.fn);
        // For the purpose of caluclating size, stacking order doesn't matter. (e.g. comment below
        // the function name has the same size as the opposite)
        let size = exprSize.extend(
            exprSize.bottom_left,
            comment?.size ?? Size.zero,
        );
        let containsList = !!expr.comment;

        const DRIFT_MARGIN = TextMetrics.global.measure("\xa0").width; // Non-breaking space.
        const LINE_MARGIN = KALE_THEME.fontSizePx * 0.5;
        // Note exprSize width not size width (we do not include the comment size).
        const leftMargin = exprSize.width + DRIFT_MARGIN;

        // How much to shift the next argument left, or if it's a contains-list, how far down.
        let driftX = leftMargin;
        let currentLineY = comment?.size.pad_height(LINE_MARGIN).height ?? 0;
        let nextLineY = currentLineY;

        const nodes = expr.args.map(x => {
            const arg = x.visit(this);
            containsList = containsList || arg.containsList;

            const pos = arg.containsList
                ? vec(leftMargin + 12, nextLineY)
                : vec(driftX, currentLineY);
            size = size.extend(pos, arg.size);
            if (arg.containsList) {
                nextLineY = currentLineY = size.height + LINE_MARGIN;
                driftX = leftMargin;
            } else {
                nextLineY = size.height + LINE_MARGIN;
                driftX += arg.size.width + DRIFT_MARGIN;
            }

            const ry = pos.y + 6;
            const rx = pos.x - 10;
            return (
                <>
                    {arg.containsList && (
                        <line
                            y2={ry + arg.size.height - 6}
                            x1={rx}
                            x2={rx}
                            y1={ry}
                            stroke="#cccccc"
                            strokeDasharray="1"
                        />
                    )}
                    <Group translate={pos} key={x.id}>
                        {arg.nodes}
                    </Group>
                </>
            );
        });

        //TODO: Render the nesting-underlines.
        return {
            nodes: [
                comment?.nodes,
                <Group
                    translate={
                        comment?.size.pad_height(LINE_MARGIN).bottom_left
                    }
                >
                    <Code bold={containsList}>{expr.fn}</Code>
                </Group>,
                ...nodes,
            ],
            size,
            containsList,
        };
    }
}

class ExprView extends Component<{ expr: Expr }> {
    render() {
        return this.props.expr.visit(new ExprLayout()).nodes;
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

const sampleExpr = new E.Call(
    "if",
    [
        new E.Call("=", [new E.Variable("n"), new E.Literal("0", "int")]),
        new E.List([
            new E.Call(
                "print",
                [
                    new E.Literal("Reached the base case", "str"),
                    new E.Literal(
                        "Some other long string to test line breaking",
                        "str",
                    ),
                ],
                exprData("This is a call comment inside a list"),
            ),
            new E.Literal("1", "int"),
        ]),
        new E.Call("id", [
            new E.List([
                new E.Call("print", [new E.Hole()]),
                new E.Call("*", [
                    new E.Variable("n"),
                    new E.Call("fact", [
                        new E.Call("-", [
                            new E.Variable("n"),
                            new E.Literal("1", "int"),
                        ]),
                    ]),
                ]),
            ]),
        ]),
        new E.Call("sample-call"),
        new E.Call("sample-call-2"),
    ],
    exprData("Find a factorial of n. (https://example.com)"),
);
sampleExpr.validate();

document.addEventListener("DOMContentLoaded", async () => {
    await TextMetrics.loadGlobal(KALE_THEME);
    ReactDOM.render(
        <Editor expr={sampleExpr} />,
        document.getElementById("main"),
    );
});
