import * as ReactDOM from "react-dom";
import React, { Component } from "react";
import styled, { createGlobalStyle } from "styled-components";

import { Expr, ExprVisitor } from "./expr";
import { size } from "./geometry";
import { Stack, Layout, containInBox } from "./layout";
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
) {
    return {
        size: TextMetrics.global.measure(text),
        nodes: (
            <Code fill={colour} fontStyle={italic ? "italic" : undefined}>
                {title && <title>{title}</title>}
                {text}
            </Code>
        ),
        containsList: false,
    };
}

class ExprLayout implements ExprVisitor<Layout> {
    visitList(expr: E.List): Layout {
        if (expr.comment)
            throw new LayoutNotSupported("List comments are not supported");
        return Stack.fromList(
            expr.list.flatMap(x => [x.visit(this), Stack.CLEAR]),
        );
    }

    visitLiteral(expr: E.Literal): Layout {
        const content =
            expr.type === "str" ? `"${expr.content}"` : expr.content;
        return layoutText(content, { title: expr.comment, colour: "#f59a11" });
    }

    visitVariable(expr: E.Variable): Layout {
        return layoutText(expr.name, {
            title: expr.comment,
            colour: "#248af0",
        });
    }

    visitHole(expr: E.Hole): Layout {
        return containInBox(
            layoutText(expr.comment ?? " ", { colour: "#ffffff" }),
        );
    }

    visitCall(expr: E.Call): Layout {
        // The y1 and y2 are fudged to make this look good with the inaccurate metrics.
        const line = (height: number) => (
            <line
                x1={5}
                x2={5}
                y1={10}
                y2={height}
                stroke="#cccccc"
                strokeDasharray="1"
            />
        );
        //TODO: Comment might be placed inline for short enough non-containing-list calls.
        const argStack = Stack.fromList(
            expr.args.flatMap(x => {
                const arg: Layout = x.visit(this);
                if (arg.containsList) {
                    const lineLayout = {
                        nodes: line(arg.size.height),
                        containsList: true,
                        size: size(5, arg.size.height),
                    };
                    return [Stack.CLEAR, lineLayout, arg, Stack.CLEAR];
                }
                return arg;
            }),
        );

        const callStack =
            expr.args.length > 0
                ? Stack.fromList([layoutText(expr.fn), argStack])
                : layoutText(expr.fn);
        if (expr.comment) {
            return Stack.fromList([
                layoutText(expr.comment, { colour: "#16a831", italic: true }),
                Stack.CLEAR,
                callStack,
            ]);
        }
        return callStack;
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

document.addEventListener("DOMContentLoaded", async () => {
    await TextMetrics.loadGlobal(KALE_THEME);
    ReactDOM.render(
        <Editor expr={SAMPLE_EXPR} />,
        document.getElementById("main"),
    );
});
