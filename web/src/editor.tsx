import React, { Component, useContext } from "react";

import * as E from "./expr";
import Expr, { ExprId } from "./expr";
import ExprView from "./expr_view";
import { Optional, assert, assertSome, removeIndex, replaceIndex, insertIndex } from "./utils";
import { Clipboard, Workspace, ClipboardValue, WorkspaceValue } from "./workspace";

interface EditorState {
    focused: boolean;
    selection: Optional<ExprId>;
    foldingComments: boolean;
}

interface EditorWrapperProps {
    stealFocus?: boolean;
    topLevelName: string;
}

interface EditorProps extends EditorWrapperProps {
    workspace: WorkspaceValue;
    clipboard: ClipboardValue;
}

class Editor extends Component<EditorProps, EditorState> {
    private containerRef = React.createRef<HTMLDivElement>();

    state: EditorState = {
        selection: null,
        focused: true,
        foldingComments: false,
    };

    private update(updater: (expr: Expr) => Optional<Expr>) {
        this.props.workspace.setTopLevel(
            this.props.topLevelName,
            expr => updater(expr) ?? new E.Blank(E.exprData("Double click me")),
        );
    }

    private get expr() {
        return this.props.workspace.getTopLevel(this.props.topLevelName);
    }

    private addToClipboard(expr: Expr) {
        this.props.clipboard.setClipboard(clipboard => {
            if (this.expr instanceof E.Blank) return clipboard;
            // Remove duplicate ids.
            return [expr, ...clipboard.filter(x => x.id !== expr.id)];
        });
        return true;
    }

    private addSelectionToClipboard() {
        const selection = this.expr.withId(this.state.selection);
        if (selection != null) this.addToClipboard(selection);
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
        const [siblings, ix] = expr.siblings(sel);
        if (ix == null || ix === 0) return;
        return siblings[ix - 1]?.id;
    }

    private static selectRightSibling(expr: Expr, sel: ExprId) {
        const [siblings, ix] = expr.siblings(sel);
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
        const key = event.key;
        // See https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values.
        switch (key) {
            // Deletion.
            case "Backspace":
                this.addSelectionToClipboard();
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
                this.addSelectionToClipboard();
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
                if (this.state.selection) this.createChildBlank(this.state.selection);
                break;
            case "i":
                this.createSiblingBlank();
                break;
            // Folding.
            case "#":
                this.setState(state => ({ foldingComments: !state.foldingComments }));
                break;
            default:
                // From clipboard history.
                if (this.state.selection != null && key >= "0" && key <= "9") {
                    const ix = parseInt(key);
                    const clipboard = this.props.clipboard.clipboard;
                    const selectedId = this.state.selection;
                    const selected = this.expr.withId(selectedId);
                    if (ix < clipboard.length) {
                        this.update(expr =>
                            expr.replace(
                                selectedId,
                                clipboard[ix].resetIds().replaceId(selectedId),
                            ),
                        );
                        this.props.clipboard.setClipboard(xs => removeIndex(xs, ix));
                        if (selected) this.addToClipboard(selected);
                    }
                } else {
                    console.log("Did not handle", event.key);
                    return; // Do not prevent the early default below.
                }
        }
        event.preventDefault();
    };

    private createSiblingBlank() {
        const siblingId = this.state.selection;
        if (siblingId == null) return;

        const parent = this.expr.parentOf(siblingId);
        const blank = new E.Blank();

        // Special case: wrap the expr in a list.
        if (parent == null) {
            this.update(expr => new E.List([expr, blank]));
            this.setState({ selection: blank.id });
            return;
        }

        let next: Expr;
        if (parent instanceof E.Call) {
            const ix = parent.args.findIndex(x => x.id === siblingId);
            next = new E.Call(parent.fn, insertIndex(parent.args, ix, blank), parent.data);
        } else if (parent instanceof E.List) {
            const ix = parent.list.findIndex(x => x.id === siblingId);
            next = new E.List(insertIndex(parent.list, ix, blank), parent.data);
        } else {
            return; // Bail out early.
        }
        this.update(expr => expr.replace(parent.id, next));
        this.setState({ selection: blank.id });
    }

    private readonly createChildBlank = (parentId: ExprId) => {
        const parent = this.expr.withId(parentId);
        const blank = new E.Blank();
        let next: Expr;
        if (parent instanceof E.Call) {
            next = new E.Call(parent.fn, parent.args.concat(blank), parent.data);
        } else if (parent instanceof E.List) {
            next = new E.List(parent.list.concat(blank), parent.data);
        } else {
            return; // Bail out early.
        }
        this.update(expr => expr.replace(parentId, next));
        this.setState({ selection: blank.id });
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
        if (this.props.stealFocus) this.containerRef.current?.focus();
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
                    onClickCreateCircle={this.createChildBlank}
                    foldComments={this.state.foldingComments}
                />
            </div>
        );
    }
}

export default function EditorWrapper(props: EditorWrapperProps) {
    return (
        <Editor
            {...props}
            workspace={assertSome(useContext(Workspace))}
            clipboard={assertSome(useContext(Clipboard))}
        />
    );
}
