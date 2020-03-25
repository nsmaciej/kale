import React, { useState, Ref } from "react";
import styled from "styled-components";
import { AiOutlinePlusCircle } from "react-icons/ai";

import { EditorStackActions } from "hooks/editor_stack";
import { SubtleButton, Box, Stack } from "components";
import { useContextChecked } from "hooks";
import useSuggestions from "hooks/suggestions";
import Workspace from "contexts/workspace";

import Menu, { MenuTextWrapper } from "components/menu";
import Shortcut from "components/shortcut";

const inputWidthPx = 400;

const EditorInput = styled.input`
    font: inherit;
    color: inherit;
    border: 1px solid ${(p) => p.theme.colour.subtleClickable};
    border-radius: ${(p) => p.theme.general.borderRadius}px;
    width: ${inputWidthPx}px;
    position: relative;
    padding: 8px 5px;
    background: ${(p) => p.theme.colour.background};
    &:focus {
        border: 1px solid ${(p) => p.theme.colour.clickable};
    }
`;

interface EditorSuggestionsProps {
    editorStackDispatch: React.Dispatch<EditorStackActions>;
}

export default React.forwardRef(function EditorSuggestions(
    { editorStackDispatch }: EditorSuggestionsProps,
    ref: Ref<HTMLInputElement>,
) {
    const [value, setValue] = useState("");
    const [hasFocus, setHasFocus] = useState(false);
    const { setSelection, selection, suggestions, moveSelection } = useSuggestions(value, {
        showValue: true,
    });
    const workspace = useContextChecked(Workspace);

    function selectEditor(name: string) {
        editorStackDispatch({ type: "createEditor", name });
        workspace.dispatch({ type: "ensureExists", name });
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
        e.stopPropagation();
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
    }

    function onChange(e: React.ChangeEvent<HTMLInputElement>) {
        setValue(e.target.value);
        setSelection(0);
    }

    return (
        <Stack gap={10} alignItems="center">
            <div>
                <Shortcut keys="/" />
            </div>
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
                        width={inputWidthPx}
                        items={suggestions}
                        selected={selection}
                        onClick={(x) => selectEditor(x.name)}
                        onSetSelected={(i) => setSelection(i)}
                    >
                        {(item) => (
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
