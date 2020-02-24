import * as ReactDOM from "react-dom";
import React, { Component } from "react";
import styled, {
    StyleSheetManager,
    createGlobalStyle,
    css,
} from "styled-components";

import * as E from "./expr";
import { Expr } from "./expr";
import ExprView, { DragAndDropSurface } from "./expr_view";
import SAMPLE_EXPR from "./sample";
import TextMetrics from "./text_metrics";
import { Optional } from "./utils";
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
`;

interface EditorProps {
    onRemovedExpr: (expr: Expr) => void;
}

interface EditorState {
    expr: Optional<Expr>;
    selection: Optional<Expr>;
}

const ExprViewAppearance = css`
    border: 1px solid #f1f1f1;
    border-radius: ${THEME.selectionPaddingPx}px;
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

    private keyDown = (event: React.KeyboardEvent) => {
        // See https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values.
        switch (event.key) {
            case "Backspace":
                //TODO: Select a sibling.
                this.setState(state => {
                    if (state.selection == null) return state;
                    this.props.onRemovedExpr(state.selection);
                    return {
                        expr: state.expr?.remove(state.selection),
                        selection: null,
                    };
                });
                break;
        }
    };

    private exprSelected = (selection: Expr) => {
        this.setState({ selection });
    };

    private createCircleClicked = (expr: Expr) => {
        if (expr instanceof E.Call) {
            const hole = new E.Hole();
            const newExpr = new E.Call(expr.fn, [...expr.args, hole]);
            this.setState(state => ({
                selection: hole,
                expr: state.expr?.replace(expr, newExpr),
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
                    expr={
                        this.state.expr ??
                        new E.Hole(E.exprData("Empty function"))
                    }
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
    cursor: grab;
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
