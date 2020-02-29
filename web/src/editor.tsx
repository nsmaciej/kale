import React, { Component, useState, ReactNode } from "react";
import styled from "styled-components";

import * as E from "./expr";
import { Expr, ExprId } from "./expr";
import ExprView from "./expr_view";
import { SAMPLE_1 } from "./sample";
import { Optional, assert, assertSome } from "./utils";
import { Box, BoxProps } from "./components";

interface EditorState {
    expr: Expr;
    focused: boolean;
    selection: Optional<ExprId>;
}

interface ClipboardValue {
    clipboard: Expr[];
    setClipboard: React.Dispatch<React.SetStateAction<Expr[]>>;
}

export const ClipboardContext = React.createContext<Optional<ClipboardValue>>(null);

export function Clipboard({ children }: { children: ReactNode }) {
    const [clipboard, setClipboard] = useState<Expr[]>([]);
    const value = { clipboard, setClipboard };
    return <ClipboardContext.Provider value={value}>{children}</ClipboardContext.Provider>;
}

export default class Editor extends Component<{}, EditorState> {
    static contextType = ClipboardContext;
    declare context: React.ContextType<typeof ClipboardContext>;

    private containerRef = React.createRef<HTMLDivElement>();

    state: EditorState = {
        selection: null,
        focused: true,
        expr: SAMPLE_1,
    };

    private addToClipboard(expr: Expr) {
        return assertSome(this.context).setClipboard(clipboard => {
            if (expr instanceof E.Blank) return clipboard;
            return [expr, ...clipboard.filter(x => x.id !== expr.id)]; // Remove duplicate ids.
        });
    }

    private static removeSelection(state: EditorState) {
        const { selection, expr, focused } = state;
        if (selection == null) return state;
        const newExpr = expr.remove(selection);
        const parent = expr.parentOf(selection);
        // Check if the parent still exists. If not, select the grand-parent.
        const newSelection = newExpr?.contains(parent?.id)
            ? parent?.id
            : expr.parentOf(parent?.id)?.id;
        assert(
            newSelection == null || newExpr?.contains(newSelection),
            "Calculated new selection does not exist",
        );
        return {
            focused, // Sadly TS insists on this.
            expr: newExpr ?? new E.Blank(E.exprData("Double click me")),
            selection: newSelection,
        };
    }

    private static selectParent(state: EditorState) {
        return state.expr.parentOf(state.selection)?.id;
    }

    private static selectLeftSibling(state: EditorState) {
        const siblings = state.expr.siblings(state.selection);
        const ix = siblings?.findIndex(x => x.id === state.selection);
        if (ix == null || ix <= 0) return;
        return siblings[ix - 1]?.id;
    }

    private static selectRightSibling(state: EditorState) {
        const siblings = state.expr.siblings(state.selection);
        const ix = siblings?.findIndex(x => x.id === state.selection);
        if (ix == null) return;
        return siblings[ix + 1]?.id;
    }

    private static selectFirstCHild(state: EditorState) {
        return state.expr.withId(state.selection)?.children()[0]?.id;
    }

    private static selectNextBlank(state: EditorState) {
        const blanks = state.expr.findAll(x => x instanceof E.Blank);
        const ix = blanks.findIndex(x => x.id === state.selection);
        if (ix === -1) return blanks[0].id;
        return blanks[(ix + 1) % blanks.length].id;
    }

    private setSelection(reducer: (state: EditorState) => Optional<ExprId>) {
        this.setState(state => ({
            selection: state.selection == null ? state.expr.id : reducer(state) ?? state.selection,
        }));
    }

    private readonly keyDown = (event: React.KeyboardEvent) => {
        // See https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values.
        switch (event.key) {
            // Deletion.
            case "Backspace":
                const toDelete = this.state.expr.withId(this.state.selection);
                if (toDelete != null) this.addToClipboard(toDelete);
                this.setState(Editor.removeSelection);
                break;
            // Logical selection.
            case "h":
                this.setSelection(Editor.selectParent);
                break;
            case "k":
                this.setSelection(Editor.selectLeftSibling);
                break;
            case "j":
                this.setSelection(Editor.selectRightSibling);
                break;
            case "l":
                this.setSelection(Editor.selectFirstCHild);
                break;
            // Copy.
            case "c":
                const toCopy = this.state.expr.withId(this.state.selection);
                if (toCopy != null) this.addToClipboard(toCopy);
                break;
            // Blanks selection.
            case "Tab":
                // We don't want the default "select root" behaviour of setSelection.
                this.setState(state => ({ selection: Editor.selectNextBlank(state) }));
                break;
            // Blank insertion.
            case "a":
                if (this.state.selection) this.createSiblingBlank(this.state.selection);
                break;
            default:
                console.log("Did not handle", event.key);
                return;
        }
        event.preventDefault();
    };

    private readonly createSiblingBlank = (clickedId: ExprId) => {
        const clicked = this.state.expr?.withId(clickedId);
        if (clicked instanceof E.Call) {
            const blank = new E.Blank();
            const newExpr = new E.Call(clicked.fn, clicked.args.concat(blank), clicked.data);
            this.setState(({ expr }) => ({
                selection: blank.id,
                expr: expr.replace(clickedId, newExpr),
            }));
        }
    };

    private readonly exprSelected = (selection: ExprId) => {
        this.setState({ selection });
    };
    private readonly clearSelection = () => {
        this.setState({ selection: null });
    };

    private readonly focusChanged = () => {
        this.setState({ focused: document.activeElement?.id === "editor" });
    };
    componentDidMount() {
        this.containerRef.current?.focus();
    }

    render() {
        return (
            <div
                onKeyDown={this.keyDown}
                tabIndex={0}
                onClick={this.clearSelection}
                ref={this.containerRef}
                onBlur={this.focusChanged}
                onFocus={this.focusChanged}
                id="editor"
            >
                <ExprView
                    expr={this.state.expr}
                    selection={this.state.selection}
                    focused={this.state.focused}
                    onClick={this.exprSelected}
                    onClickCreateCircle={this.createSiblingBlank}
                />
            </div>
        );
    }
}
