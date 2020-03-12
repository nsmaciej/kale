import React, { useState, useRef } from "react";
import styled from "styled-components";
import { AiOutlinePlusCircle } from "react-icons/ai";

import { SubtleButton, Shortcut, Box, Stack } from "components";
import Menu, { MenuTextWrapper } from "components/menu";
import { useSuggestions } from "hooks";

const inputWidthPx = 400;

const EditorInput = styled.input`
    border: 0;
    font: inherit;
    color: inherit;
    border: 1px solid ${p => p.theme.clickableSubtleColour};
    border-radius: ${p => p.theme.borderRadiusPx}px;
    width: ${inputWidthPx}px;
    &:focus {
        border: 1px solid ${p => p.theme.clickableColour};
    }
    position: relative;
    padding: 8px 5px;
`;

interface NewEditorInputProps {
    onCreateEditor: (topLevel: string) => void;
}

export default function EditorSuggestions({ onCreateEditor }: NewEditorInputProps) {
    const [value, setValue] = useState("");
    const [focus, setFocus] = useState(false);
    const { setSelection, selection, suggestions, moveSelection } = useSuggestions(value, {
        showValue: true,
    });
    const inputRef = useRef<HTMLInputElement>(null);

    function selectEditor(name: string) {
        onCreateEditor(name);
        inputRef.current?.blur();
        setValue("");
        setSelection(0);
    }

    function selectCurrent() {
        // If there is really no suggestions we are probably using a special name.
        if (suggestions.length) {
            selectEditor(selection == null ? value : suggestions[selection].name);
        }
    }

    function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === "Enter") {
            selectCurrent();
        } else if (e.key === "ArrowDown") {
            moveSelection(1);
        } else if (e.key === "ArrowUp") {
            moveSelection(-1);
        } else {
            return;
        }
        e.preventDefault();
        e.stopPropagation();
    }

    function onChange(e: React.ChangeEvent<HTMLInputElement>) {
        setValue(e.target.value);
        setSelection(0);
    }

    return (
        <Stack gap={10} alignItems="center">
            <Shortcut>N</Shortcut>
            <Box position="relative">
                <EditorInput
                    onFocus={() => {
                        setSelection(0);
                        setFocus(true);
                    }}
                    onBlur={() => setFocus(false)}
                    ref={inputRef}
                    value={value}
                    placeholder="Open a function&hellip;"
                    spellCheck={false}
                    onKeyDown={onKeyDown}
                    onChange={onChange}
                />
                {focus && suggestions.length > 0 && (
                    <Menu
                        items={suggestions}
                        selected={selection}
                        width={inputWidthPx}
                        onClick={x => selectEditor(x.name)}
                        setSelected={i => setSelection(i)}
                    >
                        {item => (
                            <>
                                {item.original && <AiOutlinePlusCircle style={{ flex: "none" }} />}
                                <MenuTextWrapper>
                                    {item.original ? `Create "${item.name}"` : item.name}
                                </MenuTextWrapper>
                            </>
                        )}
                    </Menu>
                )}
            </Box>
            <SubtleButton onClick={() => selectCurrent()} disabled={suggestions.length === 0}>
                Open
            </SubtleButton>
        </Stack>
    );
}
