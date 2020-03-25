import React from "react";
import styled from "styled-components";
import { Box } from "components";

const ShortcutKey = styled.kbd<{ subtle?: boolean }>`
    display: inline-block;
    background-color: ${(p) => (p.subtle ? p.theme.colour.innerBackground : p.theme.colour.grey)};
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

export interface ShortcutProps {
    keys: string;
    subtle?: boolean;
}

export default function Shortcut({ keys, subtle }: ShortcutProps) {
    function shortcutKeys(): string[] {
        if (keys === " ") return ["Space"];
        if (keys.length > 1) return [keys];
        if (/^[a-z]$/.test(keys)) return [keys.toUpperCase()];
        if (/^[A-Z]$/.test(keys)) return ["Shift", keys.toUpperCase()];
        return [keys];
    }

    // Prevent a shortcut group from containing line-breaks.
    return (
        <Box display="inline-block">
            {shortcutKeys().map((x) => (
                <ShortcutKey key={x} subtle={subtle}>
                    {x}
                </ShortcutKey>
            ))}
        </Box>
    );
}
