import * as ReactDOM from "react-dom";
import React, { Component } from "react";
import styled, {
    StyleSheetManager,
    createGlobalStyle,
    css,
} from "styled-components";

import * as E from "./expr";
import { Expr, ExprId } from "./expr";
import ExprView, { DragAndDropSurface } from "./expr_view";
import SAMPLE_EXPR from "./sample";
import TextMetrics from "./text_metrics";
import { Optional, assert, assertSome } from "./utils";
import THEME from "./theme";
import {
    Box,
    HorizonstalStack,
    VerticalStack,
    LayoutProps,
} from "./components";

const GlobalStyle = createGlobalStyle`
#main {
    position: absolute;
    top: 0;
    height: 100%;
    width: 100%;
}
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}
body {
    font-family: ${THEME.fontFamily}, sans-serif;
    font-size: ${THEME.fontSizePx}px;
}
/* Hide the focus ring around focused divs */
div:focus {
    outline: none;
}
/* Nothing inside svgs should be selectable */
svg * {
    user-select: none;
}
`;

interface EditorProps {
    onRemovedExpr: (expr: Expr) => void;
}

interface EditorState {
    expr: Expr;
    selection: Optional<ExprId>;
}

const ExprViewAppearance = css`
    border: 1px solid #f1f1f1;
    border-radius: ${THEME.selectionRadiusPx}px;
    background: #fbfbfb;
`;

class Editor extends Component<EditorProps & LayoutProps, EditorState> {
    private static readonly Container = styled(Box)`
        ${ExprViewAppearance}
        padding: 10px 12px;
        overflow: auto;
    `;

    state: EditorState = {
        selection: null,
        expr: SAMPLE_EXPR,
    };

    private removeSelection(state: EditorState): EditorState {
        const { selection, expr } = state;
        if (selection == null) return state;
        this.props.onRemovedExpr(assertSome(expr.withId(selection)));
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
            expr: newExpr ?? new E.Hole(E.exprData("Double click me")),
            selection: newSelection,
        };
    }

    private selectParent(state: EditorState) {
        return state.expr?.parentOf(state.selection)?.id;
    }
    private selectLeftSibling(state: EditorState) {
        const siblings = state.expr.parentOf(state.selection)?.children() ?? [];
        const ix = siblings?.findIndex(x => x.id === state.selection);
        if (ix == null || ix === 0) return;
        return siblings[ix - 1]?.id;
    }
    private selectRightSibling(state: EditorState) {
        const siblings = state.expr.parentOf(state.selection)?.children() ?? [];
        const ix = siblings?.findIndex(x => x.id === state.selection);
        if (ix == null) return;
        return siblings[ix + 1]?.id;
    }
    private selectFirstCHild(state: EditorState) {
        return state.expr?.withId(state.selection)?.children()[0]?.id;
    }

    private setSelection(reducer: (state: EditorState) => Optional<ExprId>) {
        this.setState(state => ({
            selection:
                state.selection == null
                    ? state.expr.id
                    : reducer(state) ?? state.selection,
        }));
    }

    private keyDown = (event: React.KeyboardEvent) => {
        // See https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values.
        switch (event.key) {
            case "Backspace":
                this.setState(this.removeSelection);
                break;
            case "h":
                this.setSelection(this.selectParent);
                break;
            case "k":
                this.setSelection(this.selectLeftSibling);
                break;
            case "j":
                this.setSelection(this.selectRightSibling);
                break;
            case "l":
                this.setSelection(this.selectFirstCHild);
                break;
        }
    };

    private exprSelected = (selection: ExprId) => {
        this.setState({ selection });
    };

    private createCircleClicked = (clickedId: ExprId) => {
        const clicked = this.state.expr?.withId(clickedId);
        if (clicked instanceof E.Call) {
            const newExpr = new E.Call(
                clicked.fn,
                clicked.args.concat(new E.Hole()),
                clicked.data,
            );
            this.setState(({ selection, expr }) => ({
                // Try to preserve the selection.
                selection: selection === clickedId ? newExpr.id : selection,
                expr: expr.replace(clickedId, newExpr),
            }));
        }
    };

    private clearSelection = () => {
        this.setState({ selection: null });
    };

    render() {
        // As I understand it, svg viewBox is not a required property.
        return (
            <Editor.Container
                onKeyDown={this.keyDown}
                tabIndex={0}
                onClick={this.clearSelection}
                gridArea={this.props.gridArea}
            >
                <ExprView
                    expr={this.state.expr}
                    selection={this.state.selection}
                    onClick={this.exprSelected}
                    onClickCreateCircle={this.createCircleClicked}
                />
            </Editor.Container>
        );
    }
}

const ExprViewItem = styled.div`
    ${ExprViewAppearance}
    position: relative;
    padding: 0;
`;

function ExprViewList({
    exprs,
    gridArea,
    frozen,
}: LayoutProps & { exprs: Expr[]; frozen?: boolean }) {
    //TODO: Add floating headings.
    return (
        <VerticalStack gridArea={gridArea} gap={10} alignItems="start">
            {exprs.map((x, i) => (
                <ExprViewItem key={i}>
                    <ExprView expr={x} frozen={frozen} />
                </ExprViewItem>
            ))}
        </VerticalStack>
    );
}

interface KaleState {
    yankList: Expr[];
}

function hole(comment: string) {
    return new E.Hole(E.exprData(comment));
}

class Kale extends Component<{}, KaleState> {
    private static readonly Container = styled.div`
        display: grid;
        grid-template-areas:
            "nav nav nav"
            "toybox editor yanklist";
        grid-template-rows: min-content auto;
        grid-template-columns: minmax(200px, 1fr) 60% minmax(200px, 1fr);
        grid-gap: 15px;
        padding: 15px 15px 0;
        height: 100%;
    `;

    private static readonly Heading = styled.h1`
        font-size: 20px;
        color: #0ba902;
    `;

    private static readonly toyBox = [
        new E.List([hole("first line"), hole("second line")]),
        new E.Call("if", [hole("true branch"), hole("false branch")]),
        new E.Variable("variable"),
        new E.Literal("a string", "str"),
        new E.Literal("42", "int"),
    ];

    state: KaleState = { yankList: [] };

    private addToYankList = (expr: Expr) => {
        if (expr instanceof E.Hole) return;
        this.setState(state => ({
            yankList: state.yankList.concat([expr]),
        }));
    };

    render() {
        return (
            <StyleSheetManager disableVendorPrefixes>
                <DragAndDropSurface>
                    <GlobalStyle />
                    <Kale.Container>
                        <HorizonstalStack
                            gridArea="nav"
                            gap={10}
                            alignItems="baseline"
                            justifyContent="space-between"
                        >
                            <Kale.Heading>Kale</Kale.Heading>
                            <p>Press backspace to delete</p>
                        </HorizonstalStack>
                        <ExprViewList
                            gridArea="toybox"
                            exprs={Kale.toyBox}
                            frozen
                        />
                        <Editor
                            gridArea="editor"
                            onRemovedExpr={this.addToYankList}
                        />
                        <ExprViewList
                            gridArea="yanklist"
                            exprs={this.state.yankList}
                        />
                    </Kale.Container>
                </DragAndDropSurface>
            </StyleSheetManager>
        );
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    await TextMetrics.loadGlobal();
    ReactDOM.render(<Kale />, document.getElementById("main"));
});
