import React, { ReactNode, useReducer } from "react";

import * as E from "expr";
import { partition, createReducer } from "utils";
import Expr, { ExprId } from "expr";

export interface ClipboardEntry {
    pinned: boolean;
    expr: Expr;
}

type ClipboardState = ClipboardEntry[];

export type ClipboardActions =
    | { type: "add"; entry: ClipboardEntry }
    | { type: "clear" }
    | { type: "use"; expr: ExprId }
    | { type: "remove"; expr: ExprId }
    | { type: "togglePinned"; expr: ExprId };

const clipboardReducer = createReducer<ClipboardState, ClipboardActions>({
    add(state, { entry }) {
        if (entry.expr instanceof E.Blank) return state;
        // This expression is pinned.
        if (state.some((x) => x.expr.id === entry.expr.id && x.pinned)) return state;
        // Remove duplicate ids.
        const newClipboard = state.filter((x) => x.expr.id !== entry.expr.id);
        const [pinned, notPinned] = partition(newClipboard, (x) => x.pinned);
        return [...pinned, { expr: entry.expr, pinned: false }, ...notPinned];
    },
    remove(state, { expr }) {
        return state.filter((x) => x.expr.id !== expr);
    },
    use(state, { expr }) {
        // Possibly remove an entry if it isn't pinned.
        return state.filter((x) => x.pinned || x.expr.id !== expr);
    },
    clear(state) {
        return state.filter((x) => x.pinned);
    },
    togglePinned(state, { expr }) {
        const newClipboard = state.map((x) =>
            x.expr.id === expr ? { expr: x.expr, pinned: !x.pinned } : x,
        );
        const [pinned, notPinned] = partition(newClipboard, (x) => x.pinned);
        return [...pinned, ...notPinned];
    },
});
export type ClipboardContext = {
    value: ClipboardState;
    dispatch: React.Dispatch<ClipboardActions>;
};

export const Clipboard = React.createContext<ClipboardContext | null>(null);

export function ClipboardProvider({ children }: { children: ReactNode }) {
    const [clipboard, dispatch] = useReducer(clipboardReducer, []);
    return (
        <Clipboard.Provider value={{ value: clipboard, dispatch }}>{children}</Clipboard.Provider>
    );
}
