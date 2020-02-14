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

    protected abstract shallowValid(): boolean;

    visit<R>(visitor: ExprVisitor<R>): R {
        if (this instanceof List) return visitor.visitList(this);
        else if (this instanceof Variable) return visitor.visitVariable(this);
        else if (this instanceof Literal) return visitor.visitLiteral(this);
        else if (this instanceof Hole) return visitor.visitHole(this);
        else if (this instanceof Call) return visitor.visitCall(this);
        throw new UnvisitableExpr(this);
    }

    validate() {
        if (this.data.comment === "") throw new InvalidExpr(this);
        let seenIds = new Set<ExprId>();
        const validator = new ExprFilterMap(x => {
            if (seenIds.has(x.id)) throw new InvalidExpr(x);
            return x;
        });
        this.visit(validator);
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
    shallowValid() {
        return this.list.length > 1 && !this.list.some(x => x instanceof List);
    }
    constructor(readonly list: readonly Expr[], data = exprData()) {
        super(data);
    }
}

export class Variable extends Expr {
    shallowValid() {
        //TODO: Verify reasonable identifer names.
        return !!this.name;
    }
    constructor(readonly name: string, data = exprData()) {
        super(data);
    }
}

export class Literal extends Expr {
    shallowValid() {
        //TODO: Check for valid literals.
        return !!this.content && !!this.type;
    }
    constructor(
        readonly content: string,
        readonly type: string,
        data = exprData(),
    ) {
        super(data);
    }
}

export class Call extends Expr {
    shallowValid() {
        //TODO: Verify reasonable function names.
        return !!this.fn;
    }
    constructor(
        readonly fn: string,
        readonly args: readonly Expr[] = [],
        data = exprData(),
    ) {
        super(data);
    }
}

export class Hole extends Expr {
    shallowValid() {
        return true;
    }
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
