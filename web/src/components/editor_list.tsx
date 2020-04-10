import {
    AiOutlineCloseCircle,
    AiOutlineDelete,
    AiOutlineEdit,
    AiOutlineMore,
    AiOutlinePlayCircle,
    AiOutlinePlus,
    AiOutlineRight,
    AiOutlineTag,
    AiOutlineUndo,
} from "react-icons/ai";
import { motion, AnimatePresence } from "framer-motion";
import React, { ReactNode } from "react";
import styled from "styled-components";

import { Box, Stack, NonIdealText, IconButton, PaneHeading, StackSpacer } from "components";
import { useContextChecked, useMediaQuery } from "hooks";
import Builtins from "vm/builtins";
import EditorWrapper from "editor";

import Minimap from "components/minimap";
import Shortcut from "components/shortcut";
import Button from "components/button";

import Debugger from "contexts/debugger";
import EditorStack, { OpenedEditor } from "contexts/editor_stack";
import Workspace from "contexts/workspace";

const EditorItemContainer = styled.div`
    border-radius: 10px;
    border: 1px solid ${(p) => p.theme.colour.subtleClickable};
    padding: 10px;
`;

const EditorHeader = styled(Stack).attrs({ gap: 5 })`
    padding-left: ${(p) => p.theme.exprView.padding.left}px;
    align-items: center;
`;

function EditorItem({
    children,
    editor,
    buttons,
    rightButtons,
}: {
    children: ReactNode;
    editor: OpenedEditor;
    buttons?: ReactNode;
    rightButtons?: ReactNode;
}) {
    const editorStack = useContextChecked(EditorStack);
    return (
        <EditorItemContainer>
            <EditorHeader>
                <PaneHeading>{editor.name}</PaneHeading>
                <IconButton onClick={() => editorStack.removeEditor(editor.key)}>
                    <AiOutlineCloseCircle />
                </IconButton>
                {buttons}
                <StackSpacer />
                {rightButtons}
            </EditorHeader>
            <Box marginTop={10} overflowX="auto">
                {children}
            </Box>
        </EditorItemContainer>
    );
}

function BuiltinEditor({ editor }: { editor: OpenedEditor }) {
    const editorStack = useContextChecked(EditorStack);
    return (
        <EditorItem editor={editor}>
            <p tabIndex={0} ref={editorStack.refs.get(editor.key)}>
                {editor.name} is a builtin function.
                <br />
                <b>{Builtins[editor.name].value.help}</b>
            </p>
        </EditorItem>
    );
}

function UserEditor({ editor }: { editor: OpenedEditor }) {
    const dbg = useContextChecked(Debugger);
    const editorStack = useContextChecked(EditorStack);
    const { workspace, dispatch } = useContextChecked(Workspace);
    const canUndo = (workspace.history.get(editor.name)?.length ?? 0) > 0;
    return (
        <EditorItem
            editor={editor}
            buttons={
                <IconButton disabled={!canUndo}>
                    <AiOutlineUndo onClick={() => dispatch({ type: "undo", name: editor.name })} />
                </IconButton>
            }
            rightButtons={
                <IconButton
                    onClick={() => dbg.evalFunction(editor.name)}
                    disabled={dbg.interpreter != null}
                >
                    <AiOutlinePlayCircle />
                </IconButton>
            }
        >
            <EditorWrapper
                functionName={editor.name}
                focused={editor.key === editorStack.lastFocus}
                ref={editorStack.refs.get(editor.key)}
                // It's proably easiest to just create a new editor for each function.
                key={editor.name}
            />
        </EditorItem>
    );
}

const EditorMenuStack = styled(Stack).attrs({ gap: 8 })`
    z-index: 100;
    position: sticky;
    top: 0;
    background: ${(p) => p.theme.colour.background};
    padding-bottom: 5px;
`;

const ComingSoon = styled.div`
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: ${(p) => p.theme.colour.background};
    opacity: 0.85;
    color: ${(p) => p.theme.colour.subtleText};
    display: table-cell;
    display: flex;
    justify-content: center;
    align-items: center;
`;

function EditorMenu() {
    return (
        <EditorMenuStack>
            <Button name="Edit" icon={<AiOutlineEdit />} />
            <Button name="Comment" icon={<AiOutlineTag />} />
            <Button name="New Space" icon={<AiOutlineRight />} />
            <StackSpacer />
            <Button menu name="New" icon={<AiOutlinePlus />} />
            <Button menu name="Delete" icon={<AiOutlineDelete />} />
            <Button menu name="More" icon={<AiOutlineMore />} />
            <ComingSoon>
                <p>Coming Soon</p>
            </ComingSoon>
        </EditorMenuStack>
    );
}

export default function EditorList() {
    const editorStack = useContextChecked(EditorStack);
    const showMinimap = useMediaQuery("(min-width: 1350px)");
    return (
        <Stack gap={20} justifyContent="space-between" overflow="auto">
            <Stack vertical gap={20} flex="auto" overflow="auto">
                <EditorMenu />
                {editorStack.stack.length === 0 && (
                    <NonIdealText>
                        No editors open.
                        <br />
                        Use the Function Search field or <Shortcut keys="/" /> to open one.
                    </NonIdealText>
                )}
                <AnimatePresence>
                    {editorStack.stack.map((x) => (
                        <motion.div
                            initial={false}
                            exit={{ opacity: 0, scale: 0 }}
                            transition={{ duration: 0.1, ease: "easeIn" }}
                            positionTransition={{ duration: 0.1, ease: "easeIn" }}
                            key={x.key.toString()}
                        >
                            {x.type === "builtin" ? (
                                <BuiltinEditor editor={x} />
                            ) : (
                                <UserEditor editor={x} />
                            )}
                        </motion.div>
                    ))}
                </AnimatePresence>
            </Stack>
            {showMinimap && (
                <Box top={0} position="sticky" flex="none" overflow="auto">
                    <Minimap />
                </Box>
            )}
        </Stack>
    );
}
