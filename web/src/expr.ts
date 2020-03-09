import { filterMap, Optional, arrayEquals, assertSome } from "utils";

export type ExprId = number;

export interface ExprData {
    id: ExprId;
    comment?: string;
    disabled: boolean;
}

let GlobalExprId = 1;
// Construct simple ExprData for sample Exprs. Not very exciting right now.
export function exprData(comment?: string): ExprData {
    return { comment, id: GlobalExprId++, disabled: false };
}

export interface ExprVisitor<R = void> {
    visitList(expr: List): R;
    visitLiteral(expr: Literal): R;
    visitVariable(expr: Variable): R;
    visitBlank(expr: Blank): R;
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

export default abstract class Expr {
    constructor(readonly data: ExprData) {}
    get id() {
        return this.data.id;
    }

    protected abstract shallowValid(): boolean;

    visit<R>(visitor: ExprVisitor<R>): R {
        if (this instanceof List) return visitor.visitList(this);
        else if (this instanceof Variable) return visitor.visitVariable(this);
        else if (this instanceof Literal) return visitor.visitLiteral(this);
        else if (this instanceof Blank) return visitor.visitBlank(this);
        else if (this instanceof Call) return visitor.visitCall(this);
        throw new UnvisitableExpr(this);
    }

    contains(expr: ExprId): boolean {
        return this.withId(expr) != null;
    }

    some(fn: (expr: Expr) => boolean) {
        return this.find(fn) != null;
    }

    // Find a sub-expr with an id.
    withId(id: ExprId): Optional<Expr> {
        return this.find(x => x.id === id);
    }

    update(id: ExprId, update: (expr: Expr) => Optional<Expr>): Optional<Expr> {
        return this.filterMap(x => (x.id === id ? update(x) : x));
    }

    assignToData(value: Partial<ExprData>): Expr {
        const newData = { ...this.data, ...value };
        if (this instanceof List) return new List(this.list, newData);
        else if (this instanceof Variable) return new Variable(this.name, newData);
        else if (this instanceof Literal) return new Literal(this.content, this.type, newData);
        else if (this instanceof Blank) return new Blank(newData);
        else if (this instanceof Call) return new Call(this.fn, this.args, newData);
        throw new UnvisitableExpr(this);
    }

    assignToDataWithId(id: ExprId, value: Partial<ExprData>): Expr {
        return assertSome(this.update(id, x => x.assignToData(value)));
    }

    // Give each sub-expr a fresh id.
    resetIds(): Expr {
        return assertSome(this.filterMap(x => x.replaceId(GlobalExprId++)));
    }

    // Replace the id of the current expr.
    replaceId(id: ExprId): Expr {
        return this.assignToData({ id });
    }

    replace(old: ExprId, next: Expr): Expr {
        return assertSome(this.update(old, () => next));
    }

    find(predicate: (expr: Expr) => boolean): Optional<Expr> {
        let found: Optional<Expr>;
        this.forEach(x => {
            if (found == null && predicate(x)) found = x;
        });
        return found;
    }

    findAll(test: (expr: Expr) => boolean): Expr[] {
        const result: Expr[] = [];
        this.forEach(x => {
            if (test(x)) result.push(x);
        });
        return result;
    }

    forEach(callback: (x: Expr) => void) {
        this.filterMap(x => {
            callback(x);
            return x;
        });
    }

    parents(id: ExprId): Expr[] {
        let current = id;
        const parents = [];
        for (;;) {
            const parent = this.parentOf(current);
            if (parent == null) break;
            parents.push(parent);
            current = parent.id;
        }
        return parents;
    }

    parentOf(id: ExprId): Optional<Expr> {
        return this.find(
            x =>
                (x instanceof Call && x.args.some(i => i.id === id)) ||
                (x instanceof List && x.list.some(i => i.id === id)),
        );
    }

    children(): readonly Expr[] {
        if (this instanceof Call) return this.args;
        if (this instanceof List) return this.list;
        return [];
    }

    siblings(id: ExprId): [readonly Expr[], Optional<number>] {
        const siblings = this.parentOf(id)?.children() ?? [];
        const index = siblings.findIndex(x => x.id === id);
        return [siblings, index < 0 ? null : index];
    }

    validate() {
        if (this.data.comment === "") throw new InvalidExpr(this);
        const seenIds = new Set<ExprId>();
        this.forEach(x => {
            if (seenIds.has(x.id) || !x.shallowValid()) {
                throw new InvalidExpr(x);
            }
            seenIds.add(x.id);
        });
        return this;
    }

    filterMap(fn: (expr: Expr) => Optional<Expr>): Optional<Expr> {
        return this.visit(new ExprFilterMap(fn));
    }

    remove(id: ExprId): Optional<Expr> {
        return this.update(id, () => null);
    }

    value(): Optional<string> {
        if (this instanceof Blank || this instanceof List) {
            return null;
        }
        if (this instanceof Literal) return this.content;
        else if (this instanceof Variable) return this.name;
        else if (this instanceof Call) return this.fn;
        else throw new UnvisitableExpr(this);
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
    constructor(readonly content: string, readonly type: string, data = exprData()) {
        super(data);
    }
}

export class Call extends Expr {
    shallowValid() {
        //TODO: Verify reasonable function names.
        return !!this.fn;
    }
    constructor(readonly fn: string, readonly args: readonly Expr[] = [], data = exprData()) {
        super(data);
    }
}

export class Blank extends Expr {
    shallowValid() {
        // Blanks should never be disabled.
        return !this.data.disabled;
    }
    constructor(data = exprData()) {
        super(data);
    }
}

// Traverses the expr tree in post-order.
class ExprFilterMap implements ExprVisitor<Optional<Expr>> {
    constructor(private readonly fn: (expr: Expr) => Optional<Expr>) {}
    visitList(expr: List): Optional<Expr> {
        const items = filterMap(expr.list, x => x.visit(this));
        if (arrayEquals(expr.list, items)) return this.fn(expr); // Nothing changed.
        //TODO: What should happen to the comment if we destory the list.
        if (items.length === 1) return this.fn(items[0]);
        if (items.length === 0) return null;
        return this.fn(new List(items, expr.data));
    }
    visitLiteral(expr: Literal): Optional<Expr> {
        return this.fn(expr);
    }
    visitVariable(expr: Variable): Optional<Expr> {
        return this.fn(expr);
    }
    visitBlank(expr: Blank): Optional<Expr> {
        return this.fn(expr);
    }
    visitCall(expr: Call): Optional<Expr> {
        const args = filterMap(expr.args, x => x.visit(this));
        if (arrayEquals(expr.args, args)) return this.fn(expr); // Nothing changed.
        return this.fn(new Call(expr.fn, args, expr.data));
    }
}
