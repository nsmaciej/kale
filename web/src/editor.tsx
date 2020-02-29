import React, { Component, useState, ReactNode, useContext } from "react";

import * as E from "./expr";
import Expr, { ExprId } from "./expr";
import ExprView from "./expr_view";
import { Optional, assert, assertSome } from "./utils";
import { Clipboard, Workspace, ClipboardValue, WorkspaceProvider } from "./workspace";

interface EditorState {
    focused: boolean;
    selection: Optional<ExprId>;
}

interface EditorProps {
    workspace: WorkspaceProvider;
    clipboard: ClipboardValue;
    topLevelName: string;
}

class Editor extends Component<EditorProps, EditorState> {
    private containerRef = React.createRef<HTMLDivElement>();

    state: EditorState = {
        selection: null,
        focused: true,
    };

    private update(updater: (expr: Expr) => Optional<Expr>) {
        this.props.workspace.setTopLevel(
            this.props.topLevelName,
            expr => updater(expr) ?? new E.Blank(E.exprData("Double click me")),
        );
    }

    private get expr() {
        return this.props.workspace.topLevel(this.props.topLevelName);
    }

    private copySelectionToClipboard() {
        const selected = this.expr.withId(this.state.selection);
        if (selected == null) return false;
        this.props.clipboard.setClipboard(clipboard => {
            if (this.expr instanceof E.Blank) return clipboard;
            // Remove duplicate ids.
            return [selected, ...clipboard.filter(x => x.id !== this.expr.id)];
        });
        return true;
    }

    private removeSelection() {
        const sel = this.state.selection;
        if (sel == null) return;
        this.update(expr => {
            const newExpr = expr.remove(sel);
            if (newExpr == null) return null;
            const parent = expr.parentOf(sel);
            // Check if the parent still exists. If not, select the grand-parent.
            // This happens when deletion purges a single-expr list.
            const newSelection = newExpr.contains(parent?.id)
                ? parent?.id
                : expr.parentOf(parent?.id)?.id;
            assert(
                newSelection == null || newExpr?.contains(newSelection),
                "Calculated new selection does not exist",
            );
            this.setState({ selection: newSelection });
            return newExpr;
        });
    }

    private static selectParent(expr: Expr, sel: ExprId) {
        return expr.parentOf(sel)?.id;
    }

    private static selectLeftSibling(expr: Expr, sel: ExprId) {
        const siblings = expr.siblings(sel);
        const ix = siblings?.findIndex(x => x.id === sel);
        if (ix == null || ix <= 0) return;
        return siblings[ix - 1]?.id;
    }

    private static selectRightSibling(expr: Expr, sel: ExprId) {
        const siblings = expr.siblings(sel);
        const ix = siblings?.findIndex(x => x.id === sel);
        if (ix == null) return;
        return siblings[ix + 1]?.id;
    }

    private static selectFirstCHild(expr: Expr, sel: ExprId) {
        return expr.withId(sel)?.children()[0]?.id;
    }

    private static selectNextBlank(expr: Expr, sel: Optional<ExprId>) {
        const blanks = expr.findAll(x => x instanceof E.Blank);
        const ix = blanks.findIndex(x => x.id === sel);
        if (ix === -1) return blanks[0].id;
        return blanks[(ix + 1) % blanks.length].id;
    }

    private setSelection(reducer: (expr: Expr, sel: ExprId) => Optional<ExprId>) {
        this.setState(state => ({
            selection:
                state.selection == null
                    ? this.expr.id
                    : reducer(this.expr, state.selection) ?? state.selection,
        }));
    }

    private readonly keyDown = (event: React.KeyboardEvent) => {
        // See https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values.
        switch (event.key) {
            // Deletion.
            case "Backspace":
                this.copySelectionToClipboard();
                this.removeSelection();
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
                this.copySelectionToClipboard();
                break;
            // Blanks selection.
            case "Tab":
                // We don't want the default "select root" behaviour of setSelection.
                this.setState(state => ({
                    selection: Editor.selectNextBlank(this.expr, state.selection),
                }));
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
        const clicked = this.expr.withId(clickedId);
        if (clicked instanceof E.Call) {
            const blank = new E.Blank();
            const newExpr = new E.Call(clicked.fn, clicked.args.concat(blank), clicked.data);
            this.update(expr => expr.replace(clickedId, newExpr));
            this.setState({ selection: blank.id });
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
                    expr={this.expr}
                    selection={this.state.selection}
                    focused={this.state.focused}
                    onClick={this.exprSelected}
                    onClickCreateCircle={this.createSiblingBlank}
                />
            </div>
        );
    }
}

export default function EditorWrapper({ topLevelName }: { topLevelName: string }) {
    return (
        <Editor
            topLevelName={topLevelName}
            workspace={assertSome(useContext(Workspace))}
            clipboard={assertSome(useContext(Clipboard))}
        />
    );
}
