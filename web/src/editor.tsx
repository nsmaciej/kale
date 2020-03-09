import React, { Component, useContext } from "react";
import { useTheme } from "styled-components";

import * as E from "expr";
import Expr, { ExprId } from "expr";
import ExprView, { ExprAreaMap } from "expr_view";
import { Optional, assertSome, insertIndex, reverseObject, assert } from "utils";
import { Clipboard, Workspace, ClipboardValue, WorkspaceValue } from "workspace";
import { KaleTheme } from "theme";
import { ContextMenuItem } from "components/context_menu";

interface EditorState {
    focused: boolean;
    selection: ExprId;
    foldingComments: boolean;
}

interface EditorWrapperProps {
    stealFocus?: boolean;
    topLevelName: string;
}

interface EditorProps extends EditorWrapperProps {
    workspace: WorkspaceValue;
    clipboard: ClipboardValue;
    theme: KaleTheme;
}

type SelectionFunction = (expr: Expr, sel: ExprId) => Optional<ExprId>;

const selectNextBlank: SelectionFunction = (expr, sel) => {
    const blanks = expr.findAll(x => x instanceof E.Blank);
    const ix = blanks.findIndex(x => x.id === sel);
    if (ix === -1) return blanks[0].id;
    return blanks[(ix + 1) % blanks.length].id;
};

const selectParent: SelectionFunction = (expr, sel) => {
    return expr.parentOf(sel)?.id;
};

const selectLeftSibling: SelectionFunction = (expr, sel) => {
    const [siblings, ix] = expr.siblings(sel);
    if (ix == null || ix === 0) return null;
    return siblings[ix - 1]?.id;
};

const selectRightSibling: SelectionFunction = (expr, sel) => {
    const [siblings, ix] = expr.siblings(sel);
    if (ix == null) return null;
    return siblings[ix + 1]?.id;
};

const selectFirstChild: SelectionFunction = (expr, sel) => {
    return expr.withId(sel)?.children()[0]?.id;
};

function smartSelection(
    first: SelectionFunction,
    fallback?: Optional<SelectionFunction>,
    parentFallback = first,
): SelectionFunction {
    return (expr, sel) => {
        // Try the first selection function or its fallback.
        const simple = first(expr, sel) ?? fallback?.(expr, sel);
        if (simple != null) return simple;
        // Otherwise try using the parentFallback on each parent.
        for (const parent of expr.parents(sel)) {
            const next = parentFallback(expr, parent.id);
            if (next != null) return next;
        }
        return null;
    };
}

const selectRightSiblingSmart = smartSelection(selectRightSibling, selectFirstChild);
const selectLeftSiblingSmart = smartSelection(selectLeftSibling, selectParent);
const selectFirstChildSmart = smartSelection(selectFirstChild, null, selectRightSibling);
const selectParentSmart = smartSelection(selectParent, null, selectLeftSibling);

class Editor extends Component<EditorProps, EditorState> {
    private readonly containerRef = React.createRef<HTMLDivElement>();
    private readonly exprAreaMapRef = React.createRef<ExprAreaMap>();

    state: EditorState = {
        selection: this.expr.id,
        focused: this.props.stealFocus ?? false,
        foldingComments: false,
    };

    private update(updater: (expr: Expr) => Expr) {
        this.props.workspace.setTopLevel(this.props.topLevelName, expr => updater(expr));
    }

    private get expr() {
        return this.props.workspace.getTopLevel(this.props.topLevelName);
    }

    private addToClipboard(expr: Expr) {
        this.props.clipboard.add({ expr, pinned: false });
    }

    private addExprToClipboard(expr: ExprId) {
        const selected = this.expr.withId(expr);
        if (selected) this.addToClipboard(selected);
    }

    private removeExpr(sel: ExprId) {
        this.update(expr => expr.remove(sel) ?? new E.Blank(E.exprData("Double click me")));
    }

    private setSelection(reducer: SelectionFunction) {
        this.setState(state => ({
            selection: reducer(this.expr, state.selection) ?? state.selection,
        }));
    }

    private setSmartSelection(expr: ExprId, direction: "up" | "down" | "left" | "right") {
        const inline = this.exprAreaMapRef.current?.[expr]?.inline;
        if (direction === "up") {
            this.setSelection(inline ? selectParentSmart : selectLeftSiblingSmart);
        } else if (direction === "down") {
            this.setSelection(inline ? selectFirstChildSmart : selectRightSiblingSmart);
        } else if (direction === "left") {
            this.setSelection(inline ? selectLeftSiblingSmart : selectParentSmart);
        } else if (direction === "right") {
            this.setSelection(inline ? selectRightSiblingSmart : selectFirstChildSmart);
        }
    }

    private replaceExpr(old: ExprId, next: Expr) {
        this.update(expr => expr.replace(old, next.resetIds().replaceId(old)));
    }

    private buildPasteAction(ix: number): (expr: ExprId) => void {
        return expr => {
            const clipboard = this.props.clipboard.clipboard;
            if (ix < clipboard.length) {
                this.replaceExpr(expr, clipboard[ix].expr);
                this.props.clipboard.use(clipboard[ix].expr.id);
            }
        };
    }

    private readonly actions = {
        delete: (e: ExprId) => this.removeExpr(e),
        replace: (e: ExprId) => this.replaceExpr(e, new E.Blank()),
        move: (e: ExprId) => {
            this.addExprToClipboard(e);
            this.removeExpr(e);
        },
        shuffle: (e: ExprId) => {
            this.addExprToClipboard(e);
            this.replaceExpr(e, new E.Blank());
        },
        copy: (e: ExprId) => this.addExprToClipboard(e),
        append: (e: ExprId) => this.createChildBlank(e),
        insert: (e: ExprId) => this.createSiblingBlank(e),
        foldComments: () => this.setState(state => ({ foldingComments: !state.foldingComments })),
        comment: (e: ExprId) => {
            const selected = this.expr.withId(e);
            if (selected != null) {
                const comment = prompt("Comment?", selected.data.comment) ?? undefined;
                this.update(expr => expr.assignToDataWithId(e, { comment }));
            }
        },
        disable: (e: ExprId) => {
            this.update(expr =>
                assertSome(
                    expr.update(e, x => {
                        if (x instanceof E.Blank) return x;
                        return x.assignToData({ disabled: !x.data.disabled });
                    }),
                ),
            );
        },
    };

    // See https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values.
    private readonly menuKeys: { [key: string]: keyof Editor["actions"] } = {
        d: "delete",
        r: "replace",
        m: "move",
        s: "shuffle",
        c: "copy",
        a: "append",
        i: "insert",
        "#": "foldComments",
        q: "comment",
        "/": "disable",
    };

    // The shortcuts only accessible from the keyboard.
    private readonly hiddenKeys: { [key: string]: (sel: ExprId) => void } = {
        h: e => this.setSmartSelection(e, "left"),
        j: e => this.setSmartSelection(e, "down"),
        k: e => this.setSmartSelection(e, "up"),
        l: e => this.setSmartSelection(e, "right"),
        Tab: () => this.setSelection(selectNextBlank),
        ArrowUp: e => this.setSmartSelection(e, "up"),
        ArrowDown: e => this.setSmartSelection(e, "down"),
        ArrowLeft: e => this.setSmartSelection(e, "left"),
        ArrowRight: e => this.setSmartSelection(e, "right"),
        "1": this.buildPasteAction(0),
        "2": this.buildPasteAction(1),
        "3": this.buildPasteAction(2),
        "4": this.buildPasteAction(3),
        "5": this.buildPasteAction(4),
        "6": this.buildPasteAction(5),
        "7": this.buildPasteAction(6),
        "8": this.buildPasteAction(7),
        "9": this.buildPasteAction(9),
        "0": this.buildPasteAction(9),
    };

    private readonly exprMenu: Optional<{ label: string; action: keyof Editor["actions"] }>[] = [
        { action: "delete", label: "Delete" },
        { action: "move", label: "Delete and Copy" },
        { action: "replace", label: "Replace" },
        { action: "shuffle", label: "Replace and Copy" },
        null,
        { action: "copy", label: "Copy" },
        null,
        { action: "append", label: "Append a Blank" },
        { action: "insert", label: "Insert a Blank" },
        null,
        { action: "comment", label: "Comment..." },
        { action: "disable", label: "Disable" },
        { action: "foldComments", label: "Fold Comments" },
    ];

    private readonly menuKeyForAction = reverseObject(this.menuKeys);
    contextMenuFor = (expr: ExprId): ContextMenuItem[] => {
        return this.exprMenu.map((item, i) => ({
            id: item?.action ?? i.toString(),
            label: item?.label,
            action: item?.action && (() => this.actions[item.action](expr)),
            keyEquivalent: item?.action && this.menuKeyForAction[item.action],
        }));
    };

    private readonly keyDown = (event: React.KeyboardEvent) => {
        // Do not handle modifier keys.
        if (event.ctrlKey || event.altKey || event.metaKey) return;
        const key = event.key;
        if (Object.prototype.hasOwnProperty.call(this.menuKeys, key)) {
            this.actions[this.menuKeys[key]](this.state.selection);
            event.preventDefault();
        } else if (Object.prototype.hasOwnProperty.call(this.hiddenKeys, key)) {
            this.hiddenKeys[key](this.state.selection);
            event.preventDefault();
        } else {
            console.log("Did not handle", event.key);
        }
    };

    private createSiblingBlank(target: ExprId) {
        const parent = this.expr.parentOf(target);
        const blank = new E.Blank();

        // Special case: wrap the expr in a list.
        if (parent == null) {
            this.update(expr => new E.List([expr, blank]));
            this.setState({ selection: blank.id });
            return;
        }

        let next: Expr;
        if (parent instanceof E.Call) {
            const ix = parent.args.findIndex(x => x.id === target);
            next = new E.Call(parent.fn, insertIndex(parent.args, ix, blank), parent.data);
        } else if (parent instanceof E.List) {
            const ix = parent.list.findIndex(x => x.id === target);
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

    private readonly focusChanged = () => {
        this.setState({ focused: document.activeElement?.id === "editor" });
    };

    componentDidMount() {
        if (this.props.stealFocus) this.containerRef.current?.focus();
    }

    componentDidUpdate(prevProps: EditorProps) {
        assert(
            prevProps.topLevelName === this.props.topLevelName,
            "Use a key to create a new Editor component instead",
        );
        // This ensures the selection is always valid. Find the closest existing parent.
        if (!this.expr.contains(this.state.selection)) {
            // We cannot use getTopLevel here because it doesn't use the older topLevel value.
            const prevExpr = prevProps.workspace.topLevel[prevProps.topLevelName] ?? new E.Blank();
            const [siblings, ix] = prevExpr.siblings(this.state.selection);
            const candidates: Expr[][] = [];
            if (ix != null) {
                candidates.push(siblings.slice(ix + 1));
                candidates.push(siblings.slice(0, ix));
            }
            candidates.push(prevExpr.parents(this.state.selection));
            for (const option of candidates.flat()) {
                if (this.expr.contains(option.id)) {
                    this.setState({ selection: option.id });
                    return;
                }
            }
            this.setState({ selection: this.expr.id }); // Last resort.
        }
    }

    render() {
        return (
            <div
                onKeyDown={this.keyDown}
                tabIndex={0}
                ref={this.containerRef}
                onBlur={this.focusChanged}
                onFocus={this.focusChanged}
                id="editor"
            >
                <ExprView
                    expr={this.expr}
                    selection={this.state.selection}
                    focused={this.state.focused}
                    foldComments={this.state.foldingComments}
                    theme={this.props.theme}
                    exprAreaMapRef={this.exprAreaMapRef}
                    // Callbacks.
                    contextMenuFor={this.contextMenuFor}
                    onClick={this.exprSelected}
                    onClickCreateCircle={this.createChildBlank}
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
            theme={assertSome(useTheme())}
        />
    );
}
