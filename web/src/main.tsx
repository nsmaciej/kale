import * as ReactDOM from "react-dom";
import React, { Component } from "react";
import { createGlobalStyle } from "styled-components";

import * as E from "./expr";
import { Expr } from "./expr";
import ExprView, { KALE_THEME } from "./expr_view";
import SAMPLE_EXPR from "./sample";
import TextMetrics from "./text_metrics";
import { Optional } from "./utils";

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
    expr: Optional<Expr>;
    selection: Optional<Expr>;
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
                this.setState(state => ({
                    expr:
                        state.selection && state.expr?.remove(state.selection),
                    selection: null,
                }));
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
                    {
                        <ExprView
                            expr={
                                this.state.expr ??
                                new E.Hole(E.exprData("Empty function"))
                            }
                            selection={this.state.selection}
                            onClick={this.exprSelected}
                        />
                    }
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
