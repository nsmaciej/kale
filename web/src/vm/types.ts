import Expr from "expr";
import { Optional } from "utils";

export interface Value<T = unknown> {
    type: string;
    value: T;
}

export interface Func {
    expr: Expr;
    args: string[];
    scope: null;
}

export type Workspace = Map<string, Func>;

export interface WorkspaceRef {
    current: Workspace;
}

export class VmError extends Error {}

export function vmAssert(condition: boolean, message?: string): asserts condition {
    if (!condition) throw new VmError(message);
}

function assertType<T>(type: string): (value: Value) => T {
    return value => {
        vmAssert(value.type === type, `Cannot use a ${value.type}, expected ${type}`);
        return value.value as T;
    };
}

export const assertBoolean = assertType<boolean>("boolean");
export const assertFunc = assertType<Func>("func");
export const assertStr = assertType<string>("str");

export class Scope {
    private readonly values = new Map<string, Value>();
    constructor(
        private readonly parent?: Optional<Scope>,
        private readonly workspaceRef?: WorkspaceRef,
    ) {}

    get(name: string): Value {
        const value = this.values.get(name);
        if (value !== undefined) {
            return value;
        }
        if (this.parent != null) {
            return this.parent.get(name);
        }
        if (this.workspaceRef?.current != null) {
            const workspaceValue = this.workspaceRef.current.get(name);
            if (workspaceValue != null) {
                return { type: "func", value: workspaceValue };
            }
        }
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
