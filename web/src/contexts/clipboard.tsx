import React, { Component } from "react";

import { Optional, partition } from "utils";
import Expr, { ExprId } from "expr";
import * as E from "expr";

interface ClipboardEntry {
    pinned: boolean;
    expr: Expr;
}

export type ClipboardValue = ClipboardProvider["state"];
export const Clipboard = React.createContext<Optional<ClipboardValue>>(null);
export class ClipboardProvider extends Component<{}, ClipboardProvider["state"]> {
    state = {
        clipboard: [] as ClipboardEntry[],
        add: (entry: ClipboardEntry) => {
            this.update(clipboard => {
                if (entry.expr instanceof E.Blank) return clipboard;
                // This expression is pinned.
                if (clipboard.some(x => x.expr.id === entry.expr.id && x.pinned)) return clipboard;
                // Remove duplicate ids.
                const newClipboard = clipboard.filter(x => x.expr.id !== entry.expr.id);
                const [pinned, notPinned] = partition(newClipboard, x => x.pinned);
                return [...pinned, { expr: entry.expr, pinned: false }, ...notPinned];
            });
        },
        use: (expr: ExprId) => {
            // Possibly remove an entry if it isn't pinned.
            this.update(clipboard => clipboard.filter(x => x.pinned || x.expr.id !== expr));
        },
        clear: () => {
            this.update(clipboard => clipboard.filter(x => x.pinned));
        },
        canBeCleared: () => {
            for (const entry of this.state.clipboard) {
                if (!entry.pinned) return true;
            }
            return false;
        },
        togglePinned: (expr: ExprId) => {
            this.update(clipboard => {
                const newClipboard = clipboard.map(x =>
                    x.expr.id === expr ? { expr: x.expr, pinned: !x.pinned } : x,
                );
                const [pinned, notPinned] = partition(newClipboard, x => x.pinned);
                return [...pinned, ...notPinned];
            });
        },
    };

    private update(update: (clipboard: ClipboardEntry[]) => ClipboardEntry[]) {
        this.setState(state => ({
            clipboard: update(state.clipboard),
        }));
    }

    render() {
        return <Clipboard.Provider value={this.state}>{this.props.children}</Clipboard.Provider>;
    }
}
