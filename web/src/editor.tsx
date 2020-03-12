import React, { Component, useContext } from "react";
import { useTheme } from "styled-components";

import * as E from "expr";
import * as Select from "selection";
import Expr, { ExprId } from "expr";
import ExprView, { ExprAreaMap } from "expr_view";
import { Optional, assertSome, insertIndex, reverseObject, assert } from "utils";
import { Clipboard, ClipboardValue } from "contexts/clipboard";
import { Workspace, WorkspaceValue } from "contexts/workspace";
import { KaleTheme } from "theme";
import { Type, Func } from "vm/types";

import { ContextMenuItem } from "components/context_menu";
import InlineEditor from "components/inline_editor";

interface EditorState {
    focused: boolean;
    selection: ExprId;
    foldingComments: boolean;
    editing: Optional<{ expr: ExprId; value: string }>;
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

class Editor extends Component<EditorProps, EditorState> {
    private readonly containerRef = React.createRef<HTMLDivElement>();
    private readonly exprAreaMapRef = React.createRef<ExprAreaMap>();

    state: EditorState = {
        selection: this.expr.id,
        focused: this.props.stealFocus ?? false,
        foldingComments: false,
        editing: null,
    };

    private update(child: Optional<ExprId>, updater: (expr: Expr) => Optional<Expr>) {
        this.props.workspace.setTopLevel(
            this.props.topLevelName,
            expr =>
                expr.update(child ?? expr.id, updater) ??
                new E.Blank(E.exprData("Double click me")),
        );
    }

    private get expr(): Expr {
        const func = this.props.workspace.getTopLevel(this.props.topLevelName);
        assert(func.type === Type.Func);
        return (func.value as Func).expr;
    }

    private addToClipboard(expr: Expr) {
        this.props.clipboard.add({ expr, pinned: false });
    }

    private addExprToClipboard(expr: ExprId) {
        const selected = this.expr.withId(expr);
        if (selected) this.addToClipboard(selected);
    }

    private removeExpr(sel: ExprId) {
        this.update(sel, () => null);
    }

    private selectionAction(reducer: Select.SelectFn): () => void {
        return () =>
            this.setState(state => ({
                selection:
                    reducer(this.expr, state.selection, assertSome(this.exprAreaMapRef.current)) ??
                    this.expr.id,
            }));
    }

    private replaceExpr(old: ExprId, next: Expr) {
        this.update(old, () => next.resetIds().replaceId(old));
    }

    private pasteAction(ix: number): () => void {
        return () => {
            const clipboard = this.props.clipboard.clipboard;
            if (ix < clipboard.length) {
                this.replaceExpr(this.state.selection, clipboard[ix].expr);
                this.props.clipboard.use(clipboard[ix].expr.id);
            }
        };
    }

    private replaceAndEdit(expr: ExprId, next: Expr) {
        // Replace expr but using the callback.
        this.replaceExpr(expr, next);
        //TODO: No.
        // ReplaceExpr will re-use the expr ID.
        this.forceUpdate(() => this.startEditing(expr));
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
        insertBefore: (e: ExprId) => this.createSiblingBlank(e, true),
        foldComments: () => this.setState(state => ({ foldingComments: !state.foldingComments })),
        comment: (e: ExprId) => {
            const selected = this.expr.withId(e);
            if (selected != null) {
                const comment = prompt("Comment?", selected.data.comment) ?? undefined;
                this.update(e, expr => expr.assignToData({ comment }));
            }
        },
        disable: (e: ExprId) => {
            this.update(e, expr => {
                if (expr instanceof E.Blank) return expr;
                return expr.assignToData({ disabled: !expr.data.disabled });
            });
        },
        edit: (e: ExprId) => this.startEditing(e),
        // Demo things that should be moved to the toy-box.
        demoAddCall: (e: ExprId) => this.replaceAndEdit(e, new E.Call("")),
        demoAddVariable: (e: ExprId) => this.replaceAndEdit(e, new E.Variable("")),
        demoAddString: (e: ExprId) => this.replaceAndEdit(e, new E.Literal("", "str")),
    };

    // See https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values.
    private readonly menuKeys: { [key: string]: keyof Editor["actions"] } = {
        "/": "disable",
        "#": "foldComments",
        a: "append",
        c: "copy",
        d: "delete",
        f: "demoAddCall",
        i: "insert",
        I: "insertBefore",
        g: "demoAddString",
        m: "move",
        q: "comment",
        r: "replace",
        s: "shuffle",
        v: "demoAddVariable",
        Enter: "edit",
    };

    // The shortcuts only accessible from the keyboard.
    private readonly hiddenKeys: { [key: string]: (sel: ExprId) => void } = {
        h: this.selectionAction(Select.leftSmart),
        j: this.selectionAction(Select.downSmart),
        k: this.selectionAction(Select.upSmart),
        l: this.selectionAction(Select.rightSmart),
        p: this.selectionAction(Select.parent),
        H: this.selectionAction(Select.leftSiblingSmart),
        L: this.selectionAction(Select.rightSiblingSmart),
        Tab: this.selectionAction(Select.nextBlank),
        ArrowUp: this.selectionAction(Select.upSmart),
        ArrowDown: this.selectionAction(Select.downSmart),
        ArrowLeft: this.selectionAction(Select.leftSmart),
        ArrowRight: this.selectionAction(Select.rightSmart),
        "1": this.pasteAction(0),
        "2": this.pasteAction(1),
        "3": this.pasteAction(2),
        "4": this.pasteAction(3),
        "5": this.pasteAction(4),
        "6": this.pasteAction(5),
        "7": this.pasteAction(6),
        "8": this.pasteAction(7),
        "9": this.pasteAction(9),
        "0": this.pasteAction(9),
    };

    private readonly exprMenu: Optional<{ label: string; action: keyof Editor["actions"] }>[] = [
        { action: "delete", label: "Delete" },
        { action: "move", label: "Delete and Copy" },
        { action: "replace", label: "Replace" },
        { action: "shuffle", label: "Replace and Copy" },
        null,
        { action: "copy", label: "Copy" },
        { action: "edit", label: "Edit..." },
        null,
        { action: "append", label: "Append Argument" },
        { action: "insert", label: "New Line" },
        { action: "insertBefore", label: "New Line Before" },
        null,
        { action: "comment", label: "Comment..." },
        { action: "disable", label: "Disable" },
        { action: "foldComments", label: "Fold Comments" },
        null,
        { action: "demoAddCall", label: "Add a Call" },
        { action: "demoAddVariable", label: "Add a Variable" },
        { action: "demoAddString", label: "Add a String" },
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

    private createSiblingBlank(target: ExprId, insertBefore = false) {
        const blank = new E.Blank();
        const currentParent = this.expr.parentOf(target)?.id;
        if (currentParent == null) {
            this.update(null, main => new E.List(insertBefore ? [blank, main] : [main, blank]));
        } else {
            this.update(currentParent, parent => {
                if (parent instanceof E.Call) {
                    const ix = parent.args.findIndex(x => x.id === target);
                    return new E.Call(
                        parent.fn,
                        insertIndex(parent.args, ix - +insertBefore, blank),
                        parent.data,
                    );
                } else if (parent instanceof E.List) {
                    const ix = parent.list.findIndex(x => x.id === target);
                    return new E.List(
                        insertIndex(parent.list, ix - +insertBefore, blank),
                        parent.data,
                    );
                }
                return parent;
            });
        }
        this.setState({ selection: blank.id });
    }

    private readonly createChildBlank = (parentId: ExprId) => {
        const blank = new E.Blank();
        this.update(parentId, parent => {
            if (parent instanceof E.Call) {
                return new E.Call(parent.fn, parent.args.concat(blank), parent.data);
            } else if (parent instanceof E.List) {
                return new E.List(parent.list.concat(blank), parent.data);
            }
            return parent;
        });
        this.setState({ selection: blank.id });
    };

    private readonly exprSelected = (selection: ExprId) => {
        this.setState({ selection });
    };

    private readonly focusChanged = () => {
        this.setState({ focused: document.activeElement?.id === "editor" });
    };

    private readonly startEditing = (expr: ExprId) => {
        const value = this.expr.withId(expr)?.value();
        if (value != null) {
            this.setState({ editing: { expr, value } });
        }
    };

    componentDidMount() {
        if (this.props.stealFocus) this.focus();
    }

    componentDidUpdate(prevProps: EditorProps) {
        assert(
            prevProps.topLevelName === this.props.topLevelName,
            "Use a key to create a new Editor component instead",
        );
        // This ensures the selection is always valid. Find the closest existing parent.
        if (!this.expr.contains(this.state.selection)) {
            // We cannot use getTopLevel here because it doesn't use the older topLevel value.
            //TODO: Fix that.
            const prevExprUnchecked = prevProps.workspace.topLevel.get(prevProps.topLevelName);
            assert(prevExprUnchecked == null || prevExprUnchecked.type === Type.Func);
            const prevExpr = (prevExprUnchecked as Optional<Func>)?.expr ?? new E.Blank();
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

    constructor(props: EditorProps) {
        super(props);
        for (const shortcut of Object.keys(this.menuKeys)) {
            assert(!(shortcut in this.hiddenKeys), "Shortcut conflict");
        }
    }

    private stopEditing() {
        this.setState({ editing: null });
        this.focus();
    }

    private readonly focus = () => {
        this.containerRef.current?.focus();
    };

    renderInlineEditor() {
        if (this.exprAreaMapRef.current == null || this.state.editing == null) return;
        return (
            <InlineEditor
                exprArea={this.exprAreaMapRef.current[this.state.editing.expr]}
                value={this.state.editing.value}
                onChange={value => {
                    if (this.state.editing != null) {
                        this.update(this.state.editing.expr, x => x.withValue(value));
                        this.setState({ editing: { ...this.state.editing, value } });
                    }
                }}
                onDismiss={() => this.stopEditing()}
                onSubmit={value => {
                    this.update(this.state.editing?.expr, x => x.withValue(value));
                    this.stopEditing();
                }}
            />
        );
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
                // Needed for positioning the inline editor.
                style={{ position: "relative" }}
            >
                <ExprView
                    expr={this.expr}
                    selection={this.state.selection}
                    focused={this.state.focused}
                    foldComments={this.state.foldingComments}
                    theme={this.props.theme}
                    exprAreaMapRef={this.exprAreaMapRef}
                    forceInline={{}}
                    // Callbacks.
                    contextMenuFor={this.contextMenuFor}
                    onClick={this.exprSelected}
                    onDoubleClick={this.startEditing}
                    onClickCreateCircle={this.createChildBlank}
                    onFocus={this.focus}
                />
                {this.renderInlineEditor()}
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
