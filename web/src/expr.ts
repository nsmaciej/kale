export type ExprId = number;

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
        super("Unvisitable Expr");
    }
}

export class InvalidExpr extends Error {
    constructor(readonly expr: Expr) {
        super("Invalid Expr");
    }
}

export abstract class Expr {
    private static globalId = 1;

    // Two expressions have the same id if they have the same content.
    private _id: ExprId;
    get id(): ExprId {
        return this._id;
    }

    constructor(id = Expr.globalId++) {
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

    validate() {
        this.visit(new ExprValidator());
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

class ExprValidator implements ExprVisitor<void> {
    seenIds = new Set<ExprId>();

    private assert(expr: Expr, check: boolean) {
        if (this.seenIds.has(expr.id) || !check) {
            throw new InvalidExpr(expr);
        }
        this.seenIds.add(expr.id);
    }

    visitHole(expr: Hole) {
        this.assert(expr, true);
    }
    visitLiteral(expr: Literal) {
        //TODO: Check for valid literals.
        this.assert(expr, !!expr.content && !!expr.type);
    }
    visitComment(expr: Comment) {
        this.assert(expr, !!expr.comment);
    }
    visitVariable(expr: Variable) {
        //TODO: Verify reasonable identifer names.
        this.assert(expr, !!expr.name);
    }
    visitList(expr: List) {
        this.assert(
            expr,
            expr.list.length > 0 && !expr.list.some(x => x instanceof List),
        );
        expr.list.forEach(x => x.visit(this));
    }
    visitCall(expr: Call) {
        //TODO: Verify reasonable function names.
        this.assert(expr, !!expr.fn);
        expr.args.forEach(x => x.visit(this));
    }
}
