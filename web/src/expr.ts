import { filterMap, Optional, arrayEquals } from "./utils";

export type ExprId = number;

export interface ExprData {
    comment?: string;
}

// Construct simple ExprData for sample Exprs. Not very exciting right now.
export function exprData(comment?: string): ExprData {
    return { comment };
}

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
    private static serialExprId = 1;
    //TODO: Maybe we don't even need an id.
    readonly id: ExprId = Expr.serialExprId++;
    constructor(readonly data: ExprData) {}

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
        return this;
    }

    filterMap(fn: (expr: Expr) => Optional<Expr>): Optional<Expr> {
        return this.visit(new ExprFilterMap(fn));
    }

    remove(expr: Expr) {
        return this.filterMap(x => (x === expr ? null : x));
    }
}

export class List extends Expr {
    constructor(readonly list: readonly Expr[], data = exprData()) {
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
        readonly args: readonly Expr[] = [],
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

// Traverses the expr tree in post-order.
class ExprFilterMap implements ExprVisitor<Optional<Expr>> {
    constructor(private readonly fn: (expr: Expr) => Optional<Expr>) {}
    visitList(expr: List) {
        const items = filterMap(expr.list, x => this.fn(x));
        if (arrayEquals(expr.list, items)) return this.fn(expr); // Nothing changed.
        //TODO: What should happen to the comment if we destory the list.
        if (items.length === 1) return this.fn(items[0]);
        if (items.length === 0) return null;
        return this.fn(new List(items, expr.data));
    }
    visitLiteral(expr: Literal) {
        return this.fn(expr);
    }
    visitVariable(expr: Variable) {
        return this.fn(expr);
    }
    visitHole(expr: Hole) {
        return this.fn(expr);
    }
    visitCall(expr: Call) {
        const args = filterMap(expr.args, x => this.fn(x));
        if (arrayEquals(expr.args, args)) return this.fn(expr); // Nothing changed.
        return this.fn(new Call(expr.fn, args, expr.data));
    }
}

class ExprValidator implements ExprVisitor<void> {
    private seenIds = new Set<ExprId>();

    private assert(expr: Expr, check: boolean) {
        // An empty comment should be a missing comment.
        if (this.seenIds.has(expr.id) || expr.data.comment === "" || !check) {
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
            expr.list.length > 1 && !expr.list.some(x => x instanceof List),
        );
        expr.list.forEach(x => x.visit(this));
    }
    visitCall(expr: Call) {
        //TODO: Verify reasonable function names.
        this.assert(expr, !!expr.fn);
        expr.args.forEach(x => x.visit(this));
    }
}
