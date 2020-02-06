let GLOBAL_ID = 1

export interface ExprVisitor<R = any> {
    visitList(expr: List): R
    visitLiteral(expr: Literal): R
    visitVariable(expr: Variable): R
    visitComment(expr: Comment): R
    visitHole(expr: Hole): R
    visitCall(call: Call): R
}

export class UnvisitableExpr extends Error {
    constructor(readonly expr: Expr) { super("Unvisitable expr") }
}

export abstract class Expr {
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

export class List extends Expr {
    constructor(readonly list: Expr[]) { super() }
}
export class Variable extends Expr {
    constructor(readonly name: string) { super() }
}
export class Literal extends Expr {
    constructor(readonly content: string, readonly type: string) { super() }
}
export class Comment extends Expr {
    constructor(readonly comment: string) { super() }
}
export class Call extends Expr {
    constructor(readonly fn: string, readonly args: Expr[]) { super() }
}
export class Hole extends Expr { }
