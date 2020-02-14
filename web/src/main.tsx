import * as ReactDOM from "react-dom";
import React, { Component } from "react";
import { createGlobalStyle } from "styled-components";

import { Expr } from "./expr";
import ExprView, { KALE_THEME } from "./expr_view";
import SAMPLE_EXPR from "./sample";
import TextMetrics from "./text_metrics";

//TODO: Refactor, just stuff to make the demo look nice.
const GlobalStyle = createGlobalStyle`
body {
    margin: 60px 40px;
}
h1 {
    margin: 30px 0;
}
/* Hide the focus ring around focused divs */
div:focus {
    outline: none;
}
`;

interface EditorState {
    expr: Expr;
    selection: Expr | null;
}

class Editor extends Component<{}, EditorState> {
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
                alert("Deleting selection!");
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
        // As I understand it, viewBox is not a required property.
        return (
            <div
                onKeyDown={this.keyDown}
                tabIndex={0}
                onClick={this.clearSelection}
            >
                <GlobalStyle />
                <h1 style={{ fontFamily: KALE_THEME.fontFamily }}>
                    Kale Editor
                </h1>
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    style={{ width: "100%" }}
                    height="500"
                >
                    <ExprView
                        expr={this.state.expr}
                        selection={this.state.selection}
                        onClick={this.exprSelected}
                    />
                </svg>
            </div>
        );
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    await TextMetrics.loadGlobal(KALE_THEME);
    // new E.Call("print", [new E.Call("hello"), new E.Call("world")])
    ReactDOM.render(<Editor />, document.getElementById("main"));
});
