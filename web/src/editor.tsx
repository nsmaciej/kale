import React, { Component, Ref, useContext, PureComponent } from "react";
import { useTheme } from "styled-components";

import * as E from "expr";
import * as Select from "selection";
import Expr, { ExprId } from "expr";
import ExprView, { ExprAreaMap } from "expr_view";
import { Optional, assertSome, reverseObject, assert, insertSibling, arrayEquals } from "utils";
import { KaleTheme, Highlight } from "theme";

import { Type, Func, assertFunc } from "vm/types";
import { specialFunctions } from "vm/interpreter";

import { Clipboard, ClipboardValue } from "contexts/clipboard";
import { Workspace, WorkspaceValue } from "contexts/workspace";

import { ContextMenuItem } from "components/context_menu";
import InlineEditor from "components/inline_editor";
import { EditorStackActions } from "hooks/editor_stack";

interface EditorState {
    focused: boolean;
    selection: ExprId;
    hoverHighlight: Optional<ExprId>;
    foldingComments: boolean;
    editing: Optional<{ expr: ExprId; created: boolean }>;
}

interface EditorWrapperProps {
    functionName: string;
    editorStackIndex: number;
    editorStackDispatch: React.Dispatch<EditorStackActions>;
}

interface EditorProps extends EditorWrapperProps {
    workspace: WorkspaceValue;
    clipboard: ClipboardValue;
    theme: KaleTheme;
    forwardedRef: Ref<HTMLDivElement>;
}

class Editor extends PureComponent<EditorProps, EditorState> {
    private readonly containerRef = React.createRef<HTMLDivElement>();
    private readonly exprAreaMapRef = React.createRef<ExprAreaMap>();

    state: EditorState = {
        selection: this.expr.id,
        hoverHighlight: null,
        focused: false,
        foldingComments: false,
        editing: null,
    };

    private get expr(): Expr {
        const func = this.props.workspace.get(this.props.functionName);
        assert(func.type === Type.Func);
        return (func.value as Func).expr;
    }

    // Editor internal APIs.
    private update(child: Optional<ExprId>, updater: (expr: Expr) => Optional<Expr>) {
        this.props.workspace.update(
            this.props.functionName,
            expr =>
                expr.update(child ?? expr.id, updater) ??
                new E.Blank(E.exprData("Double click me")),
        );
    }

    private addToClipboard(expr: ExprId) {
        const selected = this.expr.findId(expr);
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
        const expr = this.expr.findId(exprId);
        // Only things with a value can be edited.
        if (expr != null && expr.value() != null) {
            this.setState({ editing: { expr: exprId, created } });
        }
    }

    private stopEditing(newValue: Optional<string>) {
        // This will disable rendering the inline-editor, preventing it from firing onBlur.
        this.setState({ editing: null }, () => this.focus());

        const { expr: exprId, created } = assertSome(this.state.editing);
        const expr = this.expr.findId(exprId);
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
    private insertAsChildOf(target: ExprId, toInsert: Expr, last: boolean): void {
        this.update(target, parent => {
            if (parent.hasChildren()) {
                return parent.updateChildren(xs => (last ? [...xs, toInsert] : [toInsert, ...xs]));
            }
            return parent;
        });
    }

    private selectAndInsertAsSiblingOf(sibling: ExprId, toInsert: Expr, right: boolean): void {
        this.selectExpr(toInsert.id);
        this.update(null, mainExpr => {
            const parent = mainExpr.parentOf(sibling);
            if (parent == null) {
                return new E.List(right ? [mainExpr, toInsert] : [toInsert, mainExpr]);
            } else if (parent.hasChildren()) {
                return mainExpr.replace(
                    parent.id,
                    parent.updateChildren(xs =>
                        insertSibling(xs, x => x.id === sibling, toInsert, right),
                    ),
                );
            } else {
                return mainExpr;
            }
        });
    }

    private insertNewLine(target: ExprId, below: boolean): void {
        const toInsert = new E.Blank();
        this.update(null, mainExpr => {
            const expr = assertSome(mainExpr.findId(target));
            const parent = mainExpr.parentOf(target);
            if (expr instanceof E.List) {
                return mainExpr.replace(
                    expr.id,
                    expr.updateChildren(xs => (below ? [...xs, toInsert] : [toInsert, ...xs])),
                );
            } else if (parent instanceof E.List) {
                return mainExpr.replace(
                    parent.id,
                    parent.updateChildren(xs =>
                        insertSibling(xs, x => x.id === target, toInsert, below),
                    ),
                );
            } else {
                return mainExpr.replace(
                    target,
                    new E.List(below ? [expr, toInsert] : [toInsert, expr]),
                );
            }
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
        const expr = this.expr.findId(target);
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
        insert: (e: ExprId) => this.insertBlankAsSiblingOf(e, true),
        insertBefore: (e: ExprId) => this.insertBlankAsSiblingOf(e, false),
        foldComments: () => this.setState(state => ({ foldingComments: !state.foldingComments })),
        comment: (e: ExprId) => {
            const selected = this.expr.findId(e);
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
        openEditor: (e: ExprId) => {
            const selected = this.expr.findId(e);
            if (selected instanceof E.Call) {
                //TODO: This should be handled somewhere better, but cannot do it in the reducer.
                this.props.workspace.ensureExists(selected.fn);
                this.props.editorStackDispatch({
                    type: "openEditor",
                    name: selected.fn,
                    index: this.props.editorStackIndex,
                });
            }
        },
        newLine: (e: ExprId) => this.insertNewLine(e, true),
        newLineBefore: (e: ExprId) => this.insertNewLine(e, false),
        // Demo things that should be moved to the toy-box.
        demoAddCall: (e: ExprId) => this.replaceAndEdit(e, new E.Call("")),
        demoAddVariable: (e: ExprId) => this.replaceAndEdit(e, new E.Variable("")),
        demoAddString: (e: ExprId) => this.replaceAndEdit(e, new E.Literal("", Type.Str)),
    };

    // See https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values.
    // Keep these sorted.
    private readonly menuKeyEquivalents: { [key: string]: keyof Editor["actions"] } = {
        "\\": "disable",
        "#": "foldComments",
        c: "copy",
        d: "delete",
        Enter: "edit",
        f: "demoAddCall",
        g: "demoAddString",
        i: "insert",
        I: "insertBefore",
        m: "move",
        n: "newLine",
        N: "newLineBefore",
        //TODO: Add openEditorInPlaceOfThisOne.
        o: "openEditor",
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

    //TODO: Ideally the names would also be dynamic.
    private readonly enableForCalls = (expr: Expr) => expr instanceof E.Call;
    private readonly disableForBlanks = (expr: Expr) => !(expr instanceof E.Blank);

    private readonly exprMenu: Optional<{
        label: string;
        action: keyof Editor["actions"];
        enabled?(expr: Expr): boolean;
    }>[] = [
        { action: "edit", label: "Edit..." },
        { action: "copy", label: "Copy" },
        { action: "openEditor", label: "Open definition...", enabled: this.enableForCalls },
        null,
        { action: "delete", label: "Delete" },
        { action: "move", label: "Delete and Copy" },
        { action: "replace", label: "Replace" },
        { action: "shuffle", label: "Replace and Copy" },
        null,
        { action: "insert", label: "New Argument Before", enabled: this.enableForCalls },
        { action: "insertBefore", label: "New Argument After", enabled: this.enableForCalls },
        { action: "newLine", label: "New Line Below" },
        { action: "newLineBefore", label: "New Line Above" },
        null,
        { action: "comment", label: "Comment..." },
        { action: "disable", label: "Disable", enabled: this.disableForBlanks },
        // Move this into some sort of editor-wide menu.
        { action: "foldComments", label: "Fold Comments" },
        null,
        { action: "demoAddCall", label: "Make a Call" },
        { action: "demoAddVariable", label: "Make a Variable" },
        { action: "demoAddString", label: "Make a String" },
    ];

    // Bound methods.
    private readonly menuKeyEquivalentForAction = reverseObject(this.menuKeyEquivalents);
    contextMenuFor = (exprId: ExprId): ContextMenuItem[] => {
        const expr = assertSome(this.expr.findId(exprId));
        return this.exprMenu.map((item, i) => ({
            id: item?.action ?? i.toString(),
            label: item?.label,
            action: item?.action && (() => this.actions[item.action](exprId)),
            keyEquivalent: item?.action && this.menuKeyEquivalentForAction[item.action],
            enabled: item?.enabled?.(expr) ?? true,
        }));
    };

    private readonly keyDown = (event: React.KeyboardEvent) => {
        // Do not handle modifier keys.
        if (event.ctrlKey || event.altKey || event.metaKey) return;
        const key = event.key;
        if (Object.prototype.hasOwnProperty.call(this.menuKeyEquivalents, key)) {
            this.actions[this.menuKeyEquivalents[key]](this.state.selection);
        } else if (Object.prototype.hasOwnProperty.call(this.editorShortcuts, key)) {
            this.editorShortcuts[key](this.state.selection);
        } else {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
    };

    private readonly createChildBlank = (parentId: ExprId) => {
        const blank = new E.Blank();
        this.insertAsChildOf(parentId, blank, true);
        this.selectExpr(blank.id);
    };

    private readonly selectExpr = (selection: ExprId) => {
        this.setState({ selection });
    };

    private readonly onHover = (hoverHighlight: Optional<ExprId>) => {
        this.setState({ hoverHighlight });
    };

    private readonly startEditing = (expr: ExprId) => {
        this.createInlineEditor(expr, false);
    };

    private readonly focus = () => {
        this.containerRef.current?.focus();
    };

    // This seems messy but it's the only way https://github.com/facebook/react/issues/13029
    private readonly attachRef = (element: HTMLDivElement | null) => {
        if (element === null) return;
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
            prevProps.functionName === this.props.functionName,
            "Use a key to create a new Editor component instead",
        );
        if (this.expr.contains(this.state.selection)) return;
        // Ensure the selection is always valid.
        const prevExpr = assertFunc(prevProps.workspace.get(prevProps.functionName)).expr;
        const candidates: Expr[][] = [];

        // Maybe we just tried updating the selection to something that doesn't exist. Use the
        // old selection instead.
        const oldSelection = prevExpr.findId(prevState.selection);
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
        assert(!specialFunctions.has(props.functionName), "Cannot edit special functions");
    }

    renderInlineEditor() {
        if (this.exprAreaMapRef.current == null || this.state.editing == null) return;
        const exprId = this.state.editing.expr;
        const expr = assertSome(this.expr.findId(exprId));
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

    lastHighlights: [ExprId, Highlight][] = [];
    memoizedHighlights(): [ExprId, Highlight][] {
        const highlights: [ExprId, Highlight][] = [];
        const hl = this.props.theme.highlight;
        // Highlights pushed later have higher priority.
        if (this.state.hoverHighlight) {
            highlights.push([this.state.hoverHighlight, hl.hover]);
        }
        // Preferablly this would be above the hover-highlight, but the blank hover-highlight has a
        // solid background, which would cover the blue-selection effect.
        highlights.push([this.state.selection, hl.selection]);

        // Sort the highlights by their containment.
        const lut: { [id in ExprId]: Expr } = {};
        for (const pair of highlights) {
            lut[pair[0]] = this.expr.get(pair[0]);
        }
        highlights.sort((lhs, rhs) => {
            if (lhs[0] === rhs[0]) return 0;
            return lut[lhs[0]].contains(rhs[0]) ? -1 : 1;
        });
        if (arrayEquals(highlights, this.lastHighlights)) return this.lastHighlights;
        this.lastHighlights = highlights;
        return highlights;
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
                    // This is heavy pure component, don't create new objects here.
                    expr={this.expr}
                    highlights={this.memoizedHighlights()}
                    focused={this.state.focused}
                    foldComments={this.state.foldingComments}
                    theme={this.props.theme}
                    exprAreaMapRef={this.exprAreaMapRef}
                    // Callbacks.
                    contextMenuFor={this.contextMenuFor}
                    onClick={this.selectExpr}
                    onHover={this.onHover}
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
