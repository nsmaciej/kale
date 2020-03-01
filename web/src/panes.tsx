import React, { Fragment, useContext, useState, ReactNode } from "react";
import styled from "styled-components";
import { motion } from "framer-motion";
import { AiOutlineClose, AiOutlinePushpin, AiFillPushpin } from "react-icons/ai";

import * as E from "expr";
import Expr from "expr";
import ExprView from "expr_view";
import THEME from "theme";
import { Box, Stack, Shortcut, SubtleButton } from "components";
import InnerEditor from "editor";
import { assertSome, removeIndex, replaceIndex } from "utils";
import { Clipboard } from "workspace";

const ExprListItem = styled(motion.div)`
    grid-column: expr;
    justify-self: left;
    border: 1px solid #dfe1e5;
    border-radius: ${THEME.exprViewPaddingPx}px;
    display: flex;
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

const Extras = styled.div`
    margin: ${THEME.exprViewPaddingPx}px !important;
`;

interface ShortcutExpr {
    expr: Expr;
    shortcut?: string;
}

interface ExprViewListProps<E> {
    animate?: boolean;
    items: E[];
    frozen?: boolean;
    fallback?: string;
    extras?: (item: E) => ReactNode;
}

function ExprViewList<E extends ShortcutExpr>({
    items,
    frozen,
    animate,
    fallback,
    extras,
}: ExprViewListProps<E>) {
    const renderItem = (item: E) => (
        // This has to be a fragment. Otherwise the items won't layout in a grid.
        <Fragment key={item.expr.id}>
            {item.shortcut && THEME.showingShortcuts && (
                <ExprListShortcut>{item.shortcut}</ExprListShortcut>
            )}
            <ExprListItem
                initial={animate && { opacity: 0.8, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.1, ease: "easeIn" }}
            >
                <ExprView expr={item.expr} frozen={frozen} />
                {extras && <Extras>{extras(item)}</Extras>}
            </ExprListItem>
        </Fragment>
    );
    return (
        <ExprList>
            {items.length === 0 && <p>{fallback}</p>}
            {items.map(renderItem)}
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
            <ExprViewList frozen items={toyBoxExprs} />
        </Box>
    );
}

export function ClipboardList() {
    const clipboard = assertSome(useContext(Clipboard));
    const history = clipboard.clipboard.map((x, i) => ({
        ...x,
        shortcut: i < 10 ? i.toString() : undefined,
    }));
    return (
        <Box gridArea="history" overflow="auto">
            <Stack gap={10} alignItems="baseline" justifyContent="space-between">
                <h2>History</h2>
                <SubtleButton onClick={_ => clipboard.clear()} disabled={!clipboard.canBeCleared()}>
                    Clear All
                </SubtleButton>
            </Stack>
            <ExprViewList
                frozen
                animate
                items={history}
                fallback="Nothing here yet."
                extras={item => (
                    <SubtleButton onClick={_ => clipboard.togglePinned(item.expr.id)}>
                        {item.pinned ? <AiFillPushpin /> : <AiOutlinePushpin />}
                    </SubtleButton>
                )}
            />
        </Box>
    );
}

const EditorHeading = styled.h2`
    margin-left: ${THEME.exprViewPaddingPx}px;
    font-variant-numeric: oldstyle-nums;
`;

export function EditorStack() {
    const [editors, setEditors] = useState<string[]>(["Sample 1", "Sample 2", "Sample 1"]);
    return (
        <Stack vertical gridArea="editor" overflow="auto" gap={40}>
            {editors.length === 0 && <p>No editors open</p>}
            {editors.map((topLevelName, i) => (
                //TODO: Don't use i as the key.
                <div key={i}>
                    <Stack alignItems="center" gap={5}>
                        <EditorHeading>{topLevelName}</EditorHeading>
                        <AiOutlineClose
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
