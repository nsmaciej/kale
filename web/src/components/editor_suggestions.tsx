import React, { useState, useContext, Ref } from "react";
import styled from "styled-components";
import { AiOutlinePlusCircle } from "react-icons/ai";

import { SubtleButton, Shortcut, Box, Stack } from "components";
import Menu, { MenuTextWrapper } from "components/menu";
import useSuggestions from "suggestions";
import { Workspace } from "contexts/workspace";
import { assertSome } from "utils";

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

interface EditorSuggestionsProps {
    onOpenEditor(name: string): void;
}

export default React.forwardRef(function EditorSuggestions(
    { onOpenEditor }: EditorSuggestionsProps,
    ref: Ref<HTMLInputElement>,
) {
    const [value, setValue] = useState("");
    const [hasFocus, setHasFocus] = useState(false);
    const { ensureExists } = assertSome(useContext(Workspace));
    const { setSelection, selection, suggestions, moveSelection } = useSuggestions(value, {
        showValue: true,
    });

    function selectEditor(name: string) {
        ensureExists(name);
        onOpenEditor(name);
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
                        setHasFocus(true);
                    }}
                    onBlur={() => setHasFocus(false)}
                    ref={ref}
                    value={value}
                    placeholder="Open a function&hellip;"
                    spellCheck={false}
                    onKeyDown={onKeyDown}
                    onChange={onChange}
                />
                {hasFocus && suggestions.length > 0 && (
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
});
