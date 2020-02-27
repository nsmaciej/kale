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
    font-family: "Nunito", sans-serif;
    font-size: 14px;
    color: #404040;
    line-height: 1;
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
    selection: Optional<ExprId>;
}

const ExprViewAppearance = css`
    border: 1px solid #dfe1e5;
    border-radius: ${THEME.exprViewPaddingPx}px;
`;

class Editor extends Component<BoxProps & EditorProps, EditorState> {
    private static readonly Container = styled(Box)<BoxProps>`
        ${ExprViewAppearance}
        padding: 10px 12px;
        overflow: auto;
        place-self: self-start;
        outline: none;
    `;

    private containerRef = React.createRef<HTMLDivElement>();

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
        const holes = state.expr.findAll(x => x instanceof E.Hole);
        const ix = holes.findIndex(x => x.id === state.selection);
        if (ix === -1) return holes[0].id;
        return holes[(ix + 1) % holes.length].id;
    }

    private setSelection(reducer: (state: EditorState) => Optional<ExprId>) {
        this.setState(state => ({
            selection: state.selection == null ? state.expr.id : reducer(state) ?? state.selection,
        }));
    }

    private keyDown = (event: React.KeyboardEvent) => {
        // See https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values.
        switch (event.key) {
            // Deletion.
            case "Backspace":
                this.setState(this.removeSelection);
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
            default:
                console.log("Can't handle", event.key);
                return;
        }
        event.preventDefault();
    };

    private createCircleClicked = (clickedId: ExprId) => {
        const clicked = this.state.expr?.withId(clickedId);
        if (clicked instanceof E.Call) {
            const newExpr = new E.Call(clicked.fn, clicked.args.concat(new E.Hole()), clicked.data);
            this.setState(({ selection, expr }) => ({
                // Try to preserve the selection.
                selection: selection === clickedId ? newExpr.id : selection,
                expr: expr.replace(clickedId, newExpr),
            }));
        }
    };

    private exprSelected = (selection: ExprId) => {
        this.setState({ selection });
    };
    private clearSelection = () => {
        this.setState({ selection: null });
    };

    componentDidMount() {
        this.containerRef.current?.focus();
    }

    render() {
        // As I understand it, svg viewBox is not a required property.
        return (
            <Editor.Container
                onKeyDown={this.keyDown}
                tabIndex={-1}
                onClick={this.clearSelection}
                gridArea={this.props.gridArea}
                ref={this.containerRef}
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
    animate?: boolean;
    exprs: ShortcutExpr[];
    frozen?: boolean;
}

const ExprViewItem = styled(motion.div)`
    grid-column: expr;
    justify-self: left;
    ${ExprViewAppearance}
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
`;

function ExprViewList({ exprs, frozen, animate }: ExprViewListProps) {
    if (!exprs.length) return null;
    const renderItem = (expr: Expr, shortcut?: string) => (
        // This has to be a fragment. Otherwise the items won't layout in a grid.
        <Fragment key={expr.id}>
            {shortcut && THEME.showingShortcuts && <ExprListShortcut>{shortcut}</ExprListShortcut>}
            <ExprViewItem
                initial={animate && { opacity: 0.8, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0.5 }}
                transition={{ duration: 0.1, ease: "easeIn" }}
            >
                <ExprView expr={expr} frozen={frozen} />
            </ExprViewItem>
        </Fragment>
    );
    return (
        <ExprList>
            <AnimatePresence>{exprs.map(x => renderItem(x.expr, x.shortcut))}</AnimatePresence>
        </ExprList>
    );
}

const ExprListHeading = styled.h2`
    margin-bottom: 10px;
`;

const Sidebar = styled(Box)`
    overflow: auto;
    padding: 2px; /* Otherwise hidden overflow cuts the shadows */
`;

const toyBoxExprs = [
    { shortcut: "S", expr: new E.List([hole("first line"), hole("second line")]) },
    { shortcut: "F", expr: new E.Call("if", [hole("true branch"), hole("false branch")]) },
    { shortcut: "A", expr: new E.Variable("variable") },
    { expr: new E.Literal("a string", "str") },
    { expr: new E.Literal("42", "int") },
];
function ToyBox() {
    return (
        <Sidebar gridArea="toybox">
            <ExprListHeading>Blocks</ExprListHeading>
            <ExprViewList frozen exprs={toyBoxExprs} />
        </Sidebar>
    );
}

function YankList({ exprs, onClearAll }: { exprs: ShortcutExpr[]; onClearAll: () => void }) {
    //TODO: Make these editors inside of ExprViews (and make it not frozen).
    if (!exprs.length) return null;
    return (
        <Sidebar gridArea="yanklist">
            <HorizonstalStack gap={10}>
                <ExprListHeading>Work List</ExprListHeading>
                <SubtleButton onClick={onClearAll}>Clear All</SubtleButton>
            </HorizonstalStack>
            <ExprViewList frozen animate exprs={exprs} />
        </Sidebar>
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
        grid-template-columns: max-content minmax(min-content, auto) max-content;
        gap: 20px 40px;
        padding: 25px 20px 0;
        height: 100%;
    `;

    private static readonly Heading = styled.h1`
        color: #0ba902;
        letter-spacing: 2px;
    `;

    private static readonly Help = styled.p`
        max-width: 500px;
    `;

    state: KaleState = { yankList: [] };

    private addToYankList = (expr: Expr) => {
        if (expr instanceof E.Hole) return;
        this.setState(({ yankList }) => ({
            // Remove duplicate ids.
            yankList: [expr, ...yankList.filter(x => x.id !== expr.id)],
        }));
    };

    private clearYankList = () => {
        this.setState({ yankList: [] });
    };

    private static renderHelp() {
        const S = Shortcut;
        return (
            <Kale.Help>
                Use <S>H</S> <S>J</S> <S>K</S> <S>L</S> to move around. Fill in the blanks with{" "}
                <S>Tab</S>. Use <S>Backspace</S> to Delete and <S>C</S> to Copy &mdash;{" "}
                <b>Help is on the way!</b>
            </Kale.Help>
        );
    }

    render() {
        const yankList: ShortcutExpr[] = this.state.yankList.map((x, i) => ({
            shortcut: i < 10 ? i.toString() : undefined,
            expr: x,
        }));
        return (
            <StyleSheetManager disableVendorPrefixes>
                <DragAndDropSurface>
                    <GlobalStyle />
                    <Kale.Container>
                        <HorizonstalStack gridArea="nav" gap={10}>
                            <Kale.Heading>Kale</Kale.Heading>
                            {Kale.renderHelp()}
                        </HorizonstalStack>
                        {THEME.showingToyBox && <ToyBox />}
                        <Editor gridArea="editor" onRemovedExpr={this.addToYankList} />
                        <YankList exprs={yankList} onClearAll={this.clearYankList} />
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
