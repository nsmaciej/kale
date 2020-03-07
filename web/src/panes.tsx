import React, { Fragment, useContext, useState, ReactNode } from "react";
import styled, { useTheme } from "styled-components";
import { motion, AnimatePresence } from "framer-motion";
import { AiOutlineClose, AiOutlinePushpin, AiFillPushpin } from "react-icons/ai";

import * as E from "expr";
import Expr from "expr";
import ExprView from "expr_view";
import { Box, Stack, SubtleButton, NonIdealText, EditorHeadingStyle, Shortcut } from "components";
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

const EditorHeader = styled(Stack).attrs({ gap: 5 })`
    position: sticky;
    top: 0;
    background: #ffffff;
    padding: 15px 0 5px;
    border-bottom: 1px solid ${p => p.theme.grey};
    align-items: center;
`;

interface Editor {
    id: number;
    topLevel: string;
}

let GlobalEditorId = 1;

export function EditorStack() {
    const theme = useTheme();
    const [editors, setEditors] = useState<Editor[]>([
        { topLevel: "Sample 1", id: GlobalEditorId++ },
        { topLevel: "Sample 1", id: GlobalEditorId++ },
    ]);
    return (
        <Stack vertical gridArea="editor" height="100%">
            <Stack gap={10} alignItems="center">
                <Shortcut>O</Shortcut>
                <EditorSuggestions
                    onCreateEditor={topLevel =>
                        setEditors(xs => [{ topLevel, id: GlobalEditorId++ }, ...xs])
                    }
                />
            </Stack>
            <Stack vertical overflow="auto" flex="1 1 1px" alignItems="start">
                {editors.length === 0 && <NonIdealText>No editors open</NonIdealText>}
                <AnimatePresence>
                    {editors.map((editor, i) => (
                        <motion.div
                            key={editor.id}
                            initial={false}
                            exit={{ opacity: 0, scale: 0 }}
                            style={{ alignSelf: "start" }}
                            transition={{ duration: 0.1, ease: "easeIn" }}
                            positionTransition={{ duration: 0.1, ease: "easeIn" }}
                        >
                            <EditorHeader>
                                <EditorHeading>{editor.topLevel}</EditorHeading>
                                <AiOutlineClose
                                    color={theme.clickableColour}
                                    onClick={() => setEditors(xs => removeIndex(xs, i))}
                                />
                            </EditorHeader>
                            <Box marginTop={10} marginBottom={20}>
                                <InnerEditor
                                    topLevelName={editor.topLevel}
                                    //TODO: This seems reasonable but not sure if needed.
                                    key={editor.topLevel}
                                    stealFocus={i === 0}
                                />
                            </Box>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </Stack>
        </Stack>
    );
}
