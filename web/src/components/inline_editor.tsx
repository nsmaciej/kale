import React from "react";
import styled from "styled-components";
import { AiOutlineBulb, AiOutlineBlock } from "react-icons/ai";

import { FlatExprArea } from "expr_view";
import { useDisableScrolling } from "hooks";
import Menu from "components/menu";
import TextMetrics from "text_metrics";
import useSuggestions from "hooks/suggestions";

const Container = styled.div`
    position: absolute;
`;

const InlineEditorInput = styled.input`
    font-family: ${p => p.theme.expr.fontFamily};
    font-size: ${p => p.theme.expr.fontSizePx}px;
    line-height: 1;
    outline: 0;
    border: 0;
    background: ${p => p.theme.highlight.selection.fill(false)};
`;

interface InlineEditorProps {
    exprArea: FlatExprArea;
    value: string;
    disableSuggestions: boolean;
    onChange(value: string): void;
    onSubmit(value: string): void;
    onDismiss(): void;
}

export default function InlineEditor({
    value,
    exprArea,
    disableSuggestions,
    onChange,
    onSubmit,
    onDismiss,
}: InlineEditorProps) {
    useDisableScrolling();
    const { setSelection, selection, suggestions, moveSelection } = useSuggestions(value, {
        showSpecials: true,
        disable: disableSuggestions,
    });

    function onKeyDown(e: React.KeyboardEvent) {
        e.stopPropagation(); // Always stop propagation.
        if (e.key === "Escape") {
            onDismiss();
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

    const textProps = exprArea.text ?? {};
    const { offset, colour, italic, weight } = textProps;
    const origin = exprArea.rect.origin;
    // Make sure the input is always at least wide enough to show the cursor.
    const widthFudge = 2;
    const width = TextMetrics.global.measure(value, textProps).width + widthFudge;
    return (
        <Container
            style={{
                top: origin.y + (offset?.y ?? 0),
                left: origin.x + (offset?.x ?? 0),
            }}
        >
            <InlineEditorInput
                value={value}
                onBlur={onDismiss}
                style={{
                    width,
                    color: colour,
                    fontStyle: italic ? "italic" : undefined,
                    fontWeight: weight,
                }}
                ref={r => r?.focus()}
                onKeyDown={onKeyDown}
                onChange={onChangeEvent}
            />
            {suggestions.length > 0 && (
                <Menu
                    noPadding
                    items={suggestions}
                    selected={selection}
                    onClick={x => onSubmit(x.name)}
                    setSelected={i => setSelection(i)}
                >
                    {item => (
                        <>
                            {item.special ? <AiOutlineBlock /> : <AiOutlineBulb />}
                            {item.name}
                        </>
                    )}
                </Menu>
            )}
        </Container>
    );
}
