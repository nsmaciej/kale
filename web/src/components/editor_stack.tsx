import React, { useContext, useState, useEffect } from "react";
import styled, { useTheme } from "styled-components";
import { motion, AnimatePresence } from "framer-motion";
import { AiOutlineCloseCircle, AiOutlinePlayCircle } from "react-icons/ai";

import { Box, Stack, NonIdealText, EditorHeadingStyle, IconButton } from "components";
import EditorWrapper from "editor";
import { Debugger } from "contexts/debugger";
import { Workspace } from "contexts/workspace";
import { assertSome } from "utils";
import ExprView from "expr_view";
import { assertFunc } from "vm/types";

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

const MinimapStack = styled(Stack).attrs({ gap: 15, vertical: true })`
    top: 0;
    position: sticky;
    user-select: none;
`;

const MinimapItemStack = styled(Stack).attrs({ gap: 8, vertical: true })`
    border-radius: ${p => p.theme.borderRadiusPx}px;
    padding: 5px;
    color: ${p => p.theme.clickableColour};
    &:hover {
        background: #eee;
    }
`;

export interface OpenedFunction {
    id: number;
    name: string;
}

interface EditorStackProps {
    onClose(editorId: number): void;
    editors: OpenedFunction[];
}

function useDebounce<T>(value: T, delayMs: number) {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delayMs);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delayMs]);
    return debouncedValue;
}

function MinimapItem({ editor }: { editor: OpenedFunction }) {
    const theme = useTheme();
    const workspace = assertSome(useContext(Workspace));
    const expr = useDebounce(assertFunc(workspace.get(editor.name)).expr, 1000);
    return (
        <MinimapItemStack
            key={editor.id}
            onClick={() => alert(`Focus on ${editor.id} (${editor.name})`)}
        >
            <span>{editor.name}</span>
            <ExprView frozen theme={theme} scale={0.2} expr={expr} />
        </MinimapItemStack>
    );
}

export default function EditorStack({ onClose, editors }: EditorStackProps) {
    const dbg = assertSome(useContext(Debugger));

    function renderEditor(editor: OpenedFunction, i: number) {
        return (
            <motion.div
                key={editor.id}
                initial={false}
                exit={{ opacity: 0, scale: 0 }}
                transition={{ duration: 0.1, ease: "easeIn" }}
                positionTransition={{ duration: 0.1, ease: "easeIn" }}
                style={{ width: "max-content" }}
            >
                <EditorHeader>
                    <EditorHeading>{editor.name}</EditorHeading>
                    <IconButton onClick={() => onClose(i)}>
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
                        topLevelName={editor.name}
                        //TODO: This seems reasonable but not sure if needed.
                        key={editor.name}
                    />
                </Box>
            </motion.div>
        );
    }

    return (
        <Stack gap={20} height="100%" justifyContent="space-between" overflow="auto">
            <Box gridArea="editor" height="100%">
                {editors.length === 0 && <NonIdealText>No editors open</NonIdealText>}
                <AnimatePresence>{editors.map(renderEditor)}</AnimatePresence>
            </Box>
            <MinimapStack>
                {editors.map(editor => (
                    <MinimapItem key={editor.id} editor={editor} />
                ))}
            </MinimapStack>
        </Stack>
    );
}
