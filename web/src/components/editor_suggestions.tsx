import React, { useContext, useState } from "react";
import styled from "styled-components";
import { AiOutlinePlusCircle } from "react-icons/ai";

import { Stack, EditorHeadingStyle } from "components";
import { assertSome } from "utils";
import { Workspace } from "workspace";

const EditorInput = styled.input`
    border: 0;
    font: inherit;
    color: inherit;
    border-bottom: 1px solid ${p => p.theme.grey};
    ${EditorHeadingStyle}
    width: 400px;
    &:focus {
        border-bottom: 1px solid ${p => p.theme.clickableColour};
    }
    position: relative;
`;

const EditorInputPopover = styled(Stack)`
    width: 400px; /* TODO: Remove this - shouldn't be needed but doesn't work without this */
    position: absolute;
    background: #ffffff;
    border-radius: 0 0 ${p => p.theme.borderRadiusPx}px ${p => p.theme.borderRadiusPx}px;
    box-shadow: 0 0 0 1px #10161a1a, 0 2px 4px #10161a33, 0 8px 24px #10161a33;
    padding: 8px 4px;
`;

const EditorInputSuggestion = styled.div<{ selected: boolean }>`
    user-select: none;
    border-radius: ${p => p.theme.borderRadiusPx}px;
    padding: 8px 8px;
    background: ${p => (p.selected ? p.theme.clickableColour : "transparent")};
    display: flex;
    align-items: center;
    & > svg {
        margin-right: 5px;
    }
    &:hover {
        background: ${p => (p.selected ? p.theme.clickableColour : p.theme.grey)};
    }
    color: ${p => (p.selected ? "white" : "black")};
`;

interface EditorSuggestionsProps {
    onCreateEditor: (topLevel: string) => void;
}

function useFocus() {
    const [focus, setFocus] = useState(false);
    const onFocus = (_: React.FocusEvent) => setFocus(true);
    const onBlur = (_: React.FocusEvent) => setFocus(false);
    return [focus, { onFocus, onBlur }];
}

export default function EditorSuggestions({ onCreateEditor }: EditorSuggestionsProps) {
    const [value, setValue] = useState("");
    const [selection, setSelection] = useState(0);
    const workspace = assertSome(useContext(Workspace));
    const [focus, bindFocus] = useFocus();

    const suggestions = Object.keys(workspace.topLevel)
        .filter(x => x.toLowerCase().includes(value.toLowerCase()))
        .slice(0, 5);
    const fullMatch = workspace.topLevel.hasOwnProperty(value);
    const showCreate = value && !fullMatch;
    if (showCreate) suggestions.push(value);

    function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        switch (e.key) {
            case "Enter":
                onCreateEditor(suggestions[selection]);
                (e.target as HTMLElement).blur();
                setValue("");
                break;
            case "ArrowDown":
                setSelection(x => (x + 1) % suggestions.length);
                break;
            case "ArrowUp":
                setSelection(x => (x - 1 + suggestions.length) % suggestions.length);
                break;
            default:
                return;
        }
        e.preventDefault();
        e.stopPropagation();
    }
    function onChange(e: React.ChangeEvent<HTMLInputElement>) {
        setSelection(0);
        setValue(e.target.value);
    }

    function renderSuggestions() {
        if (!suggestions.length) return;
        return (
            <EditorInputPopover vertical>
                {suggestions.map((x, i) => (
                    <EditorInputSuggestion
                        key={x}
                        onClick={_ => onCreateEditor(x)}
                        selected={i == selection}
                    >
                        {showCreate && i == suggestions.length - 1 && <AiOutlinePlusCircle />}
                        {x}
                    </EditorInputSuggestion>
                ))}
            </EditorInputPopover>
        );
    }

    return (
        <>
            <EditorInput
                {...bindFocus}
                value={value}
                placeholder="Open an editor&hellip;"
                spellCheck={false}
                onKeyDown={onKeyDown}
                onChange={onChange}
            />
            {focus && renderSuggestions()}
        </>
    );
}
