import * as ReactDOM from "react-dom";
import React, { Component, Fragment } from "react";
import styled, { StyleSheetManager, createGlobalStyle, css } from "styled-components";
import { AnimatePresence, motion } from "framer-motion";

import * as E from "./expr";
import { Expr, ExprId } from "./expr";
import ExprView, { DragAndDropSurface } from "./expr_view";
import SAMPLE_EXPR from "./sample";
import TextMetrics from "./text_metrics";
import { Optional, assert, assertSome } from "./utils";
import THEME from "./theme";
import { Box, HorizonstalStack, BoxProps, Shortcut, SubtleButton } from "./components";

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
    font: 14px/1 "Nunito", sans-serif;
    color: #404040;
}
p {
    line-height: 1.8;
    font-variant-numeric: oldstyle-nums;
}
/* Nothing inside svgs should be selectable */
svg * {
    user-select: none;
    cursor: default;
}
h1, h2, h3 {
    user-select: none;
}
h1 {
    font-weight: 900;
    font-size: 25px;
}
h2, h3 {
    font-weight: 700;
    font-size: 20px;
}
`;

interface EditorProps {
    onRemovedExpr: (expr: Expr) => void;
}

interface EditorState {
    expr: Expr;
    focused: boolean;
    selection: Optional<ExprId>;
}

class Editor extends Component<BoxProps & EditorProps, EditorState> {
    private static readonly Container = styled(Box)`
        overflow: auto;
        outline: none;
    `;

    private containerRef = React.createRef<HTMLDivElement>();

    state: EditorState = {
        selection: null,
        focused: true,
        expr: SAMPLE_EXPR,
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
                tabIndex={-1}
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

interface ShortcutExpr {
    expr: Expr;
    shortcut?: string;
}

interface ExprViewListProps {
    animate?: boolean;
    exprs: ShortcutExpr[];
    frozen?: boolean;
    fallback?: string;
}

const ExprViewItem = styled(motion.div)`
    grid-column: expr;
    justify-self: left;
    border: 1px solid #dfe1e5;
    border-radius: ${THEME.exprViewPaddingPx}px;
`;

const ExprListShortcut = styled(Shortcut)`
    grid-column: shortcut;
    justify-self: right;
    margin-top: ${THEME.exprViewPaddingPx / 2}px;
`;

const ExprList = styled.div`
    display: grid;
    grid-template-columns:
        [shortcut] auto
        [expr] min-content;
    gap: 10px;
    grid-auto-rows: min-content;
    align-items: start;
    margin: 20px 0 40px;
`;

function ExprViewList({ exprs, frozen, animate, fallback }: ExprViewListProps) {
    const renderItem = (expr: Expr, shortcut?: string) => (
        // This has to be a fragment. Otherwise the items won't layout in a grid.
        <Fragment key={expr.id}>
            {shortcut && THEME.showingShortcuts && <ExprListShortcut>{shortcut}</ExprListShortcut>}
            <ExprViewItem
                initial={animate && { opacity: 0.8, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.1, ease: "easeIn" }}
            >
                <ExprView expr={expr} frozen={frozen} />
            </ExprViewItem>
        </Fragment>
    );
    return (
        <ExprList>
            {exprs.length === 0 && <p>{fallback}</p>}
            {exprs.map(x => renderItem(x.expr, x.shortcut))}
        </ExprList>
    );
}

const toyBoxExprs = [
    { shortcut: "S", expr: new E.List([blank("first line"), blank("second line")]) },
    { shortcut: "F", expr: new E.Call("if", [blank("true branch"), blank("false branch")]) },
    { shortcut: "A", expr: new E.Variable("variable") },
    { expr: new E.Literal("a string", "str") },
    { expr: new E.Literal("42", "int") },
];
function ToyBox() {
    return (
        <Box gridArea="toybox" overflow="auto">
            <h2>Blocks</h2>
            <ExprViewList frozen exprs={toyBoxExprs} />
        </Box>
    );
}

function YankList({ exprs, onClearAll }: { exprs: Expr[]; onClearAll: () => void }) {
    //TODO: Make these editors inside of ExprViews (and make it not frozen).
    const yankList = exprs.map((x, i) => ({
        shortcut: i < 10 ? i.toString() : undefined,
        expr: x,
    }));
    return (
        <Box gridArea="yanklist" overflow="auto">
            <HorizonstalStack gap={10} alignItems="baseline">
                <h2>Clipboard History</h2>
                <SubtleButton onClick={onClearAll} disabled={yankList.length === 0}>
                    Clear All
                </SubtleButton>
            </HorizonstalStack>
            <ExprViewList frozen animate exprs={yankList} fallback="Nothing here yet." />
        </Box>
    );
}

interface KaleState {
    yankList: Expr[];
}

function blank(comment: string) {
    return new E.Blank(E.exprData(comment));
}

class Kale extends Component<{}, KaleState> {
    private static readonly Container = styled.div`
        display: grid;
        grid-template-areas:
            "nav nav nav"
            "toybox editor yanklist";
        grid-template-rows: min-content auto;
        grid-template-columns: max-content minmax(min-content, auto) max-content;
        gap: 20px 40px;
        padding: 15px 20px 0;
        height: 100%;
    `;

    private static readonly Heading = styled.h1`
        color: #0ba902;
        letter-spacing: 2px;
    `;

    private static readonly Help = styled.p`
        max-width: 600px;
    `;

    state: KaleState = { yankList: [] };

    private readonly addToYankList = (expr: Expr) => {
        if (expr instanceof E.Blank) return;
        this.setState(({ yankList }) => ({
            // Remove duplicate ids.
            yankList: [expr, ...yankList.filter(x => x.id !== expr.id)],
        }));
    };

    private readonly clearYankList = () => {
        this.setState({ yankList: [] });
    };

    private static renderHelp() {
        const S = Shortcut;
        return (
            <Kale.Help>
                Use <S>H</S> <S>J</S> <S>K</S> <S>L</S> to move around. Fill in the blanks with{" "}
                <S>Tab</S>. Use <S>Backspace</S> to Delete and <S>C</S> to Copy. Create blanks with
                the circular buttons or <S>A</S> &mdash; <b>Help is on the way!</b>
            </Kale.Help>
        );
    }

    render() {
        return (
            <React.StrictMode>
                <StyleSheetManager disableVendorPrefixes>
                    <DragAndDropSurface>
                        <GlobalStyle />
                        <Kale.Container>
                            <HorizonstalStack
                                gridArea="nav"
                                gap={10}
                                alignItems="center"
                                paddingBottom={15}
                                borderBottom="1px solid #e4e4e4"
                            >
                                <Kale.Heading>Kale</Kale.Heading>
                                {Kale.renderHelp()}
                            </HorizonstalStack>
                            {THEME.showingToyBox && <ToyBox />}
                            <Editor gridArea="editor" onRemovedExpr={this.addToYankList} />
                            <YankList exprs={this.state.yankList} onClearAll={this.clearYankList} />
                        </Kale.Container>
                    </DragAndDropSurface>
                </StyleSheetManager>
            </React.StrictMode>
        );
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    await TextMetrics.loadGlobal();
    ReactDOM.render(<Kale />, document.getElementById("main"));
});
