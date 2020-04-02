import { AiOutlineCloseCircle, AiOutlinePlayCircle, AiOutlineUndo } from "react-icons/ai";
import { motion, AnimatePresence } from "framer-motion";
import React, { ReactNode } from "react";
import styled from "styled-components";

import { Box, Stack, NonIdealText, IconButton, PaneHeading } from "components";
import { useContextChecked } from "hooks";
import Builtins from "vm/builtins";
import EditorWrapper from "editor";

import Minimap from "components/minimap";
import Shortcut from "components/shortcut";

import Debugger from "contexts/debugger";
import EditorStack, { OpenedEditor } from "contexts/editor_stack";
import Workspace from "contexts/workspace";

const EditorHeading = styled(PaneHeading)`
    margin-left: ${(p) => p.theme.exprView.padding.left}px;
`;

const EditorHeader = styled(Stack).attrs({ gap: 5 })`
    position: sticky;
    top: 0;
    background: ${(p) => p.theme.colour.background};
    padding-bottom: 5px;
    border-bottom: 1px solid ${(p) => p.theme.colour.grey};
    align-items: center;
    z-index: 50;
`;

const RightGroup = styled.div`
    margin-left: auto;
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
        <>
            <EditorHeader>
                <EditorHeading>{editor.name}</EditorHeading>
                <IconButton onClick={() => editorStack.removeEditor(editor.key)}>
                    <AiOutlineCloseCircle />
                </IconButton>
                {buttons}
                <RightGroup>{rightButtons}</RightGroup>
            </EditorHeader>
            <Box marginTop={10} marginBottom={20} overflowX="auto">
                {children}
            </Box>
        </>
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

export default function EditorList() {
    const editorStack = useContextChecked(EditorStack);
    return (
        <Stack
            gap={20}
            height="100%"
            justifyContent="space-between"
            overflowX="hidden"
            gridArea="editor"
        >
            <Stack vertical overflowX="hidden" flex="auto">
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
            <Box top={0} position="sticky" flex="none">
                <Minimap />
            </Box>
        </Stack>
    );
}
