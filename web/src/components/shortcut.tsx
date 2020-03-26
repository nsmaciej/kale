import React from "react";
import styled from "styled-components";
import { Box } from "components";

const ShortcutKey = styled.kbd`
    display: inline-block;
    background-color: ${(p) => p.theme.colour.innerBackground};
    border-radius: 3px;
    border: 1px solid ${(p) => p.theme.colour.subtleClickable};
    box-shadow: 0 1px 1px ${(p) => p.theme.colour.subtleText};
    font-size: 0.85em;
    padding: 2px;
    white-space: nowrap;
    font-variant-numeric: normal;
    min-width: 1.5em;
    text-align: center;
    font-family: inherit;
    /* Ensure we always look snazzy no matter the context */
    color: ${(p) => p.theme.colour.mainText};
    line-height: 1;
    & + & {
        margin-left: 1ex;
    }
`;

// Note this element needs to be 'phrasing content' so that it can be contained in paragraphs.
const ShortcutGroup = styled.span`
    /* Prevent a shortcut group from containing line-breaks. */
    display: inline-block;
`;

export interface ShortcutProps {
    keys: string;
}

export default function Shortcut({ keys }: ShortcutProps) {
    function shortcutKeys(): string[] {
        if (keys === " ") return ["Space"];
        if (keys.length > 1) return [keys];
        if (/^[a-z]$/.test(keys)) return [keys.toUpperCase()];
        if (/^[A-Z]$/.test(keys)) return ["Shift", keys.toUpperCase()];
        return [keys];
    }

    return (
        <ShortcutGroup>
            {shortcutKeys().map((x) => (
                <ShortcutKey key={x}>{x}</ShortcutKey>
            ))}
        </ShortcutGroup>
    );
}
