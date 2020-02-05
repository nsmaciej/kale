import React, { Component, ReactNode } from "react"
import * as ReactDOM from "react-dom"

import { Expr, ExprVisitor } from "./expr"
import * as E from "./expr"

class ExprView extends Component<{ expr: Expr }> implements ExprVisitor<ReactNode> {
    visitList(expr: E.List) {
        return expr.list.map((x) => <div><ExprView expr={x} /></div>)
    }
    visitVariable(expr: E.Variable) { return expr.name }
    visitLiteral(expr: E.Literal) { return `<${expr.type}>"${expr.content}"` }
    visitComment(expr: E.Comment) { return `// ${expr.comment}` }
    visitCall(expr: E.Call) { return [expr.fn, ...expr.args.map((x) => <ExprView expr={x} />)] }
    visitHole(_expr: E.Hole) { return "HOLE" }
    render() {
        return this.props.expr.visit(this as ExprVisitor<ReactNode>);
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
            new E.Call("print", [new E.Variable("n")]),
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