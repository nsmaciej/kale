import * as E from "expr";
import Expr, { ExprId, UnvisitableExpr } from "expr";
import { asyncForEach } from "utils";
import {
    VmError,
    Value,
    Workspace,
    WorkspaceRef,
    Scope,
    Type,
    vmAssert,
    assertFunc,
    assertBoolean,
    assertBuiltin,
} from "vm/types";
import Builtins from "vm/builtins";

interface InterpreterCallbacks {
    onBreakpoint(continueEval: () => void): void;
    onTerminated(): void;
}

function assertVariable(expr: Expr): string {
    vmAssert(expr instanceof E.Variable, "Not a variable");
    return expr.name;
}

function nullValue(): Value {
    return { type: Type.Null, value: null };
}

const specials: {
    [special: string]: (
        evalExpr: Interpreter["eval"],
        args: readonly Expr[],
        scope: Scope,
    ) => Promise<Value>;
} = {
    async Let(evalExpr, args, scope) {
        const value = await evalExpr(args[1], scope);
        scope.define(assertVariable(args[0]), value);
        return value;
    },
    async Set(evalExpr, args, scope) {
        const value = await evalExpr(args[1], scope);
        scope.assign(assertVariable(args[0]), value);
        return value;
    },
    async If(evalExpr, args, scope) {
        const condition = await evalExpr(args[0], scope);
        return await evalExpr(assertBoolean(condition) ? args[1] : args[2], scope);
    },
    async While(evalExpr, args, scope) {
        let r = nullValue();
        while (assertBoolean(await evalExpr(args[0], scope))) {
            r = await evalExpr(args[1], scope);
        }
        return r;
    },
};

export const builtinFunctions = new Set(Object.keys(Builtins)) as ReadonlySet<string>;
export const specialFunctions = new Set(Object.keys(specials)) as ReadonlySet<string>;

export default class Interpreter {
    private readonly workspaceRef: WorkspaceRef = { current: new Map() };
    private readonly globalScope = new Scope(undefined, this.workspaceRef);
    private breakpoints = new Set<ExprId>();

    constructor(private readonly callbacks: InterpreterCallbacks) {}

    setWorkspace(workspace: Workspace) {
        this.workspaceRef.current = workspace;
    }

    setBreakpoints(breakpoints: Set<ExprId>) {
        this.breakpoints = breakpoints;
    }

    async evalFunction(name: string) {
        const func = assertFunc(this.globalScope.get(name));
        vmAssert(func.args.length === 0, "No arguments provided");
        await this.eval(func.expr, this.globalScope);
        this.callbacks.onTerminated();
    }

    private async eval(expr: Expr, scope: Scope): Promise<Value> {
        if (expr.data.disabled) {
            return nullValue();
        }
        const promise = this.evalRaw(expr, scope);
        if (this.breakpoints.has(expr.id)) {
            await new Promise(resolve => this.callbacks.onBreakpoint(resolve));
        }
        return promise;
    }

    private async evalBuiltin(fn: string, args: Expr[], scope: Scope): Promise<Value> {
        const builtin = assertBuiltin(scope.get(fn));
        const evaluatedArgs = await Promise.all(args.map(x => this.eval(x, scope)));
        vmAssert(builtin.args.length === args.length, `Wrong number of arguments for ${fn}`);
        builtin.args.forEach((type, i) =>
            vmAssert(
                type === null || type === evaluatedArgs[i].type,
                `Expected type ${evaluatedArgs[i].type}, found ${type}`,
            ),
        );
        return builtin.builtin(evaluatedArgs);
    }

    private async evalRawCall(expr: E.Call, scope: Scope): Promise<Value> {
        const { fn } = expr;
        // We pretend as if disabled arguments aren't there.
        const args = expr.args.filter(x => !x.data.disabled);

        // Handle specials.
        if (Object.prototype.hasOwnProperty.call(specials, fn)) {
            return specials[fn](this.eval.bind(this), args, scope);
        }

        //TODO: In the future maybe allow nested named function.
        const value = this.workspaceRef.current.get(fn);
        if (value == null) throw new VmError("Unrecognised function");

        // Handle builtins.
        if (value.type === Type.Builtin) {
            return this.evalBuiltin(fn, args, scope);
        }

        // The actual call.
        const func = assertFunc(value);
        vmAssert(func.args.length === args.length - 1, `Wrong number of arguments for ${fn}`);
        const callScope = new Scope(func.scope);
        await asyncForEach(func.args, async (arg, i) => {
            callScope.define(arg, await this.eval(args[i + 1], scope));
        });
        return this.eval(func.expr, callScope);
    }

    private async evalRaw(expr: Expr, scope: Scope): Promise<Value> {
        //TODO: Break and allow users to fill in the blanks.
        vmAssert(!(expr instanceof E.Blank), "Cannot execute functions with blanks");

        if (expr instanceof E.Literal) {
            const { type, content } = expr;
            return { type, value: content };
        } else if (expr instanceof E.Variable) {
            return scope.get(expr.name);
        } else if (expr instanceof E.List) {
            const listScope = new Scope(scope);
            let r = nullValue();
            for (const line of expr.list) {
                r = await this.eval(line, listScope);
            }
            return r;
        } else if (expr instanceof E.Call) {
            return await this.evalRawCall(expr, scope);
        }
        throw new UnvisitableExpr(expr);
    }
}
