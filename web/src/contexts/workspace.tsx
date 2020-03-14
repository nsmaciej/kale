import React, { ReactNode } from "react";
import { enableMapSet } from "immer";
import { useImmer } from "use-immer";

import Expr, { Blank } from "expr";
import { Optional, assertSome } from "utils";
import { Type, Value, Func, Workspace as InterpterWorkspace, Builtin, assertFunc } from "vm/types";
import Builtins from "vm/builtins";
import * as Sample from "sample";

function asFunc(expr: Expr): Value<Func> {
    return { type: Type.Func, value: { expr, scope: null, args: [] } };
}

function initialWorkspace() {
    const scope: Map<string, Value<Builtin | Func>> = new Map([
        ["Sample-1", asFunc(Sample.SAMPLE_1)],
        ["Sample-2", asFunc(Sample.SAMPLE_2)],
        ["Hello-World", asFunc(Sample.HELLO_WORLD)],
    ]);
    for (const [name, builtin] of Object.entries(Builtins)) {
        scope.set(name, builtin);
    }
    // Functions helps useSuggestions to not run as much, keys aren't reference stable.
    return { scope: scope as InterpterWorkspace, functions: Array.from(scope.keys()) };
}

enableMapSet();
export function useWorkSpaceProvider() {
    const [globals, setGlobals] = useImmer(initialWorkspace);
    return {
        globals: globals.scope,
        functions: globals.functions,
        ensureExists(name: string) {
            if (globals.scope.has(name)) return;
            setGlobals(draft => {
                draft.scope.set(name, asFunc(new Blank()));
                draft.functions = Array.from(draft.scope.keys());
            });
        },
        get(name: string): Value<Func | Builtin> {
            return assertSome(globals.scope.get(name));
        },
        remove(name: string): void {
            setGlobals(draft => {
                draft.scope.delete(name);
                draft.functions = Array.from(draft.scope.keys());
            });
        },
        update(name: string, update: (expr: Expr) => Expr) {
            setGlobals(draft => {
                const next = asFunc(update(assertFunc(assertSome(draft.scope.get(name))).expr));
                draft.scope.set(name, next);
            });
        },
    };
}

export type WorkspaceValue = ReturnType<typeof useWorkSpaceProvider>;
export const Workspace = React.createContext<Optional<WorkspaceValue>>(null);

export function WorkspaceProvider(props: { children: ReactNode }) {
    return <Workspace.Provider value={useWorkSpaceProvider()}>{props.children}</Workspace.Provider>;
}
