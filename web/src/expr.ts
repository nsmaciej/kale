export type ExprId = number;

export interface ExprData {
    id: ExprId;
    comment?: string;
}

// Construct simple ExprData for sample Exprs.
export function exprData(comment?: string): ExprData {
    return { id: exprData.serialExprId++, comment };
}
exprData.serialExprId = 1;

export interface ExprVisitor<R = any> {
    visitList(expr: List): R;
    visitLiteral(expr: Literal): R;
    visitVariable(expr: Variable): R;
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
    // Two expressions have the same id if they have the same content.
    readonly id: ExprId;
    readonly comment?: string;

    constructor(data: ExprData) {
        this.id = data.id;
        this.comment = data.comment;
    }

    visit<R>(visitor: ExprVisitor<R>): R {
        if (this instanceof List) return visitor.visitList(this);
        else if (this instanceof Variable) return visitor.visitVariable(this);
        else if (this instanceof Literal) return visitor.visitLiteral(this);
        else if (this instanceof Hole) return visitor.visitHole(this);
        else if (this instanceof Call) return visitor.visitCall(this);
        throw new UnvisitableExpr(this);
    }

    validate() {
        this.visit(new ExprValidator());
    }
}

export class List extends Expr {
    constructor(readonly list: Readonly<Expr[]>, data = exprData()) {
        super(data);
    }
}

export class Variable extends Expr {
    constructor(readonly name: string, data = exprData()) {
        super(data);
    }
}

export class Literal extends Expr {
    constructor(
        readonly content: string,
        readonly type: string,
        data = exprData(),
    ) {
        super(data);
    }
}

export class Call extends Expr {
    constructor(
        readonly fn: string,
        readonly args: Readonly<Expr[]> = [],
        data = exprData(),
    ) {
        super(data);
    }
}

export class Hole extends Expr {
    constructor(data = exprData()) {
        super(data);
    }
}

class ExprValidator implements ExprVisitor<void> {
    private seenIds = new Set<ExprId>();

    private assert(expr: Expr, check: boolean) {
        // An empty comment should be a missing comment.
        if (this.seenIds.has(expr.id) || expr.comment === "" || !check) {
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
