import React, { useContext, useEffect } from "react";
import styled, { useTheme } from "styled-components";
import { motion, AnimatePresence } from "framer-motion";
import { AiOutlineCloseCircle, AiOutlinePlayCircle } from "react-icons/ai";

import { Box, Stack, NonIdealText, EditorHeadingStyle, IconButton } from "components";
import EditorWrapper from "editor";
import { assertSome } from "utils";
import ExprView from "expr_view";
import { assertFunc } from "vm/types";
import { useDebounce, useRefList, useIndex } from "hooks";

import { Debugger } from "contexts/debugger";
import { Workspace } from "contexts/workspace";

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

const MinimapItemStack = styled(Stack).attrs({ gap: 8, vertical: true })<{ focused: boolean }>`
    border-radius: ${p => p.theme.borderRadiusPx}px;
    padding: 5px;
    color: ${p => p.theme.clickableColour};
    ${p => p.focused && "background: #eee"};
    border: 1px solid transparent;
    &:hover {
        border: 1px solid #eee;
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

function MinimapItem({
    editor,
    onClick,
    focused,
}: {
    editor: OpenedFunction;
    onClick: () => void;
    focused: boolean;
}) {
    const theme = useTheme();
    const workspace = assertSome(useContext(Workspace));
    const expr = useDebounce(assertFunc(workspace.get(editor.name)).expr, 1000);
    return (
        <MinimapItemStack key={editor.id} onClick={onClick} focused={focused}>
            <span>{editor.name}</span>
            <ExprView frozen theme={theme} scale={0.2} expr={expr} />
        </MinimapItemStack>
    );
}

export default function EditorStack({ onClose, editors }: EditorStackProps) {
    const dbg = assertSome(useContext(Debugger));
    const refs = useRefList<HTMLDivElement>(editors);
    const [focused, setFocused, moveFocused] = useIndex(refs.length, 0);

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
                        ref={refs[i]}
                        //TODO: This seems reasonable but not sure if needed.
                        key={editor.name}
                    />
                </Box>
            </motion.div>
        );
    }

    function focus(e: React.FocusEvent) {
        // Check if focused landed on of the editors.
        refs.forEach((ref, i) => {
            if (ref.current === e.target) setFocused(i);
        });
    }

    function keyDown(e: React.KeyboardEvent) {
        if (e.key === "J") {
            moveFocused(1);
        } else if (e.key === "K") {
            moveFocused(-1);
        } else {
            return;
        }
        e.preventDefault();
        e.stopPropagation();
    }

    // Focus on the first editor when we mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => void (focused != null && refs[focused]?.current?.focus()), [focused]);

    return (
        <Stack
            gap={20}
            height="100%"
            justifyContent="space-between"
            overflow="auto"
            onFocus={focus}
            // This is weird, but React lets the blur event bubble.
            onBlur={() => setFocused(null)}
            onKeyDown={keyDown}
        >
            <Box gridArea="editor" height="100%">
                {editors.length === 0 && <NonIdealText>No editors open</NonIdealText>}
                <AnimatePresence>{editors.map(renderEditor)}</AnimatePresence>
            </Box>
            <MinimapStack>
                {editors.map((editor, i) => (
                    <MinimapItem
                        key={editor.id}
                        editor={editor}
                        onClick={() => setFocused(i)}
                        focused={i === focused}
                    />
                ))}
            </MinimapStack>
        </Stack>
    );
}
