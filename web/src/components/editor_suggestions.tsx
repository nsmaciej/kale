import React, { useContext, useState, createRef, useMemo, useCallback } from "react";
import styled from "styled-components";
import { AiOutlinePlusCircle } from "react-icons/ai";

import { EditorHeadingStyle } from "components";
import { assertSome } from "utils";
import { Workspace } from "workspace";
import Menu, { MenuItem } from "components/menu";

const Container = styled.div`
    display: relative;
`;

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

interface NewEditorInputProps {
    onCreateEditor: (topLevel: string) => void;
}

function useFocus() {
    const [focus, setFocus] = useState(false);
    const onFocus = () => setFocus(true);
    const onBlur = () => setFocus(false);
    return [focus, { onFocus, onBlur }];
}

interface Suggestion extends MenuItem<string> {
    name: string;
    create: boolean;
}

export default function EditorSuggestions({ onCreateEditor }: NewEditorInputProps) {
    const [value, setValue] = useState("");
    const [selection, setSelection] = useState(0);
    const workspace = assertSome(useContext(Workspace));
    const [focus, bindFocus] = useFocus();
    const inputRef = createRef<HTMLInputElement>();

    const selectEditor = useCallback(
        (name: string) => {
            onCreateEditor(name);
            inputRef.current?.blur();
            setValue("");
            setSelection(0);
        },
        [onCreateEditor, inputRef],
    );

    const suggestions = useMemo(() => {
        const r = Object.keys(workspace.topLevel)
            .filter(x => x.toLowerCase().includes(value.toLowerCase()))
            .slice(0, 5)
            .map(x => ({
                name: x,
                create: false,
                id: x,
                action: (i: Suggestion) => selectEditor(i.name),
            }));
        const fullMatch = Object.prototype.hasOwnProperty.call(workspace.topLevel, value);
        if (value && !fullMatch) {
            r.push({
                name: value,
                create: true,
                id: value,
                action: (i: Suggestion) => selectEditor(i.name),
            });
        }
        return r as Suggestion[];
    }, [selectEditor, value, workspace.topLevel]);

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

    return (
        <Container>
            <EditorInput
                {...bindFocus}
                ref={inputRef}
                value={value}
                placeholder="Open an editor&hellip;"
                spellCheck={false}
                onKeyDown={onKeyDown}
                onChange={onChange}
            />
            {focus && (
                <Menu items={suggestions} selected={suggestions[selection].id}>
                    {item => (
                        <>
                            {item.create && <AiOutlinePlusCircle />}
                            {item.create ? `Create "${item.name}"` : item.name}
                        </>
                    )}
                </Menu>
            )}
        </Container>
    );
}
