import * as ReactDOM from "react-dom";
import React, { Component, ReactNode } from "react";
import styled, { createGlobalStyle } from "styled-components";

import * as E from "./expr";
import { Expr } from "./expr";
import ExprView, { KALE_THEME } from "./expr_view";
import SAMPLE_EXPR from "./sample";
import TextMetrics from "./text_metrics";
import { Optional } from "./utils";
import {
    Box,
    HorizonstalStack,
    VerticalStack,
    LayoutProps,
} from "./components";

//TODO: Refactor, just stuff to make the demo look nice.
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
    font-family: ${KALE_THEME.fontFamily}, sans-serif;
    font-size: ${KALE_THEME.fontSizePx}px;
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

class Editor extends Component<EditorProps & LayoutProps, EditorState> {
    state: EditorState = {
        selection: null,
        expr: SAMPLE_EXPR,
    };

    updateExpr = (expr: Expr) => {
        this.setState({ expr });
    };

    keyDown = (event: React.KeyboardEvent) => {
        // See https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values.
        switch (event.key) {
            case "Backspace":
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

    exprSelected = (selection: Expr) => {
        this.setState({ selection });
    };

    clearSelection = () => {
        this.setState({ selection: null });
    };

    render() {
        // As I understand it, svg viewBox is not a required property.
        return (
            <Box
                onKeyDown={this.keyDown}
                tabIndex={0}
                onClick={this.clearSelection}
                gridArea={this.props.gridArea}
                style={{ gridArea: this.props.gridArea }}
            >
                <ExprView
                    expr={
                        this.state.expr ??
                        new E.Hole(E.exprData("Empty function"))
                    }
                    selection={this.state.selection}
                    onClick={this.exprSelected}
                />
            </Box>
        );
    }
}

const ExprViewItem = styled.div`
    position: relative;
    border-radius: 3px;
    background: #f5f5f5;
`;

function ExprViewList({ exprs, gridArea }: LayoutProps & { exprs: Expr[] }) {
    return (
        <VerticalStack gridArea={gridArea} gap={10} alignItems="start">
            {exprs.map(x => (
                <ExprViewItem>
                    <ExprView expr={x} />
                </ExprViewItem>
            ))}
        </VerticalStack>
    );
}

const KaleContainer = styled.div`
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

const Heading = styled.h1`
    font-size: 20px;
    color: #0ba902;
`;

interface KaleState {
    yankList: Expr[];
}

function hole(comment: string) {
    return new E.Hole(E.exprData(comment));
}

class Kale extends Component<{}, KaleState> {
    private static toyBox = [
        new E.List([hole("first line"), hole("second line")]),
        new E.Call("if", [hole("true branch"), hole("false branch")]),
        new E.Variable("variable"),
        new E.Literal("a string", "str"),
        new E.Literal("42", "int"),
    ];

    state: KaleState = { yankList: [] };

    addToYankList = (expr: Expr) => {
        if (expr instanceof E.Hole) return;
        this.setState(state => ({
            yankList: state.yankList.concat([expr]),
        }));
    };

    render() {
        return (
            <KaleContainer>
                <GlobalStyle />
                <HorizonstalStack
                    gridArea="nav"
                    gap={10}
                    alignItems="baseline"
                    justifyContent="space-between"
                >
                    <Heading>Kale</Heading>
                    <p>Press backspace to delete</p>
                </HorizonstalStack>
                <ExprViewList gridArea="toybox" exprs={Kale.toyBox} />
                <Editor gridArea="editor" onRemovedExpr={this.addToYankList} />
                <ExprViewList gridArea="yanklist" exprs={this.state.yankList} />
            </KaleContainer>
        );
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    await TextMetrics.loadGlobal(KALE_THEME);
    ReactDOM.render(<Kale />, document.getElementById("main"));
});
