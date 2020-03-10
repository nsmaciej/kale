import React, { useState } from "react";
import styled, { useTheme } from "styled-components";
import { motion, AnimatePresence } from "framer-motion";
import { AiOutlineClose } from "react-icons/ai";

import { Box, Stack, NonIdealText, Shortcut, EditorHeadingStyle } from "components";
import InnerEditor from "editor";
import { removeIndex } from "utils";
import EditorSuggestions from "components/editor_suggestions";

const EditorHeading = styled.h2`
    ${EditorHeadingStyle}
    margin-left: ${p => p.theme.exprViewPaddingPx}px;
`;

const EditorHeader = styled(Stack).attrs({ gap: 5 })`
    position: sticky;
    top: 0;
    background: #ffffff;
    padding: 15px 0 5px;
    border-bottom: 1px solid ${p => p.theme.grey};
    align-items: center;
    z-index: 50;
`;

interface Editor {
    id: number;
    topLevel: string;
}

let GlobalEditorId = 1;

export default function EditorStack() {
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
