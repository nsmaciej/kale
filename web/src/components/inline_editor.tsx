import React, { useState } from "react";
import styled from "styled-components";
import { AiOutlineBulb } from "react-icons/ai";

import TextMetrics from "text_metrics";
import { ExprArea } from "expr_view";
import { useSuggestions } from "hooks";
import Menu from "components/menu";

const Container = styled.div`
    position: absolute;
`;

const InlineEditorInput = styled.input`
    font-family: ${p => p.theme.fontFamily};
    font-size: ${p => p.theme.fontSizePx}px;
    line-height: 1;
    outline: 0;
    border: 0;
`;

interface InlineEditorProps {
    exprArea: ExprArea;
    value: string;
    onChange(value: string): void;
    onSubmit(value: string): void;
    onDismiss(): void;
}

export default function InlineEditor({
    value,
    exprArea,
    onChange,
    onSubmit,
    onDismiss,
}: InlineEditorProps) {
    const { setSelection, selection, suggestions, moveSelection } = useSuggestions(value);

    function onKeyDown(e: React.KeyboardEvent) {
        e.stopPropagation(); // Always stop propagation.
        if (e.key === "Escape") {
            onSubmit(value);
        } else if (e.key === "Enter" || e.key === "Tab") {
            if (selection == null || !suggestions.length) {
                onSubmit(value);
            } else {
                onSubmit(suggestions[selection].name);
            }
        } else if (e.key === "ArrowDown") {
            moveSelection(1);
        } else if (e.key === "ArrowUp") {
            moveSelection(-1);
        } else {
            return;
        }
        e.preventDefault();
    }

    function onChangeEvent(e: React.ChangeEvent<HTMLInputElement>) {
        setSelection(0);
        onChange(e.target.value);
    }

    const { offset, colour, italic, bold } = exprArea.textProps ?? {};
    const origin = exprArea.rect.origin;
    return (
        <Container
            style={{
                top: origin.y + (offset?.y ?? 0),
                left: origin.x + (offset?.x ?? 0),
            }}
        >
            <InlineEditorInput
                value={value}
                onBlur={() => onDismiss()}
                style={{
                    width: TextMetrics.global.measure(value, { bold, italic }).width,
                    color: colour,
                    fontStyle: italic ? "italic" : undefined,
                    fontWeight: bold ? "bold" : undefined,
                }}
                ref={r => r?.focus()}
                //TODO: Stop the editor from doing stuff, should check for focus instead.
                onKeyDown={onKeyDown}
                onChange={onChangeEvent}
            />
            {suggestions.length > 0 && (
                <Menu
                    subtle
                    items={suggestions}
                    selected={selection}
                    onClick={x => onSubmit(x.name)}
                    setSelected={i => setSelection(i)}
                >
                    {item => (
                        <>
                            <AiOutlineBulb />
                            {item.name}
                        </>
                    )}
                </Menu>
            )}
        </Container>
    );
}
