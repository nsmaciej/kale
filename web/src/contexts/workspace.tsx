import produce, { enableMapSet } from "immer";
import React, { ReactNode, useReducer } from "react";

import * as Sample from "sample";
import { assertSome, createReducer } from "utils";
import { Type, Value, Func, Workspace as InterpterWorkspace, Builtin, assertFunc } from "vm/types";
import Builtins from "vm/builtins";
import Expr, { Blank } from "expr";

function asFunc(expr: Expr): Value<Func> {
    return { type: Type.Func, value: { expr, scope: null, args: [] } };
}

function initWorkspace() {
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

interface WorkspaceValue {
    scope: InterpterWorkspace;
    functions: readonly string[];
}

type WorkspaceActions =
    | { type: "ensureExists"; name: string }
    | { type: "remove"; name: string }
    | { type: "update"; name: string; updater: (expr: Expr) => Expr };

enableMapSet();
const workspaceReducer = createReducer<WorkspaceValue, WorkspaceActions>({
    ensureExists(state, { name }) {
        if (state.scope.has(name)) return state;
        return produce(state, draft => {
            draft.scope.set(name, asFunc(new Blank()));
            draft.functions = Array.from(draft.scope.keys());
        });
    },
    update(state, { updater, name }) {
        return produce(state, draft => {
            const next = asFunc(updater(assertFunc(assertSome(draft.scope.get(name))).expr));
            draft.scope.set(name, next);
        });
    },
    remove(state, { name }) {
        return produce(state, draft => {
            draft.scope.delete(name);
            draft.functions = Array.from(draft.scope.keys());
        });
    },
});

export type WorkspaceContext = {
    workspace: WorkspaceValue;
    dispatch: React.Dispatch<WorkspaceActions>;
};

export const Workspace = React.createContext<WorkspaceContext | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
    const [workspace, dispatch] = useReducer(workspaceReducer, initWorkspace());
    return <Workspace.Provider value={{ workspace, dispatch }}>{children}</Workspace.Provider>;
}
