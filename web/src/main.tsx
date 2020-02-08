import React, { Component, ReactNode } from "react"
import * as ReactDOM from "react-dom"
import styled from "styled-components"

import { Expr, ExprVisitor } from "./expr"
import * as E from "./expr"
import { size, vec, Size, Vector } from "./geometry"
import TextMetrics from "./text_metrics"

export const KALE_THEME = {
    fontSizePx: 16,
    fontFamily: "iA Writer Quattro",
}


// See https://vanseodesign.com/web-design/svg-text-baseline-alignment/ for excellent discussion
// on SVG aligment properties.
const Code = styled.text`
    font-size: ${KALE_THEME.fontSizePx}px;
    font-family: ${KALE_THEME.fontFamily};
    dominant-baseline: text-before-edge;
`

function Group({ children, translate }: { children: ReactNode, translate: Vector }) {
    return <g transform={`translate(${translate.x} ${translate.y})`}>
        {children}
    </g >
}

interface Layout {
    size: Size,
    nodes: ReactNode,
    containsList: boolean,
}

function layoutCode(text: string, colour?: string): Layout {
    return {
        size: TextMetrics.global.measure(text),
        nodes: <Code fill={colour}>{text}</Code>,
        containsList: false,
    }
}

class ExprLayout implements ExprVisitor<Layout> {
    visitList(expr: E.List): Layout {
        let size = Size.zero
        const nodes = expr.list.map(x => {
            const line = x.visit(this)
            const bottomLeft = size.bottom_left
            size = size.extend(bottomLeft, line.size).pad_height(5)
            return <Group translate={bottomLeft} key={x.id}>{line.nodes}</Group>
        })
        // A list is always contains-list.
        return { containsList: true, size, nodes }
    }

    visitLiteral(expr: E.Literal): Layout {
        return layoutCode(expr.content)
    }
    visitVariable(expr: E.Variable): Layout {
        return layoutCode(expr.name)
    }
    visitComment(expr: E.Comment): Layout {
        return layoutCode(expr.comment, "#16a831")
    }

    visitHole(_expr: E.Hole): Layout {
        const dim = KALE_THEME.fontSizePx;
        //TODO: A hole might have to remmber what it contained before it became a hole.
        return {
            size: size(dim, dim),
            nodes: <rect width={dim} height={dim} rx="3" fill="#f56342" />,
            containsList: true,
        }
    }

    visitCall(expr: E.Call): Layout {
        // Contains-list arguments layout downwards, while consecutive non-contains-list arguments
        // clump together.

        //TODO: This should be determined by the size of the space or something.
        const DRIFT_MARGIN = 8
        const LINE_MARGIN = KALE_THEME.fontSizePx
        let size = TextMetrics.global.measure(expr.fn)
        const leftMargin = size.width + DRIFT_MARGIN;
        let drift = vec(leftMargin, 0)
        let containsList = false

        const nodes = expr.args.map(x => {
            const arg = x.visit(this)
            containsList = containsList || arg.containsList

            // A contains-list argument ignores the drift and places itself at the bottom, adding
            // some margin for the ruler.
            //BUG: Ignoring the drift like this means single argument contains-list functions look
            // weird.
            const pos = arg.containsList ? vec(leftMargin + 12, size.height + LINE_MARGIN) : drift
            size = size.extend(pos, arg.size)
            // A contains-list argument resets the drift.
            drift = arg.containsList
                ? vec(leftMargin, size.height + LINE_MARGIN)
                : drift.dx(arg.size.width + DRIFT_MARGIN)

            const ruler = arg.containsList
                ? <rect width="1" height={arg.size.height} x={pos.x - 10} y={pos.y} fill="#ccc" />
                : null
            return <>
                {ruler}
                <Group translate={pos} key={x.id}>{arg.nodes}</Group>
            </>
        })

        return { nodes: [<Code>{expr.fn}</Code>].concat(nodes), size, containsList }
    }
}

class ExprView extends Component<{ expr: Expr }> {
    render() {
        return this.props.expr.visit(new ExprLayout()).nodes
    }
}

class Editor extends Component<{ expr: Expr }> {
    render() {
        // As I understand it, viewBox is not a required property.
        return <>
            <h1 style={{ fontFamily: KALE_THEME.fontFamily }}>Kale Editor</h1>
            <svg xmlns="http://www.w3.org/2000/svg" style={{ width: "100%" }} height="500">
                <ExprView expr={this.props.expr} />
            </svg>
        </>
    }
}

const sampleExpr = new E.List([
    new E.Comment("Find a factorial of n"),
    new E.Call("if", [
        new E.Call("=", [new E.Variable("n"), new E.Literal("0", "int")]),
        new E.List([
            new E.Call("print", [new E.Literal("Reached the base case", "str")]),
            new E.Literal("1", "int"),
        ]),
        new E.Call("id", [
            new E.List([
                new E.Call("print", [new E.Hole()]),
                new E.Call("*", [
                    new E.Variable("n"),
                    new E.Call("fact", [
                        new E.Call("-", [new E.Variable("n"), new E.Literal("1", "int")]),
                    ])
                ])
            ]),
        ]),
        new E.Call("sample-call"),
        new E.Call("sample-call-2")
    ])
])
console.assert(sampleExpr.isValid())

document.addEventListener("DOMContentLoaded", async () => {
    await TextMetrics.loadGlobal(KALE_THEME)
    ReactDOM.render(
        <Editor expr={sampleExpr} />,
        document.getElementById('main')
    )
})