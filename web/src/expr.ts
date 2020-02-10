let GLOBAL_ID = 1;

export interface ExprVisitor<R = any> {
    visitList(expr: List): R;
    visitLiteral(expr: Literal): R;
    visitVariable(expr: Variable): R;
    visitComment(expr: Comment): R;
    visitHole(expr: Hole): R;
    visitCall(expr: Call): R;
}

export class UnvisitableExpr extends Error {
    constructor(readonly expr: Expr) {
        super("Unvisitable expr");
    }
}

export abstract class Expr {
    // Two expressions have the same id if they have the same content.
    private _id: number;
    get id() {
        return this._id;
    }

    constructor(id = GLOBAL_ID++) {
        this._id = id;
    }

    visit<R>(visitor: ExprVisitor<R>): R {
        if (this instanceof List) return visitor.visitList(this);
        else if (this instanceof Variable) return visitor.visitVariable(this);
        else if (this instanceof Literal) return visitor.visitLiteral(this);
        else if (this instanceof Comment) return visitor.visitComment(this);
        else if (this instanceof Hole) return visitor.visitHole(this);
        else if (this instanceof Call) return visitor.visitCall(this);
        throw new UnvisitableExpr(this);
    }

    isValid() {
        return this.visit(new ExprValidator());
    }
}

export class List extends Expr {
    constructor(readonly list: Expr[]) {
        super();
    }
}
export class Variable extends Expr {
    constructor(readonly name: string) {
        super();
    }
}
export class Literal extends Expr {
    constructor(readonly content: string, readonly type: string) {
        super();
    }
}
export class Comment extends Expr {
    constructor(readonly comment: string) {
        super();
    }
}
export class Call extends Expr {
    constructor(readonly fn: string, readonly args: Expr[] = []) {
        super();
    }
}
export class Hole extends Expr {}

class ExprValidator implements ExprVisitor<boolean> {
    visitHole(_expr: Hole) {
        return true;
    }
    visitLiteral(expr: Literal) {
        //TODO: Check for valid literals.
        return !!expr.content && !!expr.type;
    }
    visitComment(expr: Comment) {
        return !!expr.comment;
    }
    visitVariable(_expr: Variable) {
        //TODO: Verify reasonable identifer names.
        return true;
    }
    visitList(expr: List): boolean {
        return (
            expr.list.length > 0 &&
            !expr.list.some(x => x instanceof List) &&
            expr.list.every(x => x.visit(this))
        );
    }
    visitCall(expr: Call): boolean {
        //TODO: Verify reasonable function names.
        return !!expr.fn && expr.args.every(x => x.visit(this));
    }
}
