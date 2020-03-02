import React, { useContext, useState, createRef, useMemo } from "react";
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
    padding: 6px;
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

interface NewEditorInputProps {
    onCreateEditor: (topLevel: string) => void;
}

function useFocus() {
    const [focus, setFocus] = useState(false);
    const onFocus = (_: React.FocusEvent) => setFocus(true);
    const onBlur = (_: React.FocusEvent) => setFocus(false);
    return [focus, { onFocus, onBlur }];
}

interface Suggestion {
    name: string;
    create: boolean;
}

export default function EditorSuggestions({ onCreateEditor }: NewEditorInputProps) {
    const [value, setValue] = useState("");
    const [selection, setSelection] = useState(0);
    const workspace = assertSome(useContext(Workspace));
    const [focus, bindFocus] = useFocus();
    const inputRef = createRef<HTMLInputElement>();

    const suggestions = useMemo(() => {
        const r = Object.keys(workspace.topLevel)
            .filter(x => x.toLowerCase().includes(value.toLowerCase()))
            .slice(0, 5)
            .map(x => ({ name: x, create: false }));
        const fullMatch = workspace.topLevel.hasOwnProperty(value);
        if (value && !fullMatch) {
            r.push({ name: value, create: true });
        }
        return r as Suggestion[];
    }, [value, workspace.topLevel]);

    function selectEditor(name: string) {
        onCreateEditor(name);
        inputRef.current?.blur();
        setValue("");
        setSelection(0);
    }

    function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        switch (e.key) {
            case "Enter":
                selectEditor(suggestions[selection].name);
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
        setValue(e.target.value);
        setSelection(0);
    }

    function renderSuggestions() {
        if (!suggestions.length) return;
        return (
            <EditorInputPopover vertical gap={1}>
                {suggestions.map((x, i) => (
                    <EditorInputSuggestion
                        key={x.name}
                        onMouseDown={e => e.preventDefault()} // Don't blur.
                        onClick={_ => selectEditor(x.name)}
                        selected={i == selection}
                    >
                        {x.create && <AiOutlinePlusCircle />}
                        {x.create ? `Create "${x.name}"` : x.name}
                    </EditorInputSuggestion>
                ))}
            </EditorInputPopover>
        );
    }

    return (
        <>
            <EditorInput
                {...bindFocus}
                ref={inputRef}
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
