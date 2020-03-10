import React, { useState, useRef } from "react";
import styled from "styled-components";
import { AiOutlinePlusCircle } from "react-icons/ai";

import { EditorHeadingStyle } from "components";
import Menu, { MenuTextWrapper } from "components/menu";
import { useSuggestions } from "hooks";

const Container = styled.div`
    display: relative;
`;

const inputWidthPx = 400;

const EditorInput = styled.input`
    border: 0;
    font: inherit;
    color: inherit;
    border: 1px solid ${p => p.theme.clickableGrey};
    border-radius: ${p => p.theme.borderRadiusPx}px;
    ${EditorHeadingStyle};
    width: ${inputWidthPx}px;
    &:focus {
        border: 1px solid ${p => p.theme.clickableColour};
    }
    position: relative;
    padding: 5px;
`;

interface NewEditorInputProps {
    onCreateEditor: (topLevel: string) => void;
}

export default function EditorSuggestions({ onCreateEditor }: NewEditorInputProps) {
    const [value, setValue] = useState("");
    const [focus, setFocus] = useState(false);
    const { setSelection, selection, suggestions, moveSelection } = useSuggestions(value, true);
    const inputRef = useRef<HTMLInputElement>(null);

    function selectEditor(name: string) {
        onCreateEditor(name);
        inputRef.current?.blur();
        setValue("");
        setSelection(0);
    }

    function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === "Enter") {
            if (selection == null || !suggestions.length) {
                selectEditor(value);
            } else {
                selectEditor(suggestions[selection].name);
            }
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
        <Container>
            <EditorInput
                onFocus={() => {
                    setSelection(0);
                    setFocus(true);
                }}
                onBlur={() => setFocus(false)}
                ref={inputRef}
                value={value}
                placeholder="Open an editor&hellip;"
                spellCheck={false}
                onKeyDown={onKeyDown}
                onChange={onChange}
            />
            {focus && (
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
        </Container>
    );
}
