import React, { Component } from "react";
import styled from "styled-components";

import * as E from "./expr";
import { Expr, ExprId } from "./expr";
import ExprView from "./expr_view";
import { SAMPLE_1 } from "./sample";
import { Optional, assert, assertSome } from "./utils";
import { Box, BoxProps } from "./components";

interface EditorProps {
    onRemovedExpr: (expr: Expr) => void;
}

interface EditorState {
    expr: Expr;
    focused: boolean;
    selection: Optional<ExprId>;
}

export default class Editor extends Component<BoxProps & EditorProps, EditorState> {
    private static readonly Container = styled(Box)`
        outline: none;
    `;

    private containerRef = React.createRef<HTMLDivElement>();

    state: EditorState = {
        selection: null,
        focused: true,
        expr: SAMPLE_1,
    };

    private static removeSelection(state: EditorState, props: EditorProps) {
        const { selection, expr, focused } = state;
        if (selection == null) return state;
        props.onRemovedExpr(assertSome(expr.withId(selection)));
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
                //TODO: Is this safe? What if the state hasn't been flushed yet.
                const selected = this.state.expr.withId(this.state.selection);
                if (selected != null) this.props.onRemovedExpr(selected);
                break;
            // Blanks selection.
            case "Tab":
                // When we press tab, we don't want the default "select root" behaviour.
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
            this.setState(({ selection, expr }) => ({
                // Try to preserve the selection.
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
            <Editor.Container
                onKeyDown={this.keyDown}
                tabIndex={0}
                onClick={this.clearSelection}
                gridArea={this.props.gridArea}
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
            </Editor.Container>
        );
    }
}
