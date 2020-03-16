import React, { Component, Ref, useContext } from "react";
import { useTheme } from "styled-components";
import produce from "immer";

import * as E from "expr";
import * as Select from "selection";
import Expr, { ExprId } from "expr";
import ExprView, { ExprAreaMap } from "expr_view";
import { Optional, assertSome, reverseObject, assert } from "utils";
import { KaleTheme } from "theme";

import { Type, Func, assertFunc } from "vm/types";
import { specialFunctions } from "vm/interpreter";

import { Clipboard, ClipboardValue } from "contexts/clipboard";
import { Workspace, WorkspaceValue } from "contexts/workspace";

import { ContextMenuItem } from "components/context_menu";
import InlineEditor from "components/inline_editor";

interface EditorState {
    focused: boolean;
    selection: ExprId;
    foldingComments: boolean;
    editing: Optional<{ expr: ExprId; created: boolean }>;
}

interface EditorWrapperProps {
    topLevelName: string;
}

interface EditorProps extends EditorWrapperProps {
    workspace: WorkspaceValue;
    clipboard: ClipboardValue;
    theme: KaleTheme;
    forwardedRef: Ref<HTMLDivElement>;
}

class Editor extends Component<EditorProps, EditorState> {
    private readonly containerRef = React.createRef<HTMLDivElement>();
    private readonly exprAreaMapRef = React.createRef<ExprAreaMap>();

    state: EditorState = {
        selection: this.expr.id,
        focused: false,
        foldingComments: false,
        editing: null,
    };

    private get expr(): Expr {
        const func = this.props.workspace.get(this.props.topLevelName);
        assert(func.type === Type.Func);
        return (func.value as Func).expr;
    }

    // Editor internal APIs.
    private update(child: Optional<ExprId>, updater: (expr: Expr) => Optional<Expr>) {
        this.props.workspace.update(
            this.props.topLevelName,
            expr =>
                expr.update(child ?? expr.id, updater) ??
                new E.Blank(E.exprData("Double click me")),
        );
    }

    private addToClipboard(expr: ExprId) {
        const selected = this.expr.withId(expr);
        if (selected) {
            this.props.clipboard.add({ expr: selected, pinned: false });
        }
    }

    private removeExpr(sel: ExprId) {
        this.update(sel, () => null);
    }

    private replaceExpr(old: ExprId, next: Expr) {
        this.update(old, () => next.resetIds().replaceId(old));
    }

    private createInlineEditor(exprId: ExprId, created: boolean) {
        const expr = this.expr.withId(exprId);
        // Only things with a value can be edited.
        if (expr != null && expr.value() != null) {
            this.setState({ editing: { expr: exprId, created } });
        }
    }

    private stopEditing(newValue: Optional<string>) {
        // This will disable rendering the inline-editor, preventing it from firing onBlur.
        this.setState({ editing: null }, () => this.focus());

        const { expr: exprId, created } = assertSome(this.state.editing);
        const expr = this.expr.withId(exprId);
        const value = newValue ?? expr?.value();
        if (!value) {
            // If empty (or null for some reason).
            this.replaceExpr(exprId, new E.Blank());
            return;
        }
        this.update(exprId, x => x.withValue(value));

        if (created && expr instanceof E.Call) {
            // Auto-insert the right amount of blanks for this function.
            // Note at this point expr still might have some old value.
            const func = this.props.workspace.globals.get(value)?.value;
            if (func != null && !specialFunctions.has(value)) {
                const blanks = (func.args as (string | null)[]).map(
                    x => new E.Blank(E.exprData(x)),
                );
                blanks.forEach(arg => this.insertAsChildOf(exprId, arg, true));
                console.log(blanks, blanks[0]);
                this.selectExpr(blanks[0].id);
            }
        } else if (expr != null && newValue != null) {
            // Auto-select the next sibling (if we submitted).
            const [siblings, ix] = this.expr.siblings(expr.id);
            if (ix != null && ix + 1 < siblings.length) {
                this.selectExpr(siblings[ix + 1].id);
            }
        }
    }

    private replaceAndEdit(expr: ExprId, next: Expr) {
        // Replace expr but using the callback.
        this.replaceExpr(expr, next);
        //TODO: Remove this.
        // ReplaceExpr will re-use the expr ID.
        this.forceUpdate(() => this.createInlineEditor(expr, true));
    }

    private insertBlankAsSiblingOf(target: ExprId, right: boolean) {
        this.selectAndInsertAsSiblingOf(target, new E.Blank(), right);
    }

    // Complex functions.
    private insertAsChildOf(target: ExprId, toInsert: Expr, last: boolean) {
        function updateList(list: readonly Expr[]) {
            return last ? [...list, toInsert] : [toInsert, ...list];
        }
        this.update(target, parent => {
            if (parent instanceof E.Call) {
                return new E.Call(parent.fn, updateList(parent.args), parent.data);
            } else if (parent instanceof E.List) {
                return new E.List(updateList(parent.list), parent.data);
            }
            return parent;
        });
    }

    private selectAndInsertAsSiblingOf(sibling: ExprId, toInsert: Expr, right: boolean) {
        const currentParent = this.expr.parentOf(sibling)?.id;
        const ixDelta = right ? 1 : 0;

        if (currentParent == null) {
            this.update(null, main => new E.List(right ? [main, toInsert] : [toInsert, main]));
            this.selectExpr(toInsert.id);
            return;
        }

        this.update(currentParent, parent => {
            if (parent instanceof E.Call) {
                const ix = parent.args.findIndex(x => x.id === sibling);
                return new E.Call(
                    parent.fn,
                    produce(parent.args, draft => void draft.splice(ix + ixDelta, 0, toInsert)),
                    parent.data,
                );
            } else if (parent instanceof E.List) {
                const ix = parent.list.findIndex(x => x.id === sibling);
                return new E.List(
                    produce(parent.list, draft => void draft.splice(ix + ixDelta, 0, toInsert)),
                    parent.data,
                );
            }
            // Parent always has to be one of these.
            throw new E.UnvisitableExpr(parent);
        });
        this.selectExpr(toInsert.id);
    }

    // Actions.
    private selectionAction(reducer: Select.SelectFn): () => void {
        return () =>
            this.setState(state => ({
                selection:
                    reducer(this.expr, state.selection, assertSome(this.exprAreaMapRef.current)) ??
                    state.selection,
            }));
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

    private readonly smartSpace = (target: ExprId) => {
        const expr = this.expr.withId(target);
        if (expr instanceof E.Call || expr instanceof E.List) {
            const blank = new E.Blank();
            this.insertAsChildOf(target, blank, false);
            this.selectExpr(blank.id);
        } else if (expr instanceof E.Blank) {
            // Kinda like slurp. We don't create a new blank, rather move this one around.
            const parent = this.expr.parentOf(target);
            if (parent != null) {
                // Do not stack top-level lists.
                if (this.expr.parentOf(parent.id) == null && this.expr instanceof E.List) return;
                this.removeExpr(target);
                this.selectAndInsertAsSiblingOf(parent.id, expr, true);
            }
        } else {
            this.insertBlankAsSiblingOf(target, true);
        }
    };

    private readonly actions = {
        delete: (e: ExprId) => this.removeExpr(e),
        replace: (e: ExprId) => this.replaceExpr(e, new E.Blank()),
        move: (e: ExprId) => {
            this.addToClipboard(e);
            this.removeExpr(e);
        },
        shuffle: (e: ExprId) => {
            this.addToClipboard(e);
            this.replaceExpr(e, new E.Blank());
        },
        copy: (e: ExprId) => this.addToClipboard(e),
        append: (e: ExprId) => this.createChildBlank(e),
        insert: (e: ExprId) => this.insertBlankAsSiblingOf(e, true),
        insertBefore: (e: ExprId) => this.insertBlankAsSiblingOf(e, false),
        foldComments: () => this.setState(state => ({ foldingComments: !state.foldingComments })),
        comment: (e: ExprId) => {
            const selected = this.expr.withId(e);
            if (selected != null) {
                // Empty string _should_ be null.
                const comment = prompt("Comment?", selected.data.comment ?? "") || null;
                this.update(e, expr => expr.assignToData({ comment: comment }));
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
        demoAddString: (e: ExprId) => this.replaceAndEdit(e, new E.Literal("", Type.Str)),
    };

    // See https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values.
    // Keep these sorted.
    private readonly menuKeyEquivalents: { [key: string]: keyof Editor["actions"] } = {
        "/": "disable",
        "#": "foldComments",
        a: "append",
        c: "copy",
        d: "delete",
        Enter: "edit",
        f: "demoAddCall",
        g: "demoAddString",
        i: "insert",
        I: "insertBefore",
        m: "move",
        q: "comment",
        r: "replace",
        s: "shuffle",
        v: "demoAddVariable",
    };

    // The shortcuts only accessible from the keyboard.
    // Keep these sorted.
    private readonly editorShortcuts: { [key: string]: (sel: ExprId) => void } = {
        " ": this.smartSpace,
        "0": this.pasteAction(9),
        "1": this.pasteAction(0),
        "2": this.pasteAction(1),
        "3": this.pasteAction(2),
        "4": this.pasteAction(3),
        "5": this.pasteAction(4),
        "6": this.pasteAction(5),
        "7": this.pasteAction(6),
        "8": this.pasteAction(7),
        "9": this.pasteAction(9),
        ArrowDown: this.selectionAction(Select.downSmart),
        ArrowLeft: this.selectionAction(Select.leftSmart),
        ArrowRight: this.selectionAction(Select.rightSmart),
        ArrowUp: this.selectionAction(Select.upSmart),
        H: this.selectionAction(Select.leftSiblingSmart),
        h: this.selectionAction(Select.leftSmart),
        j: this.selectionAction(Select.downSmart),
        k: this.selectionAction(Select.upSmart),
        L: this.selectionAction(Select.rightSiblingSmart),
        l: this.selectionAction(Select.rightSmart),
        p: this.selectionAction(Select.parent),
        Tab: this.selectionAction(Select.nextBlank),
    };

    private readonly exprMenu: Optional<{ label: string; action: keyof Editor["actions"] }>[] = [
        { action: "edit", label: "Edit..." },
        { action: "copy", label: "Copy" },
        null,
        { action: "delete", label: "Delete" },
        { action: "move", label: "Delete and Copy" },
        { action: "replace", label: "Replace" },
        { action: "shuffle", label: "Replace and Copy" },
        null,
        { action: "append", label: "Add Argument" },
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

    // Bound methods.
    private readonly menuKeyEquivalentForAction = reverseObject(this.menuKeyEquivalents);
    contextMenuFor = (expr: ExprId): ContextMenuItem[] => {
        return this.exprMenu.map((item, i) => ({
            id: item?.action ?? i.toString(),
            label: item?.label,
            action: item?.action && (() => this.actions[item.action](expr)),
            keyEquivalent: item?.action && this.menuKeyEquivalentForAction[item.action],
        }));
    };

    private readonly keyDown = (event: React.KeyboardEvent) => {
        // Do not handle modifier keys.
        if (event.ctrlKey || event.altKey || event.metaKey) return;
        const key = event.key;
        if (Object.prototype.hasOwnProperty.call(this.menuKeyEquivalents, key)) {
            this.actions[this.menuKeyEquivalents[key]](this.state.selection);
            event.preventDefault();
        } else if (Object.prototype.hasOwnProperty.call(this.editorShortcuts, key)) {
            this.editorShortcuts[key](this.state.selection);
            event.preventDefault();
        } else {
            console.log("Did not handle", event.key);
        }
    };

    private readonly createChildBlank = (parentId: ExprId) => {
        const blank = new E.Blank();
        this.insertAsChildOf(parentId, blank, true);
        this.selectExpr(blank.id);
    };

    private readonly selectExpr = (selection: ExprId) => {
        this.setState({ selection });
    };

    private readonly startEditing = (expr: ExprId) => {
        this.createInlineEditor(expr, false);
    };

    private readonly focus = () => {
        this.containerRef.current?.focus();
    };

    // This seems messy but it's the only way https://github.com/facebook/react/issues/13029
    private readonly attachRef = (element: HTMLDivElement) => {
        (this.containerRef as React.MutableRefObject<HTMLDivElement>).current = element;
        const { forwardedRef } = this.props;
        if (typeof forwardedRef === "function") {
            forwardedRef(element);
        } else if (forwardedRef != null) {
            (forwardedRef as React.MutableRefObject<HTMLDivElement>).current = element;
        }
    };

    private readonly onFocusEvent = (event: React.FocusEvent) => {
        if (event.target === this.containerRef.current) {
            this.setState({ focused: event.type === "focus" });
        }
    };

    componentDidUpdate(prevProps: EditorProps, prevState: EditorState) {
        assert(
            prevProps.topLevelName === this.props.topLevelName,
            "Use a key to create a new Editor component instead",
        );
        if (this.expr.contains(this.state.selection)) return;
        // Ensure the selection is always valid.
        const prevExpr = assertFunc(prevProps.workspace.get(prevProps.topLevelName)).expr;
        const candidates: Expr[][] = [];

        // Maybe we just tried updating the selection to something that doesn't exist. Use the
        // old selection instead.
        const oldSelection = prevExpr.withId(prevState.selection);
        if (oldSelection != null) {
            candidates.push([oldSelection]);
        }
        // Try the siblings, going forward then back.
        const [siblings, ix] = prevExpr.siblings(this.state.selection);
        if (ix != null) {
            candidates.push(siblings.slice(ix + 1));
            candidates.push(siblings.slice(0, ix).reverse());
        }
        // Finally consider all the parents.
        candidates.push(prevExpr.parents(this.state.selection));
        for (const option of candidates.flat()) {
            if (this.expr.contains(option.id)) {
                this.selectExpr(option.id);
                return;
            }
        }
        this.selectExpr(this.expr.id); // Last resort.
    }

    constructor(props: EditorProps) {
        super(props);
        for (const shortcut of Object.keys(this.menuKeyEquivalents)) {
            assert(!(shortcut in this.editorShortcuts), "Shortcut conflict");
        }
        assert(!specialFunctions.has(props.topLevelName), "Cannot edit special functions");
    }

    renderInlineEditor() {
        if (this.exprAreaMapRef.current == null || this.state.editing == null) return;
        const exprId = this.state.editing.expr;
        const expr = assertSome(this.expr.withId(exprId));
        return (
            <InlineEditor
                exprArea={this.exprAreaMapRef.current[exprId]}
                value={assertSome(expr.value())}
                disableSuggestions={!(expr instanceof E.Call)}
                onChange={value => {
                    this.update(exprId, x => x.withValue(value));
                }}
                onDismiss={() => this.stopEditing(null)}
                onSubmit={value => this.stopEditing(value)}
            />
        );
    }

    render() {
        return (
            <div
                onKeyDown={this.keyDown}
                tabIndex={0}
                ref={this.attachRef}
                onFocus={this.onFocusEvent}
                onBlur={this.onFocusEvent}
                // Needed for positioning the inline editor.
                style={{ position: "relative" }}
            >
                <ExprView
                    // This is heavy pure component, don't create new objects.
                    expr={this.expr}
                    selection={this.state.selection}
                    focused={this.state.focused}
                    foldComments={this.state.foldingComments}
                    theme={this.props.theme}
                    exprAreaMapRef={this.exprAreaMapRef}
                    // Callbacks.
                    contextMenuFor={this.contextMenuFor}
                    onClick={this.selectExpr}
                    onDoubleClick={this.startEditing}
                    onClickCreateCircle={this.createChildBlank}
                    onFocus={this.focus}
                />
                {this.renderInlineEditor()}
            </div>
        );
    }
}

export default React.forwardRef(function EditorWrapper(
    props: EditorWrapperProps,
    ref: Ref<HTMLDivElement>,
) {
    return (
        <Editor
            {...props}
            workspace={assertSome(useContext(Workspace))}
            clipboard={assertSome(useContext(Clipboard))}
            theme={assertSome(useTheme())}
            forwardedRef={ref}
        />
    );
});
