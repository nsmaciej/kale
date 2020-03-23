import React, { Ref, useContext, PureComponent } from "react";
import { useTheme } from "styled-components";

import * as E from "expr";
import * as Select from "selection";
import { EditorStackActions } from "hooks/editor_stack";
import { KaleTheme, Highlight } from "theme";
import { Offset, Rect, ClientOffset } from "geometry";
import { assertSome, reverseObject, assert, insertSibling, arrayEquals } from "utils";
import Expr, { ExprId } from "expr";
import ExprView, { ExprArea, ExprAreaMap } from "expr_view";

import { Type, Func, assertFunc, Value, Builtin } from "vm/types";
import { specialFunctions } from "vm/interpreter";

import DragAndDrop, { DragAndDropContext, DropListener } from "contexts/drag_and_drop";
import Clipboard, { ClipboardContext } from "contexts/clipboard";
import Workspace, { WorkspaceContext } from "contexts/workspace";

import ContextMenu, { ContextMenuItem } from "components/context_menu";
import InlineEditor from "components/inline_editor";

interface EditorState {
    focused: boolean;
    foldingComments: boolean;
    editing: { expr: ExprId; created: boolean } | null;
    showingDebugOverlay: boolean;
    blankPopover: ExprId | null;
    // Highlights.
    selection: ExprId;
    hoverHighlight: ExprId | null;
    droppable: ExprId | null;
}

interface EditorWrapperProps {
    functionName: string;
    editorStackIndex: number;
    editorStackDispatch: React.Dispatch<EditorStackActions>;
}

interface EditorProps extends EditorWrapperProps {
    workspace: WorkspaceContext;
    clipboard: ClipboardContext;
    dragAndDrop: DragAndDropContext;
    theme: KaleTheme;
    forwardedRef: Ref<HTMLDivElement>;
}

class Editor extends PureComponent<EditorProps, EditorState> {
    private readonly containerRef = React.createRef<HTMLDivElement>();
    private readonly exprAreaMapRef = React.createRef<ExprAreaMap>();
    private readonly exprAreaRef = React.createRef<ExprArea>();

    state: EditorState = {
        focused: false,
        foldingComments: false,
        editing: null,
        blankPopover: null,
        showingDebugOverlay: false,
        // Highlights.
        selection: this.expr.id,
        hoverHighlight: null,
        droppable: null,
    };

    private get expr(): Expr {
        return this.getWorkspaceFunc(this.props.workspace, this.props.functionName);
    }

    // Editor internal APIs.
    private update(childId: ExprId | null, transform: (expr: Expr) => Expr | null) {
        function updater(main: Expr) {
            const nextMain = main.update(childId ?? main.id, transform);
            return nextMain ?? new E.Blank(E.exprData("Double click me"));
        }
        this.props.workspace.dispatch({
            type: "update",
            name: this.props.functionName,
            updater,
        });
    }

    private getWorkspaceValue(
        workspace: WorkspaceContext,
        name: string,
    ): Value<Builtin | Func> | undefined {
        return workspace.workspace.scope.get(name);
    }

    private getWorkspaceFunc(workspace: WorkspaceContext, name: string): Expr {
        return assertFunc(assertSome(this.getWorkspaceValue(workspace, name))).expr;
    }

    private addToClipboard(expr: ExprId) {
        const selected = this.expr.findId(expr);
        if (selected) {
            this.props.clipboard.dispatch({
                type: "add",
                entry: { expr: selected.resetIds(), pinned: false },
            });
        }
    }

    private removeExpr(sel: ExprId) {
        this.update(sel, () => null);
    }

    private replaceExpr(old: ExprId, next: Expr) {
        this.update(old, () => next.resetIds().replaceId(old));
    }

    private swapExpr(left: ExprId, right: ExprId) {
        this.replaceExpr(left, this.expr.get(right));
        this.replaceExpr(right, this.expr.get(left));
    }

    private createInlineEditor(exprId: ExprId, created: boolean) {
        const expr = this.expr.findId(exprId);
        if (expr === null) return;
        // Only things with a value can be edited.
        if (expr.value() !== null) {
            this.setState({ editing: { expr: exprId, created } });
        } else if (expr instanceof E.Blank) {
            this.setState({ blankPopover: exprId });
        }
    }

    private stopEditing(newValue: string | null) {
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
        this.update(exprId, (x) => x.withValue(value));

        if (created && expr instanceof E.Call) {
            // Auto-insert the right amount of blanks for this function.
            // Note at this point expr still might have some old value.
            const func = this.getWorkspaceValue(this.props.workspace, value)?.value;
            if (func !== undefined && !specialFunctions.has(value) && func.args.length > 0) {
                const blanks = (func.args as (string | null)[]).map(
                    (x) => new E.Blank(E.exprData(x)),
                );
                blanks.forEach((arg) => this.insertAsChildOf(exprId, arg, true));
                this.selectExpr(blanks[0].id);
            }
        } else if (expr !== null && newValue !== null) {
            // Auto-select the next pre-order sibling (if we submitted).
            this.selectionAction(Select.rightSmart)();
        }
    }

    private replaceAndEdit(expr: ExprId, next: Expr, created: boolean) {
        // Replace expr but using the callback.
        this.replaceExpr(expr, next);
        //TODO: Remove this.
        // ReplaceExpr will re-use the expr ID.
        this.forceUpdate(() => this.createInlineEditor(expr, created));
    }

    private insertBlankAsSiblingOf(target: ExprId, right: boolean) {
        this.selectAndInsertAsSiblingOf(target, new E.Blank(), right);
    }

    // Complex functions.
    private insertAsChildOf(target: ExprId, toInsert: Expr, last: boolean): void {
        this.update(target, (parent) => {
            if (parent.hasChildren()) {
                return parent.updateChildren((xs) =>
                    last ? [...xs, toInsert] : [toInsert, ...xs],
                );
            }
            return parent;
        });
    }

    private selectAndInsertAsSiblingOf(sibling: ExprId, toInsert: Expr, right: boolean): void {
        this.selectExpr(toInsert.id);
        this.update(null, (mainExpr) => {
            const parent = mainExpr.parentOf(sibling);
            if (parent == null) {
                return new E.List(right ? [mainExpr, toInsert] : [toInsert, mainExpr]);
            } else if (parent.hasChildren()) {
                return mainExpr.replace(
                    parent.id,
                    parent.updateChildren((xs) =>
                        insertSibling(xs, (x) => x.id === sibling, toInsert, right),
                    ),
                );
            } else {
                return mainExpr;
            }
        });
    }

    private insertNewLine(target: ExprId, below: boolean): void {
        const toInsert = new E.Blank();
        this.update(target, (expr) => {
            if (expr instanceof E.List) {
                return new E.List(
                    below ? [...expr.list, toInsert] : [toInsert, ...expr.list],
                    expr.data,
                );
            }
            // This becomes very simple with automatic list merging.
            return new E.List(below ? [expr, toInsert] : [toInsert, expr]);
        });
        this.selectExpr(toInsert.id);
    }

    // Actions.
    private selectionAction(reducer: Select.SelectFn): () => void {
        return () =>
            this.setState((state) => ({
                selection:
                    reducer(this.expr, state.selection, assertSome(this.exprAreaMapRef.current)) ??
                    state.selection,
            }));
    }

    private pasteAction(ix: number): () => void {
        return () => {
            const clipboard = this.props.clipboard.value;
            if (ix < clipboard.length) {
                this.replaceExpr(this.state.selection, clipboard[ix].expr);
                this.props.clipboard.dispatch({ type: "use", expr: clipboard[ix].expr.id });
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
            if (parent !== null) {
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
        foldComments: () => this.setState((state) => ({ foldingComments: !state.foldingComments })),
        comment: (e: ExprId) => {
            // Empty string _should_ be null.
            const comment = prompt("Comment?", this.expr.get(e).data.comment ?? "") || null;
            this.update(e, (expr) => expr.assignToData({ comment: comment }));
        },
        disable: (e: ExprId) => {
            this.update(e, (expr) => {
                if (expr instanceof E.Blank) return expr;
                return expr.assignToData({ disabled: !expr.data.disabled });
            });
        },
        edit: (e: ExprId) => this.startEditing(e),
        openEditor: (e: ExprId) => {
            const selected = this.expr.findId(e);
            if (selected instanceof E.Call) {
                this.props.workspace.dispatch({
                    type: "ensureExists",
                    name: selected.fn,
                });
                this.props.editorStackDispatch({
                    type: "openEditor",
                    name: selected.fn,
                    index: this.props.editorStackIndex,
                });
            }
        },
        newLine: (e: ExprId) => this.insertNewLine(e, true),
        newLineBefore: (e: ExprId) => this.insertNewLine(e, false),
        moveToParent: (e: ExprId) => {
            const parent = this.expr.parentOf(e);
            if (parent !== null) {
                this.replaceExpr(parent.id, new E.List(parent.children()));
            }
        },
        smartMakeCall: (e: ExprId) => {
            const target = this.expr.get(e);
            if (target instanceof E.Blank) {
                this.replaceAndEdit(e, new E.Call(""), true);
            } else {
                const fn = new E.Call("", [target]);
                this.replaceAndEdit(e, fn, false);
            }
        },
        // Demo things that should be moved to the toy-box.
        demoAddVariable: (e: ExprId) => this.replaceAndEdit(e, new E.Variable(""), true),
        demoAddString: (e: ExprId) => this.replaceAndEdit(e, new E.Literal("", Type.Text), true),
        showDebugOverlay: () =>
            this.setState({ showingDebugOverlay: !this.state.showingDebugOverlay }),
    };

    // See https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values.
    // Keep these sorted.
    private readonly menuKeyEquivalents: { [key: string]: keyof Editor["actions"] } = {
        "\\": "disable",
        "#": "foldComments",
        Backspace: "delete",
        c: "copy",
        Enter: "edit",
        F: "moveToParent",
        f: "smartMakeCall",
        g: "demoAddString",
        i: "insert",
        I: "insertBefore",
        m: "move",
        n: "newLine",
        N: "newLineBefore",
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
        d: this.actions["delete"], // An alternative to the Backspace
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

    private readonly exprMenu: (null | {
        label: string;
        action: keyof Editor["actions"];
        enabled?(expr: Expr): boolean;
        hidden?: boolean;
    })[] = [
        { action: "edit", label: "Edit..." },
        { action: "copy", label: "Copy" },
        { action: "openEditor", label: "Open definition", enabled: this.enableForCalls },
        { action: "showDebugOverlay", label: "Toggle the Debug Overlay", hidden: true },
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
        { action: "demoAddVariable", label: "Make a Variable..." },
        { action: "demoAddString", label: "Make a String..." },
        { action: "smartMakeCall", label: "Turn Into a Function Call..." },
        { action: "moveToParent", label: "Replace the parent" },
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
            disabled: !(item?.enabled?.(expr) ?? true),
            hidden: item?.hidden,
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

    private readonly selectExpr = (selection: ExprId) => {
        this.setState({ selection });
    };

    private readonly onHover = (hoverHighlight: ExprId | null) => {
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

    private clientOffsetToExpr(absolutePoint: ClientOffset | null): ExprId | null {
        if (this.containerRef.current === null || this.exprAreaRef.current === null) {
            return null;
        }
        const editorRect = Rect.fromBoundingRect(this.containerRef.current.getBoundingClientRect());
        if (absolutePoint === null || !editorRect.contains(absolutePoint)) {
            return null;
        }

        // Find the drop target. Keep in mind each nested area is offset relative to its parent.
        const point = absolutePoint.difference(editorRect.origin);
        let currentArea = this.exprAreaRef.current;
        let areaStart = Offset.zero;
        main: for (;;) {
            for (const subArea of currentArea.children) {
                if (subArea.rect.shift(areaStart).contains(point)) {
                    currentArea = subArea;
                    areaStart = areaStart.offset(subArea.rect.origin);
                    continue main;
                }
            }
            break;
        }
        return currentArea.expr.id;
    }

    private readonly onDraggedOut = (exprId: ExprId) => {
        this.removeExpr(exprId);
    };

    private readonly dragListener: DropListener = {
        dragUpdate: (absolutePoint) => {
            this.setState({
                droppable: this.clientOffsetToExpr(absolutePoint),
            });
        },
        acceptDrop: (absolutePoint, draggedExpr) => {
            const dropTargetId = this.clientOffsetToExpr(absolutePoint);
            if (dropTargetId !== null) {
                this.focus();
                this.selectExpr(dropTargetId);
                if (draggedExpr.contains(dropTargetId)) {
                    this.replaceExpr(dropTargetId, draggedExpr); // Nest.
                    return "copy";
                } else if (this.expr.contains(draggedExpr.id)) {
                    this.swapExpr(draggedExpr.id, dropTargetId); // Swap.
                    return "copy";
                } else {
                    this.replaceExpr(dropTargetId, draggedExpr); // Move from outside this editor.
                    return "move";
                }
            }
            return "reject";
        },
    };

    componentDidMount() {
        this.props.dragAndDrop.addListener(this.dragListener);
    }
    componentWillUnmount() {
        this.props.dragAndDrop.removeListener(this.dragListener);
    }

    componentDidUpdate(prevProps: EditorProps, prevState: EditorState) {
        assert(
            prevProps.functionName === this.props.functionName,
            "Use a key to create a new Editor component instead",
        );
        if (this.expr.contains(this.state.selection)) return;
        // Ensure the selection is always valid.
        const prevExpr = this.getWorkspaceFunc(prevProps.workspace, prevProps.functionName);
        const candidates: Expr[][] = [];

        // Maybe we just tried updating the selection to something that doesn't exist. Use the
        // old selection instead.
        const oldSelection = prevExpr.findId(prevState.selection);
        if (oldSelection !== null) {
            candidates.push([oldSelection]);
        }
        // Try the siblings, going forward then back.
        const [siblings, ix] = prevExpr.siblings(this.state.selection);
        if (ix !== null) {
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

    private renderInlineEditor() {
        if (this.exprAreaMapRef.current === null || this.state.editing === null) return;
        const exprId = this.state.editing.expr;
        const expr = assertSome(this.expr.findId(exprId));
        return (
            <InlineEditor
                exprArea={this.exprAreaMapRef.current[exprId]}
                value={assertSome(expr.value())}
                disableSuggestions={!(expr instanceof E.Call)}
                onChange={(value) => {
                    this.update(exprId, (x) => x.withValue(value));
                }}
                onDismiss={() => this.stopEditing(null)}
                onSubmit={(value) => this.stopEditing(value)}
            />
        );
    }

    private renderBlankPopover() {
        const target = this.state.blankPopover;
        if (
            target === null ||
            this.exprAreaMapRef.current === null ||
            this.containerRef.current === null
        ) {
            return;
        }
        const exprRect = this.exprAreaMapRef.current[target].rect;
        const editorOrigin = ClientOffset.fromBoundingRect(
            this.containerRef.current.getBoundingClientRect(),
        );
        const origin = editorOrigin.offset(exprRect.bottomMiddle);

        const exprs = [
            { label: "Function Call", expr: new E.Call(""), keyEquivalent: "f" },
            { label: "Variable", expr: new E.Variable(""), keyEquivalent: "v" },
            { label: "Text", expr: new E.Literal("", Type.Text), keyEquivalent: "g" },
            { label: "Number", expr: new E.Literal("", Type.Num) },
        ];

        return (
            <ContextMenu
                popover
                origin={origin}
                dismissMenu={() => this.setState({ blankPopover: null })}
                items={exprs.map((x) => ({
                    id: x.label,
                    label: x.label,
                    action: () => this.replaceAndEdit(target, x.expr, true),
                    keyEquivalent: x.keyEquivalent,
                }))}
            />
        );
    }

    lastHighlights: [ExprId, Highlight][] = [];
    memoizedHighlights(): [ExprId, Highlight][] {
        const highlights: [ExprId, Highlight][] = [];
        const hl = this.props.theme.highlight;
        // Highlights pushed later have higher priority.
        if (this.state.hoverHighlight !== null) {
            highlights.push([this.state.hoverHighlight, hl.hover]);
        }
        // Preferablly this would be above the hover-highlight, but the blank hover-highlight has a
        // solid background, which would cover the blue-selection effect.
        highlights.push([this.state.selection, hl.selection]);
        if (this.state.blankPopover !== null) {
            highlights.push([this.state.blankPopover, hl.contextMenu]);
        }

        // Remove higlights that do not exist. Iterating backwards makes this easy.
        for (let i = highlights.length - 1; i >= 0; --i) {
            if (!this.expr.contains(highlights[i][0])) highlights.splice(i, 1);
        }
        // Sort the highlights by their containment.
        const lut: { [id in ExprId]: Expr } = {};
        for (const pair of highlights) {
            lut[pair[0]] = this.expr.get(pair[0]);
        }
        highlights.sort((lhs, rhs) => {
            if (lhs[0] === rhs[0]) return 0;
            return lut[lhs[0]].contains(rhs[0]) ? -1 : 1;
        });

        // Droppable highlight goes on last. Otherwise the shadow might clip other highlights.
        if (this.state.droppable !== null) {
            highlights.push([this.state.droppable, hl.droppable]);
        }
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
                    exprAreaRef={this.exprAreaRef}
                    showDebugOverlay={this.state.showingDebugOverlay}
                    // Callbacks.
                    contextMenuFor={this.contextMenuFor}
                    onClick={this.selectExpr}
                    onHover={this.onHover}
                    onDoubleClick={this.startEditing}
                    onFocus={this.focus}
                    onDraggedOut={this.onDraggedOut}
                />
                {this.renderInlineEditor()}
                {this.renderBlankPopover()}
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
            dragAndDrop={assertSome(useContext(DragAndDrop))}
            theme={assertSome(useTheme())}
            forwardedRef={ref}
        />
    );
});
