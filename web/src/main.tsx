import React, { Component, ReactNode } from "react"
import * as ReactDOM from "react-dom"
import styled from "styled-components"

import { Expr, ExprVisitor } from "./expr"
import * as E from "./expr"
import { size, vec, Size, Vector } from "./geometry"

const FONT_SIZE_PX = 16
const FONT_FAMILY = "SF Mono, monospace"

class TextMeasurement {
    private static globalInstance: TextMeasurement;

    textMetricsCache: { [content: string]: number } = {}
    measurementTextElement: SVGTextElement

    static get global(): TextMeasurement {
        // This needs to be lazy because we use the DOM.
        if (TextMeasurement.globalInstance) return TextMeasurement.globalInstance;
        return TextMeasurement.globalInstance = new TextMeasurement();
    }

    constructor() {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
        // It has to be visibility instead of display none. Not really sure why.
        svg.setAttribute("width", "1")
        svg.setAttribute("height", "1")
        svg.setAttribute("viewBox", "0 0 1 1")
        svg.style.visibility = "hidden"
        svg.style.position = "absolute"

        const text = document.createElementNS("http://www.w3.org/2000/svg", "text")
        text.style.fontFamily = FONT_FAMILY
        text.style.fontSize = `${FONT_SIZE_PX}px`
        svg.appendChild(text)
        this.measurementTextElement = text
        document.body.appendChild(svg)
    }

    measure(text: string): Size {
        if (text in this.textMetricsCache) {
            return size(this.textMetricsCache[text], FONT_SIZE_PX)
        }
        this.measurementTextElement.textContent = text
        const width = this.measurementTextElement.getComputedTextLength()
        this.textMetricsCache[text] = width
        return size(width, FONT_SIZE_PX)
    }
}


// See https://vanseodesign.com/web-design/svg-text-baseline-alignment/ for excellent discussion
// on SVG aligment properties.
const Code = styled.text`
    font-size: ${FONT_SIZE_PX}px;
    font-family: ${FONT_FAMILY};
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
        size: TextMeasurement.global.measure(text),
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

    visitHole(expr: E.Hole): Layout {
        return {
            size: size(FONT_SIZE_PX, FONT_SIZE_PX),
            nodes: <rect width={FONT_SIZE_PX} height={FONT_SIZE_PX} rx="3" fill="#f56342" />,
            containsList: expr.containedList,
        }
    }

    visitCall(call: E.Call): Layout {
        // Contains-list arguments layout downwards, while consecutive non-contains-list arguments
        // clump together.
        const DRIFT_MARGIN = 5;
        const LINE_MARGIN = 12;
        let size = TextMeasurement.global.measure(call.fn)
        const leftMargin = size.width + DRIFT_MARGIN;
        let drift = vec(leftMargin, 0)
        let containsList = false

        const nodes = call.args.map(x => {
            const arg = x.visit(this)
            containsList = containsList || arg.containsList

            // A contains-list argument ignores the drift and places itself at the bottom, adding
            // some margin for the ruler.
            const pos = arg.containsList ? vec(leftMargin + 12, size.height + LINE_MARGIN) : drift
            size = size.extend(pos, arg.size)
            // A contains-list argument resets the drift.
            drift = arg.containsList
                ? vec(leftMargin, size.height + LINE_MARGIN)
                : drift.dx(arg.size.width + DRIFT_MARGIN)

            const ruler = arg.containsList
                ? <rect width="2" height={arg.size.height} x={pos.x - 10} y={pos.y} fill="#ccc" />
                : null
            return <>
                {ruler}
                <Group translate={pos} key={x.id}>{arg.nodes}</Group>
            </>
        })

        return { nodes: [<Code>{call.fn}</Code>].concat(nodes), size, containsList }
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
            <h1>Editor</h1>
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
        new E.List([
            new E.Call("print", [new E.Hole()]),
            new E.Call("*", [
                new E.Variable("n"),
                new E.Call("fact", [
                    new E.Call("-", [new E.Variable("n"), new E.Literal("1", "int")])
                ])
            ])
        ]),
        new E.Call("sample-call"),
        new E.Call("sample-call-2")
    ])
])

ReactDOM.render(
    <Editor expr={sampleExpr} />,
    document.getElementById('main')
);