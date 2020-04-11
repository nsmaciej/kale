import produce, { enableMapSet } from "immer";
import React, { ReactNode, useReducer, useEffect } from "react";

import * as Sample from "sample";
import { assertSome, createPlainReducer } from "utils";
import { Type, Value, Func, Workspace as InterpterWorkspace, Builtin, assertFunc } from "vm/types";
import Builtins from "vm/builtins";
import Expr, { Blank } from "expr";

function asFunc(expr: Expr): Value<Func> {
    return { type: Type.Func, value: { expr, scope: null, args: [] } };
}

/** Populate the workspace with the builtin functions */
function initWorkspace() {
    const scope = new Map<string, Value<Builtin | Func>>();
    for (const [name, builtin] of Object.entries(Builtins)) {
        scope.set(name, builtin);
    }
    return {
        scope: scope as InterpterWorkspace,
        functions: Array.from(scope.keys()),
        history: new Map(),
    };
}

interface WorkspaceValue {
    scope: InterpterWorkspace;
    // Functions helps useSuggestions to not run as much, keys aren't reference stable.
    functions: readonly string[];
    history: ReadonlyMap<string, Expr[]>;
}

type WorkspaceActions =
    | { type: "ensureExists"; name: string; initial?: Expr }
    | { type: "update"; name: string; updater: (expr: Expr) => Expr }
    | { type: "undo"; name: string };

enableMapSet();
const workspaceReducer = createPlainReducer<WorkspaceValue, WorkspaceActions>({
    ensureExists(state, { name, initial }) {
        if (state.scope.has(name)) return state;
        return produce(state, (draft) => {
            draft.scope.set(name, asFunc(initial ?? new Blank()));
            draft.functions = Array.from(draft.scope.keys());
            draft.history.set(name, []);
        });
    },
    update(state, { updater, name }) {
        return produce(state, (draft) => {
            const currentExpr = assertFunc(assertSome(draft.scope.get(name))).expr;
            draft.scope.set(name, asFunc(updater(currentExpr)));

            // Update the undo history.
            const historyLimit = 50;
            const history = assertSome(draft.history.get(name));
            history.push(currentExpr);
            // Keep the last historyLimit items.
            history.splice(0, history.length - historyLimit);
        });
    },
    undo(state, { name }) {
        return produce(state, (draft) => {
            const lastState = draft.history.get(name)?.pop();
            if (lastState !== undefined) {
                draft.scope.set(name, asFunc(lastState as Expr));
            }
        });
    },
});

export type WorkspaceContext = {
    workspace: WorkspaceValue;
    dispatch: React.Dispatch<WorkspaceActions>;
};

const Workspace = React.createContext<WorkspaceContext | null>(null);
export default Workspace;

export function WorkspaceProvider({ children }: { children: ReactNode }) {
    const [workspace, dispatch] = useReducer(workspaceReducer, null, initWorkspace);
    // Load all the samples.
    useEffect(() => {
        dispatch({ type: "ensureExists", name: "Sample-1", initial: Sample.SAMPLE_1 });
        dispatch({ type: "ensureExists", name: "Sample-2", initial: Sample.SAMPLE_2 });
        dispatch({ type: "ensureExists", name: "Hello-World", initial: Sample.HELLO_WORLD });
    }, []);
    return <Workspace.Provider value={{ workspace, dispatch }}>{children}</Workspace.Provider>;
}
