import React, { Fragment, useContext, useState } from "react";
import styled from "styled-components";
import { motion } from "framer-motion";
import { IoIosClose } from "react-icons/io";

import * as E from "./expr";
import Expr from "./expr";
import ExprView from "./expr_view";
import THEME from "./theme";
import { Box, Stack, Shortcut, SubtleButton } from "./components";
import InnerEditor from "./editor";
import { assertSome, removeIndex } from "./utils";
import { Clipboard } from "./workspace";

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

const ExprListItem = styled(motion.div)`
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
            <ExprListItem
                initial={animate && { opacity: 0.8, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.1, ease: "easeIn" }}
            >
                <ExprView expr={expr} frozen={frozen} />
            </ExprListItem>
        </Fragment>
    );
    return (
        <ExprList>
            {exprs.length === 0 && <p>{fallback}</p>}
            {exprs.map(x => renderItem(x.expr, x.shortcut))}
        </ExprList>
    );
}

function blank(comment: string) {
    return new E.Blank(E.exprData(comment));
}

const toyBoxExprs = [
    { shortcut: "S", expr: new E.List([blank("first line"), blank("second line")]) },
    { shortcut: "F", expr: new E.Call("if", [blank("true branch"), blank("false branch")]) },
    { shortcut: "A", expr: new E.Variable("variable") },
    { expr: new E.Literal("a string", "str") },
    { expr: new E.Literal("42", "int") },
];

export function ToyBox() {
    return (
        <Box gridArea="toybox" overflow="auto">
            <h2>Blocks</h2>
            <ExprViewList frozen exprs={toyBoxExprs} />
        </Box>
    );
}

export function ClipboardList() {
    const { clipboard, setClipboard } = assertSome(useContext(Clipboard));
    const history = clipboard.map((x, i) => ({
        shortcut: i < 10 ? i.toString() : undefined,
        expr: x,
    }));
    return (
        <Box gridArea="history" overflow="auto">
            <Stack gap={10} alignItems="baseline" justifyContent="space-between">
                <h2>History</h2>
                <SubtleButton onClick={_ => setClipboard([])} disabled={history.length === 0}>
                    Clear All
                </SubtleButton>
            </Stack>
            <ExprViewList frozen animate exprs={history} fallback="Nothing here yet." />
        </Box>
    );
}

export function EditorStack() {
    const [editors, setEditors] = useState<string[]>(["Sample 1", "Sample 2", "Sample 1"]);
    return (
        <Stack vertical gridArea="editor" overflow="auto" gap={40}>
            {editors.length === 0 && <p>No editors open</p>}
            {editors.map((topLevelName, i) => (
                <div>
                    <Stack alignItems="center" gap={5}>
                        <h3>{topLevelName}</h3>
                        <IoIosClose
                            color={THEME.buttonTextColour}
                            onClick={_ => setEditors(xs => removeIndex(xs, i))}
                        />
                    </Stack>
                    <InnerEditor topLevelName={topLevelName} stealFocus={i === 0} />
                </div>
            ))}
        </Stack>
    );
}
