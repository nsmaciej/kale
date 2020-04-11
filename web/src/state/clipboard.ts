import { createAction, Action } from "@reduxjs/toolkit";

import * as E from "expr";
import { partition } from "utils";
import Expr, { ExprId } from "expr";

export interface ClipboardEntry {
    pinned: boolean;
    expr: Expr;
}

// Cannot use createSlice because Expr doesn't sit well with immer.
const actions = {
    add: createAction<ClipboardEntry>("clipboard/add"),
    remove: createAction<ExprId>("clipboard/remove"),
    use: createAction<ExprId>("clipboard/use"),
    togglePinned: createAction<ExprId>("clipboard/togglePinned"),
    clear: createAction("clipboard/clear"),
};

function reducer(state: ClipboardEntry[] | undefined, action: Action<unknown>): ClipboardEntry[] {
    if (state === undefined) return [];

    if (actions.add.match(action)) {
        if (action.payload.expr instanceof E.Blank) return state;
        // This expression is pinned.
        if (state.some((x) => x.expr.id === action.payload.expr.id && x.pinned)) return state;
        // Remove duplicate ids.
        const newClipboard = state.filter((x) => x.expr.id !== action.payload.expr.id);
        const [pinned, notPinned] = partition(newClipboard, (x) => x.pinned);
        return [...pinned, { expr: action.payload.expr, pinned: false }, ...notPinned];
    }

    if (actions.remove.match(action)) {
        return state.filter((x) => x.expr.id !== action.payload);
    }

    if (actions.use.match(action)) {
        // Possibly remove an entry if it isn't pinned.
        return state.filter((x) => x.pinned || x.expr.id !== action.payload);
    }

    if (actions.clear.match(action)) {
        return state.filter((x) => x.pinned);
    }

    if (actions.togglePinned.match(action)) {
        const newClipboard = state.map((x) =>
            x.expr.id === action.payload ? { expr: x.expr, pinned: !x.pinned } : x,
        );
        const [pinned, notPinned] = partition(newClipboard, (x) => x.pinned);
        return [...pinned, ...notPinned];
    }
    return state;
}

export default { name: "clipboard", actions, reducer };
