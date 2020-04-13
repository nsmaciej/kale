import { createAction, Action } from "@reduxjs/toolkit";
import produce, { enableMapSet } from "immer";

import * as Sample from "sample";
import { assertSome } from "utils";
import { Type, Value, Func, Workspace as InterpterWorkspace, Builtin, assertFunc } from "vm/types";
import Builtins from "vm/builtins";
import Expr, { Blank } from "expr";

function asFunc(expr: Expr): Value<Func> {
    return { type: Type.Func, value: { expr, scope: null, args: [] } };
}

/** Populate the workspace with the builtin functions */
function initWorkspace(): WorkspaceValue {
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

function ensureExists(state: WorkspaceValue, name: string, initial?: Expr) {
    if (state.scope.has(name)) return state;
    return produce(state, (draft) => {
        draft.scope.set(name, asFunc(initial ?? new Blank()));
        draft.functions = Array.from(draft.scope.keys());
        draft.history.set(name, []);
    });
}

export interface WorkspaceValue {
    scope: InterpterWorkspace;
    // Functions helps useSuggestions to not run as much, keys aren't reference stable.
    functions: readonly string[];
    history: ReadonlyMap<string, Expr[]>;
}

const actions = {
    ensureExists: createAction<{ name: string; initial?: Expr }>("workspace/ensureExists"),
    update: createAction<{ name: string; updater: (expr: Expr) => Expr }>("workspace/update"),
    undo: createAction<{ name: string }>("workspace/undo"),
};

enableMapSet();
function reducer(state: WorkspaceValue | undefined, action: Action<unknown>): WorkspaceValue {
    if (state === undefined) {
        let next = initWorkspace();
        next = ensureExists(next, "Sample-1", Sample.SAMPLE_1);
        next = ensureExists(next, "Sample-2", Sample.SAMPLE_2);
        next = ensureExists(next, "Hello-World", Sample.HELLO_WORLD);
        return next;
    }

    if (actions.ensureExists.match(action)) {
        const { name, initial } = action.payload;
        return ensureExists(state, name, initial);
    }

    if (actions.update.match(action)) {
        const { name, updater } = action.payload;
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
    }
    if (actions.undo.match(action)) {
        const { name } = action.payload;
        return produce(state, (draft) => {
            const lastState = draft.history.get(name)?.pop();
            if (lastState !== undefined) {
                draft.scope.set(name, asFunc(lastState as Expr));
            }
        });
    }

    return state;
}

export default { name: "workspace", actions, reducer };
