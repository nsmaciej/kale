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

class Stack {
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
        this.lineMargin = KALE_THEME.fontSizePx * 0.5;
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
        this.place(vec(0, this.nextLineY), layout);
        this.containsList = true;
        this.driftX = 0;
        this.nextLineY = this.size.height + this.lineMargin;
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

class ExprLayout implements ExprVisitor<Layout> {
    visitList(expr: E.List): Layout {
        if (expr.comment)
            throw new LayoutNotSupported("List comments are not supported");
        const listStack = new Stack();
        for (const x of expr.list) {
            listStack.stackDown(x.visit(this));
        }
        return listStack.layout();
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
        const argStack = new Stack();
        for (const x of expr.args) {
            const arg = x.visit(this);
            if (arg.containsList) {
                argStack.stackDown(arg);
            } else {
                argStack.stackRight(arg);
            }
        }

        let callStack = new Stack();
        callStack.stackRight(layoutCode(expr.fn));
        callStack.stackRight(argStack.layout());

        if (expr.comment) {
            const commentStack = new Stack();
            commentStack.stackDown(layoutComment(expr.comment));
            commentStack.stackDown(callStack.layout());
            return commentStack.layout();
        }
        return callStack.layout();
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
