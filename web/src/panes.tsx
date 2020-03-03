import React, { Fragment, useContext, useState, ReactNode } from "react";
import styled, { useTheme } from "styled-components";
import { motion } from "framer-motion";
import { AiOutlineClose, AiOutlinePushpin, AiFillPushpin } from "react-icons/ai";

import * as E from "expr";
import Expr from "expr";
import ExprView from "expr_view";
import { Box, Stack, Shortcut, SubtleButton, NonIdealText, EditorHeadingStyle } from "components";
import InnerEditor from "editor";
import { assertSome, removeIndex } from "utils";
import { Clipboard } from "workspace";
import EditorSuggestions from "components/editor_suggestions";

const PaneHeading = styled.h2`
    ${EditorHeadingStyle}
`;

const ExprListItem = styled(motion.div)`
    grid-column: expr;
    justify-self: left;
    border: 1px solid #dfe1e5;
    border-radius: ${p => p.theme.exprViewPaddingPx}px;
    display: flex;
`;

const ExprListShortcut = styled(Shortcut)`
    grid-column: shortcut;
    justify-self: right;
    margin-top: ${p => p.theme.exprViewPaddingPx / 2}px;
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
    margin: ${p => p.theme.exprViewPaddingPx}px !important;
`;

interface ShortcutExpr {
    expr: Expr;
    shortcut?: string;
}

interface ExprViewListProps<E> {
    animate?: boolean;
    small?: boolean;
    items: E[];
    frozen?: boolean;
    fallback?: ReactNode;
    extras?: (item: E) => ReactNode;
}

function ExprViewList<E extends ShortcutExpr>({
    items,
    frozen,
    animate,
    fallback,
    small,
    extras,
}: ExprViewListProps<E>) {
    const theme = useTheme();
    const renderItem = (item: E) => (
        // This has to be a fragment. Otherwise the items won't layout in a grid.
        <Fragment key={item.expr.id}>
            {item.shortcut && theme.showingShortcuts && (
                <ExprListShortcut>{item.shortcut}</ExprListShortcut>
            )}
            <ExprListItem
                initial={animate && { opacity: 0.8, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.1, ease: "easeIn" }}
            >
                <ExprView expr={item.expr} frozen={frozen} theme={theme} scale={small ? 0.6 : 1} />
                {extras && <Extras>{extras(item)}</Extras>}
            </ExprListItem>
        </Fragment>
    );
    return (
        <ExprList>
            {items.length === 0 && fallback}
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
    const theme = useTheme();
    if (!theme.showingToyBox) return null;
    return (
        <Box gridArea="toybox" overflow="auto">
            <PaneHeading>Blocks</PaneHeading>
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
                <PaneHeading>History</PaneHeading>
                <SubtleButton
                    onClick={() => clipboard.clear()}
                    disabled={!clipboard.canBeCleared()}
                >
                    Clear All
                </SubtleButton>
            </Stack>
            <ExprViewList
                frozen
                animate
                small
                items={history}
                fallback={
                    <NonIdealText>
                        Nothing here yet.
                        <br />
                        Use <Shortcut>C</Shortcut> to copy something
                    </NonIdealText>
                }
                extras={item => (
                    <SubtleButton onClick={() => clipboard.togglePinned(item.expr.id)}>
                        {item.pinned ? <AiFillPushpin /> : <AiOutlinePushpin />}
                    </SubtleButton>
                )}
            />
        </Box>
    );
}

const EditorHeading = styled(PaneHeading)`
    margin-left: ${p => p.theme.exprViewPaddingPx}px;
`;

const EditorInputWrapper = styled.div`
    margin-left: ${p => p.theme.exprViewPaddingPx}px;
`;

export function EditorStack() {
    const theme = useTheme();
    const [editors, setEditors] = useState<string[]>(["Sample 1", "Sample 2", "Sample 1"]);
    return (
        <Stack vertical gridArea="editor" overflow="auto" gap={40}>
            {editors.length === 0 && <p>No editors open</p>}
            <EditorInputWrapper>
                <EditorSuggestions onCreateEditor={x => setEditors(xs => [x, ...xs])} />
            </EditorInputWrapper>
            {editors.map((topLevelName, i) => (
                //TODO: Don't use i as the key.
                <div key={i}>
                    <Stack alignItems="center" gap={5}>
                        <EditorHeading>{topLevelName}</EditorHeading>
                        <AiOutlineClose
                            color={theme.clickableColour}
                            onClick={() => setEditors(xs => removeIndex(xs, i))}
                        />
                    </Stack>
                    <InnerEditor topLevelName={topLevelName} stealFocus={i === 0} />
                </div>
            ))}
        </Stack>
    );
}
