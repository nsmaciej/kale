import React, { useContext, RefObject } from "react";
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
    margin-left: ${p => p.theme.exprView.padding.left}px;
`;

const EditorHeader = styled(Stack).attrs({ gap: 5 })`
    position: sticky;
    top: 0;
    background: ${p => p.theme.colour.background};
    padding-bottom: 5px;
    border-bottom: 1px solid ${p => p.theme.colour.grey};
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

interface EditorListProps extends MinimapProps {
    editors: readonly OpenedEditor[];
    onCloseEditor(index: number): void;
    onOpenEditor(index: number, name: string): void;
    onChangeFocus(index: number | null): void;
}

export default function EditorStack({
    focused,
    editors,
    onCloseEditor,
    onOpenEditor,
    onChangeFocus,
}: EditorListProps) {
    const dbg = assertSome(useContext(Debugger));

    function renderEditor(editor: OpenedEditor, i: number) {
        return (
            <motion.div
                key={editor.key}
                initial={false}
                exit={{ opacity: 0, scale: 0 }}
                transition={{ duration: 0.1, ease: "easeIn" }}
                positionTransition={{ duration: 0.1, ease: "easeIn" }}
            >
                <EditorHeader>
                    <EditorHeading>{editor.name}</EditorHeading>
                    <IconButton onClick={() => onCloseEditor(i)}>
                        <AiOutlineCloseCircle />
                    </IconButton>
                    <IconButton
                        onClick={() => dbg.evalFunction(editor.name)}
                        disabled={dbg.interpreter != null}
                    >
                        <AiOutlinePlayCircle />
                    </IconButton>
                </EditorHeader>
                <Box marginTop={10} marginBottom={20} overflowX="auto">
                    <EditorWrapper
                        functionName={editor.name}
                        onOpenEditor={name => onOpenEditor(i, name)}
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
            if (editor.ref.current === e.target) onChangeFocus(i);
        });
    }

    return (
        <Stack
            gap={20}
            height="100%"
            justifyContent="space-between"
            overflowX="hidden"
            onFocus={focus}
            // This is weird, but React lets the blur event bubble.
            onBlur={() => onChangeFocus(null)}
            gridArea="editor"
        >
            <Stack vertical overflowX="hidden" flex="auto">
                {editors.length === 0 && <NonIdealText>No editors open</NonIdealText>}
                <AnimatePresence>{editors.map(renderEditor)}</AnimatePresence>
            </Stack>
            <Box top={0} position="sticky" flex="none">
                <Minimap editors={editors} focused={focused} onChangeFocus={onChangeFocus} />
            </Box>
        </Stack>
    );
}
