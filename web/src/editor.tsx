import React, { Component, useContext } from "react";
import styled, { useTheme } from "styled-components";

import * as E from "expr";
import * as Select from "selection";
import Expr, { ExprId } from "expr";
import ExprView, { ExprAreaMap } from "expr_view";
import { Optional, assertSome, insertIndex, reverseObject, assert } from "utils";
import { Clipboard, Workspace, ClipboardValue, WorkspaceValue } from "workspace";
import { KaleTheme } from "theme";
import { ContextMenuItem } from "components/context_menu";
import TextMetrics from "text_metrics";

interface EditorState {
    focused: boolean;
    selection: ExprId;
    foldingComments: boolean;
    editingInline: Optional<{ expr: ExprId; value: string; originalValue: string }>;
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

const InlineEditor = styled.input`
    position: absolute;
    font-family: ${p => p.theme.fontFamily};
    font-size: ${p => p.theme.fontSizePx}px;
    line-height: 1;
    padding: 2px;
    border-radius: ${p => p.theme.borderRadiusPx}px;
    border: 1px solid ${p => p.theme.clickableColour};
`;

class Editor extends Component<EditorProps, EditorState> {
    private readonly containerRef = React.createRef<HTMLDivElement>();
    private readonly exprAreaMapRef = React.createRef<ExprAreaMap>();

    state: EditorState = {
        selection: this.expr.id,
        focused: this.props.stealFocus ?? false,
        //TODO: Until editing location is fixed.
        foldingComments: true,
        editingInline: null,
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

    private setSelection(reducer: Select.SelectFn) {
        this.setState(state => ({
            selection:
                reducer(this.expr, state.selection, assertSome(this.exprAreaMapRef.current)) ??
                this.expr.id,
        }));
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
        h: () => this.setSelection(Select.leftSmart),
        j: e => this.setSelection(Select.downSmart),
        k: e => this.setSelection(Select.upSmart),
        l: () => this.setSelection(Select.rightSmart),
        p: () => this.setSelection(Select.parent),
        H: () => this.setSelection(Select.leftSiblingSmart),
        L: () => this.setSelection(Select.rightSiblingSmart),
        Tab: () => this.setSelection(Select.nextBlank),
        ArrowUp: e => this.setSelection(Select.upSmart),
        ArrowDown: e => this.setSelection(Select.downSmart),
        ArrowLeft: () => this.setSelection(Select.leftSmart),
        ArrowRight: () => this.setSelection(Select.rightSmart),
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
        { action: "edit", label: "Edit..." },
        null,
        { action: "append", label: "Append a Blank" },
        { action: "insert", label: "Insert a Blank" },
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

    private readonly startEditing = (expr: ExprId) => {
        const value = assertSome(this.expr.withId(expr)).value();
        if (value != null) {
            this.setState({ editingInline: { expr, value, originalValue: value } });
        }
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

    private renderInlineEditor() {
        const { expr, value, originalValue } = assertSome(this.state.editingInline);
        const { rect, textProps } = assertSome(this.exprAreaMapRef.current)[expr];

        const onKeyDown = (e: React.KeyboardEvent) => {
            e.stopPropagation();
            if (e.key === "Escape") {
                e.preventDefault();
                this.setState({ editingInline: null });
                this.containerRef.current?.focus();
                return;
            }

            // Everything below is about confirming an edit.
            if (e.key !== "Enter") return;
            e.preventDefault();
            const content = (e.target as HTMLInputElement).value;
            this.setState({ editingInline: null });
            this.update(mainExpr =>
                assertSome(
                    mainExpr.update(expr, u => {
                        if (u instanceof E.Literal) {
                            return new E.Literal(content, u.type, u.data);
                        } else if (u instanceof E.Variable) {
                            return new E.Variable(content, u.data);
                        } else if (u instanceof E.Call) {
                            return new E.Call(content, u.args, u.data);
                        } else {
                            throw new E.UnvisitableExpr(u);
                        }
                    }),
                ),
            );
            this.containerRef.current?.focus();
        };

        const { offset, colour, italic, bold } = assertSome(textProps);
        const fudge = 3; // How much to add for border and padding.
        return (
            <InlineEditor
                value={value}
                style={{
                    top: rect.y + (offset?.y ?? 0) - fudge,
                    left: rect.x + (offset?.x ?? 0) - fudge,
                    width:
                        Math.max(
                            TextMetrics.global.measure(value || " ", { bold, italic }).width,
                            TextMetrics.global.measure(originalValue, { bold, italic }).width,
                        ) +
                        fudge * 2,
                    color: colour,
                    fontStyle: italic ? "italic" : undefined,
                    fontWeight: bold ? "bold" : undefined,
                }}
                ref={r => r?.focus()}
                //TODO: Stop the editor from doing stuff, should check for focus instead.
                onKeyDown={onKeyDown}
                onChange={e => {
                    const content = e.target?.value; // Get if now before it's gone.
                    this.setState(s => ({
                        editingInline: {
                            expr: s.editingInline!.expr,
                            value: content,
                            originalValue: s.editingInline!.originalValue,
                        },
                    }));
                }}
            />
        );
    }

    constructor(props: EditorProps) {
        super(props);
        for (const shortcut of Object.keys(this.menuKeys)) {
            assert(!(shortcut in this.hiddenKeys), "Shortcut conflict");
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
                    // Callbacks.
                    contextMenuFor={this.contextMenuFor}
                    onClick={this.exprSelected}
                    onDoubleClick={this.startEditing}
                    onClickCreateCircle={this.createChildBlank}
                />
                {this.state.editingInline && this.renderInlineEditor()}
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
