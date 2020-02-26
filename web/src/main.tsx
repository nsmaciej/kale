import * as ReactDOM from "react-dom";
import React, { Component } from "react";
import styled, {
    StyleSheetManager,
    createGlobalStyle,
    css,
} from "styled-components";
import { AnimatePresence, motion } from "framer-motion";

import * as E from "./expr";
import { Expr, ExprId } from "./expr";
import ExprView, { DragAndDropSurface } from "./expr_view";
import SAMPLE_EXPR from "./sample";
import TextMetrics from "./text_metrics";
import { Optional, assert, assertSome } from "./utils";
import THEME from "./theme";
import { Box, HorizonstalStack, VerticalStack, BoxProps } from "./components";

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
    font-family: "Asap", sans-serif;
    font-size: 14px;
    color: #404040;
}
/* Hide the focus ring around focused divs */
div:focus {
    outline: none;
}
/* Nothing inside svgs should be selectable */
svg * {
    user-select: none;
    cursor: default;
}
h1 {
    font-weight: 700;
    font-size: 25px;
}
h2, h3 {
    font-weight: 600;
    font-size: 20px;
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
    border-radius: ${THEME.exprViewPaddingPx}px;
    background: #fbfbfb;
    box-shadow: rgba(0, 0, 0, 0.05) 0px 0.5px 0px 0px,
        rgba(0, 0, 0, 0.05) 0px 0px 0px 1px, rgba(0, 0, 0, 0.05) 0px 2px 4px 0px;
`;

class Editor extends Component<BoxProps & EditorProps, EditorState> {
    private static readonly Container = styled(Box)<BoxProps>`
        ${ExprViewAppearance}
        padding: 10px 12px;
        overflow: auto;
        place-self: self-start;
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
            //TODO: Add tab - go to next blank.
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

interface ShortcutExpr {
    expr: Expr;
    shortcut?: string;
}

interface ExprViewListProps {
    exprs: ShortcutExpr[];
    frozen?: boolean;
    gridArea: string;
    heading: string;
}

const ExprViewItem = styled(motion.div)`
    grid-column: expr;
    justify-self: left;
    ${ExprViewAppearance}
`;

// Ripped from Stack Overflow.
const Shortcut = styled.div`
    display: inline-block;
    padding: 0.1em 0.3em;
    line-height: 1.4;
    color: #242729;
    text-shadow: 0 1px 0 #fff;
    background-color: #e1e3e5;
    border: 1px solid #adb3b8;
    border-radius: 3px;
    box-shadow: 0 1px 0 rgba(12, 13, 14, 0.2), 0 0 0 2px #fff inset;
    white-space: nowrap;
    margin: 0.1em;
`;

const ExprListShortcut = styled(Shortcut)`
    grid-column: shortcut;
    justify-self: right;
`;

const ExprList = styled.div`
    display: grid;
    grid-template-columns:
        [shortcut] auto
        [expr] min-content;
    gap: 10px;
    grid-auto-rows: min-content;
    align-items: start;
`;

const ExprListHeading = styled.h2`
    margin-bottom: 20px;
`;

function ExprViewList({ exprs, gridArea, frozen, heading }: ExprViewListProps) {
    if (!exprs.length) return null;
    return (
        <Box gridArea={gridArea}>
            <ExprListHeading>{heading}</ExprListHeading>
            <ExprList>
                <AnimatePresence>
                    {exprs.map(({ expr, shortcut }, i) => (
                        <React.Fragment key={expr.id}>
                            {shortcut && (
                                <ExprListShortcut>{shortcut}</ExprListShortcut>
                            )}
                            <ExprViewItem
                                initial={{ opacity: 0.8, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0.5 }}
                                transition={{ duration: 0.1, ease: "easeIn" }}
                            >
                                <ExprView expr={expr} frozen={frozen} />
                            </ExprViewItem>
                        </React.Fragment>
                    ))}
                </AnimatePresence>
            </ExprList>
        </Box>
    );
}

interface KaleState {
    yankList: ShortcutExpr[];
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
        /* TODO: Still a lot of messing with these left */
        grid-template-columns: max-content minmax(min-content, auto) max-content;
        gap: 20px 40px;
        padding: 25px 20px 0;
        height: 100%;
    `;

    private static readonly Heading = styled.h1`
        color: #0ba902;
    `;

    private static readonly toyBox = [
        {
            expr: new E.List([hole("first line"), hole("second line")]),
            shortcut: "L",
        },
        {
            expr: new E.Call("if", [hole("true branch"), hole("false branch")]),
            shortcut: "C",
        },
        { expr: new E.Variable("variable"), shortcut: "V" },
        { expr: new E.Literal("a string", "str") },
        { expr: new E.Literal("42", "int") },
    ];

    state: KaleState = { yankList: [] };

    private addToYankList = (expr: Expr) => {
        if (expr instanceof E.Hole) return;
        this.setState(({ yankList }) => {
            const shortcut =
                yankList.length > 9 ? undefined : yankList.length.toString();
            return {
                yankList: [{ expr, shortcut }, ...yankList],
            };
        });
    };

    render() {
        const S = Shortcut;
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
                            <p>
                                Press <S>backspace</S> to delete. Use <S>H</S>
                                <S>J</S>
                                <S>K</S>
                                <S>L</S> to move around.
                            </p>
                        </HorizonstalStack>
                        <ExprViewList
                            gridArea="toybox"
                            exprs={Kale.toyBox}
                            heading="Blocks"
                            frozen
                        />
                        <Editor
                            gridArea="editor"
                            onRemovedExpr={this.addToYankList}
                        />
                        <ExprViewList
                            gridArea="yanklist"
                            heading="Work List"
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
