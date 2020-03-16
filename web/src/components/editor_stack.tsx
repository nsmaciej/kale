import React, { useContext, useEffect, RefObject } from "react";
import styled from "styled-components";
import { motion, AnimatePresence } from "framer-motion";
import { AiOutlineCloseCircle, AiOutlinePlayCircle } from "react-icons/ai";

import { Box, Stack, NonIdealText, EditorHeadingStyle, IconButton } from "components";
import Minimap, { MinimapProps } from "components/minimap";
import EditorWrapper from "editor";
import { assertSome } from "utils";
import { Debugger } from "contexts/debugger";

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

export interface OpenedEditor {
    key: number;
    name: string;
    ref: RefObject<HTMLDivElement>;
}

interface EditorStackProps extends MinimapProps {
    editors: OpenedEditor[];
    closeEditor(index: number): void;
    openEditor(name: string): void;
    changeFocus(index: number | null): void;
}

export default function EditorStack({
    focused,
    editors,
    closeEditor,
    openEditor,
    changeFocus,
}: EditorStackProps) {
    const dbg = assertSome(useContext(Debugger));

    function renderEditor(editor: OpenedEditor, i: number) {
        return (
            <motion.div
                key={editor.key}
                initial={false}
                exit={{ opacity: 0, scale: 0 }}
                transition={{ duration: 0.1, ease: "easeIn" }}
                positionTransition={{ duration: 0.1, ease: "easeIn" }}
                style={{ width: "max-content" }}
            >
                <EditorHeader>
                    <EditorHeading>{editor.name}</EditorHeading>
                    <IconButton onClick={() => closeEditor(i)}>
                        <AiOutlineCloseCircle />
                    </IconButton>
                    <IconButton
                        onClick={() => dbg.evalFunction(editor.name)}
                        disabled={dbg.interpreter != null}
                    >
                        <AiOutlinePlayCircle />
                    </IconButton>
                </EditorHeader>
                <Box marginTop={10} marginBottom={20}>
                    <EditorWrapper
                        functionName={editor.name}
                        openEditor={openEditor}
                        ref={editor.ref}
                        // It's proably easiest to just create a new editor for each function.
                        key={editor.name}
                    />
                </Box>
            </motion.div>
        );
    }

    function focus(e: React.FocusEvent) {
        // Check if focused landed on of the editors.
        editors.forEach((editor, i) => {
            if (editor.ref.current === e.target) changeFocus(i);
        });
    }

    // Focus on the first editor when we mount.
    useEffect(() => {
        if (focused != null) {
            editors[focused]?.ref.current?.focus();
        }
    }, [editors, focused]);

    return (
        <Stack
            gap={20}
            height="100%"
            justifyContent="space-between"
            overflow="auto"
            onFocus={focus}
            // This is weird, but React lets the blur event bubble.
            onBlur={() => changeFocus(null)}
        >
            <Box gridArea="editor" height="100%">
                {editors.length === 0 && <NonIdealText>No editors open</NonIdealText>}
                <AnimatePresence>{editors.map(renderEditor)}</AnimatePresence>
            </Box>
            <Box top={0} position="sticky">
                <Minimap editors={editors} focused={focused} changeFocus={changeFocus} />
            </Box>
        </Stack>
    );
}
