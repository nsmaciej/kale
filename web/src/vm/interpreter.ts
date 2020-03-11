import * as E from "expr";
import Expr, { ExprId, UnvisitableExpr } from "expr";
import { Optional, asyncForEach } from "utils";

interface Value<T = unknown> {
    type: string;
    value: T;
}

interface Func {
    expr: Expr;
    args: string[];
    scope: null;
}

class VmError extends Error {}

function nullValue(): Value {
    return { type: "null", value: null };
}

function vmAssert(condition: boolean, message?: string): asserts condition {
    if (!condition) throw new VmError(message);
}

function assertVariable(expr: Expr): string {
    vmAssert(expr instanceof E.Variable, "Not a variable");
    return expr.name;
}

function assertType<T>(type: string): (value: Value) => T {
    return value => {
        vmAssert(value.type === type, `Cannot use a ${value.type}, expected ${type}`);
        return value.value as T;
    };
}

const assertBoolean = assertType<boolean>("boolean");
const assertFunc = assertType<Func>("func");

class Scope {
    private readonly values = new Map<string, Value>();
    constructor(private readonly parent?: Optional<Scope>) {}

    get(name: string): Value {
        const r = this.values.get(name);
        if (r !== undefined) return r;
        if (this.parent != null) return this.parent.get(name);
        throw new VmError(`${name} not found`);
    }

    assign(name: string, value: Value) {
        if (this.values.has(name)) {
            this.values.set(name, value);
        } else if (this.parent != null) {
            this.parent.assign(name, value);
        } else {
            throw new VmError(`${name} not found`);
        }
    }

    define(name: string, value: Value) {
        this.values.set(name, value);
    }
}

export default class Interpreter {
    private readonly globalScope = new Scope();
    private breakpoints = new Set<ExprId>();

    constructor(
        workspace: Map<string, Func>,
        private readonly onBreakpoint: (expr: ExprId, scope: Scope) => Promise<void>,
    ) {
        for (const [name, func] of workspace) {
            this.globalScope.define(name, { type: "func", value: func });
        }
    }

    replaceBreakpoints(breakpoints: Set<ExprId>) {
        this.breakpoints = breakpoints;
    }

    async eval(expr: Expr, scope: Scope): Promise<Value> {
        const promise = this.evalRaw(expr, scope);
        if (this.breakpoints.has(expr.id)) {
            await this.onBreakpoint(expr.id, scope);
        }
        return promise;
    }

    private async evalRawCall(expr: E.Call, scope: Scope): Promise<Value> {
        const { fn, args } = expr;
        if (fn === "let") {
            const value = await this.eval(args[1], scope);
            scope.define(assertVariable(expr.args[0]), value);
            return value;
        } else if (fn === "set") {
            const value = await this.eval(args[1], scope);
            scope.assign(assertVariable(expr.args[0]), value);
            return value;
        } else if (fn === "if") {
            const condition = await this.eval(expr.args[0], scope);
            return await this.eval(assertBoolean(condition) ? args[1] : args[2], scope);
        } else if (fn === "while") {
            let r = nullValue();
            while (assertBoolean(await this.eval(args[0], scope))) {
                r = await this.eval(args[1], scope);
            }
            return r;
        } else {
            // The actual call.
            const func = assertFunc(scope.get(fn));
            vmAssert(func.args.length === args.length - 1, `Wrong number of arguments for ${fn}`);
            const callScope = new Scope(func.scope);
            await asyncForEach(func.args, async (arg, i) => {
                callScope.define(arg, await this.eval(args[i + 1], scope));
            });
            return await this.eval(func.expr, callScope);
        }
    }

    private async evalRaw(expr: Expr, scope: Scope): Promise<Value> {
        if (expr instanceof E.Blank) {
            //TODO: In the future allow users to fill in blanks.
            throw new VmError("Cannot execute functions with blanks");
        } else if (expr instanceof E.Literal) {
            const { type, value } = expr;
            return { type, value };
        } else if (expr instanceof E.Variable) {
            return scope.get(expr.name);
        } else if (expr instanceof E.List) {
            const listScope = new Scope(scope);
            for (const line of expr.list) {
                await this.eval(line, listScope);
            }
        } else if (expr instanceof E.Call) {
            await this.evalRawCall(expr, scope);
        }
        throw new UnvisitableExpr(expr);
    }
}
