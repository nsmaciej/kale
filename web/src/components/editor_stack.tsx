import React, { useContext } from "react";
import styled from "styled-components";
import { motion, AnimatePresence } from "framer-motion";
import { AiOutlineCloseCircle, AiOutlinePlayCircle } from "react-icons/ai";

import { Box, Stack, NonIdealText, EditorHeadingStyle, IconButton } from "components";
import InnerEditor from "editor";
import { Debugger } from "contexts/debugger";
import { assertSome } from "utils";

const EditorHeading = styled.h2`
    ${EditorHeadingStyle}
    margin-left: ${p => p.theme.exprViewPaddingPx}px;
`;

const EditorHeader = styled(Stack).attrs({ gap: 5 })`
    position: sticky;
    top: 0;
    background: #ffffff;
    padding-bottom: 5px;
    border-bottom: 1px solid ${p => p.theme.grey};
    align-items: center;
    z-index: 50;
    & > *:last-child {
        margin-left: auto;
    }
`;

export interface OpenEditor {
    id: number;
    topLevel: string;
}

interface EditorStackProps {
    onClose(editorId: number): void;
    editors: OpenEditor[];
}

export default function EditorStack({ onClose, editors }: EditorStackProps) {
    const dbg = assertSome(useContext(Debugger));
    return (
        <Box gridArea="editor" height="100%">
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
                                <IconButton onClick={() => onClose(i)}>
                                    <AiOutlineCloseCircle />
                                </IconButton>
                                <IconButton
                                    onClick={() => dbg.evalFunction(editor.topLevel)}
                                    disabled={dbg.interpreter != null}
                                >
                                    <AiOutlinePlayCircle />
                                </IconButton>
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
        </Box>
    );
}
