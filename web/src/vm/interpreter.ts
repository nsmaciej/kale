import * as E from "expr";
import Expr, { ExprId, UnvisitableExpr } from "expr";
import { asyncForEach } from "utils";
import {
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
    async let(evalExpr, args, scope) {
        const value = await evalExpr(args[1], scope);
        scope.define(assertVariable(args[0]), value);
        return value;
    },
    async set(evalExpr, args, scope) {
        const value = await evalExpr(args[1], scope);
        scope.assign(assertVariable(args[0]), value);
        return value;
    },
    async if(evalExpr, args, scope) {
        const condition = await evalExpr(args[0], scope);
        return await evalExpr(assertBoolean(condition) ? args[1] : args[2], scope);
    },
    async while(evalExpr, args, scope) {
        let r = nullValue();
        while (assertBoolean(await evalExpr(args[0], scope))) {
            r = await evalExpr(args[1], scope);
        }
        return r;
    },
};

export const specialFunctions = Object.keys(specials);

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
        const promise = this.evalRaw(expr, scope);
        if (this.breakpoints.has(expr.id)) {
            await new Promise(resolve => this.callbacks.onBreakpoint(resolve));
        }
        return promise;
    }

    private async evalBuiltin(expr: E.Call, scope: Scope): Promise<Value> {
        const builtin = assertBuiltin(scope.get(expr.fn));
        const args = await Promise.all(expr.args.map(x => this.eval(x, scope)));
        builtin.args.forEach((type, i) =>
            vmAssert(type === args[i].type, `Expected type ${args[i].type}, found ${type}`),
        );
        return builtin.builtin(...args);
    }

    private async evalRawCall(expr: E.Call, scope: Scope): Promise<Value> {
        const { fn, args } = expr;

        // Handle specials.
        if (Object.prototype.hasOwnProperty.call(specials, fn)) {
            return specials[fn](this.eval.bind(this), args, scope);
        }

        const value = scope.get(fn);
        // Handle builtins.
        if (value.type === Type.Builtin) {
            return this.evalBuiltin(expr, scope);
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
        //TODO: In the future allow users to fill in blanks.
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
