import React, { Component, ReactNode } from "react"
import * as ReactDOM from "react-dom"
import styled from "styled-components"

import { Expr, ExprVisitor } from "./expr"
import * as E from "./expr"
import { size, Size, Vector } from "./geometry"

const FONT_SIZE_PX = 16
const FONT_FAMILY = "SF Mono, monospace"

class TextMeasurement {
    private static globalInstance: TextMeasurement;

    textMetricsCache: { [content: string]: number } = {}
    measurementTextElement: SVGTextElement

    static get global(): TextMeasurement {
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

type Layout = [Size, ReactNode]

function layoutCode(text: string, colour?: string): Layout {
    return [
        TextMeasurement.global.measure(text),
        <Code fill={colour}>{text}</Code>
    ]
}

class ExprLayout implements ExprVisitor<Layout> {
    visitList(expr: E.List): Layout {
        let finalSize = Size.zero
        const nodes = expr.list.map(x => {
            const [lineSize, line] = x.visit(this)
            const bottomLeft = finalSize.bottom_left
            finalSize = finalSize.extend(bottomLeft, lineSize).pad_height(5)
            return <Group translate={bottomLeft} key={x.id}>{line}</Group>
        })
        return [finalSize, nodes]
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
        return [
            size(FONT_SIZE_PX, FONT_SIZE_PX),
            <rect width={FONT_SIZE_PX} height={FONT_SIZE_PX} rx="3" fill="#f56342" />
        ]
    }

    visitCall(call: E.Call): Layout {
        let finalSize = TextMeasurement.global.measure(call.fn).pad_width(5)
        const nodes = call.args.map(x => {
            const [argSize, arg] = x.visit(this)
            const topRight = finalSize.top_right
            finalSize = finalSize.extend(topRight, argSize).pad_width(5)
            return <Group translate={topRight} key={x.id}>{arg}</Group>
        })
        return [finalSize, [<Code>{call.fn}</Code>].concat(nodes)]
    }
}

class ExprView extends Component<{ expr: Expr }> {
    render() {
        const [size, nodes] = this.props.expr.visit(new ExprLayout());
        return nodes;
    }
}

class Editor extends Component<{ expr: Expr }> {
    render() {
        return <>
            <h1>Editor</h1>
            <svg xmlns="http://www.w3.org/2000/svg">
                <ExprView expr={this.props.expr} />
            </svg>
        </>
    }
}

const expr = new E.List([
    new E.Comment("Find a factorial of n"),
    new E.Call("if", [
        new E.Call("=", [new E.Variable("n"), new E.Literal("0", "int")]),
        new E.Literal("1", "int"),
        new E.List([
            new E.Call("print", [new E.Hole()]),
            new E.Call("*", [
                new E.Variable("n"),
                new E.Call("fact", [new E.Call("-", [new E.Variable("n"), new E.Literal("1", "int")])])
            ])
        ])
    ])
])

ReactDOM.render(
    <Editor expr={expr} />,
    document.getElementById('main')
);