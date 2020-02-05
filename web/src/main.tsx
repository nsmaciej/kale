import React, { Component, ReactNode } from "react"
import * as ReactDOM from "react-dom"

let GLOBAL_ID = 1

interface ExprVisitor<R> {
    visitList(expr: List): R
    visitLiteral(expr: Literal): R
    visitVariable(expr: Variable): R
    visitComment(expr: Comment): R
    visitHole(expr: Hole): R
    visitCall(call: Hole): R
}

class UnvisitableExpr extends Error {
    constructor(readonly expr: Expr) { super("Unvisitable expr") }
}

abstract class Expr {
    readonly id = GLOBAL_ID++
    constructor() { }
    visit<R>(visitor: ExprVisitor<R>): R {
        if (this instanceof List) return visitor.visitList(this);
        else if (this instanceof Variable) return visitor.visitVariable(this);
        else if (this instanceof Literal) return visitor.visitLiteral(this);
        else if (this instanceof Comment) return visitor.visitComment(this);
        else if (this instanceof Hole) return visitor.visitHole(this);
        else if (this instanceof Call) return visitor.visitCall(this);
        throw new UnvisitableExpr(this);
    }
}

class List extends Expr {
    constructor(readonly list: Expr[]) { super() }
}
class Variable extends Expr {
    constructor(readonly name: string) { super() }
}
class Literal extends Expr {
    constructor(readonly content: string, readonly type: string) { super() }
}
class Comment extends Expr {
    constructor(readonly comment: string) { super() }
}
class Call extends Expr {
    constructor(readonly fn: string, readonly args: Expr[]) { super() }
}
class Hole extends Expr { }

class ExprView extends Component<{ expr: Expr }> implements ExprVisitor<ReactNode> {
    visitList(expr: List) {
        return expr.list.map((x) => <div><ExprView expr={x} /></div>)
    }
    visitVariable(expr: Variable) { return expr.name }
    visitLiteral(expr: Literal) { return `<${expr.type}>"${expr.content}"` }
    visitComment(expr: Comment) { return `// ${expr.comment}` }
    visitCall(expr: Call) { return [expr.fn, ...expr.args.map((x) => <ExprView expr={x} />)] }
    visitHole(_expr: Hole) { return "HOLE" }
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

const expr = new List([
    new Comment("Find a factorial of n"),
    new Call("if", [
        new Call("=", [new Variable("n"), new Literal("0", "int")]),
        new Literal("1", "int"),
        new List([
            new Call("print", [new Variable("n")]),
            new Call("*", [
                new Variable("n"),
                new Call("fact", [new Call("-", [new Variable("n"), new Literal("1", "int")])])
            ])
        ])
    ])
])

ReactDOM.render(
    <Editor expr={expr} />,
    document.getElementById('main')
);