import React, { useContext } from "react";
import styled, { useTheme } from "styled-components";

import { Stack } from "components";
import { assertSome } from "utils";
import ExprView from "expr_view";
import { assertFunc } from "vm/types";
import { useDebounce } from "hooks";

import { Workspace } from "contexts/workspace";

const MinimapItemStack = styled(Stack).attrs({ gap: 8, vertical: true })<{ focused: boolean }>`
    user-select: none;
    border-radius: ${p => p.theme.borderRadius}px;
    padding: 5px;
    color: ${p => p.theme.colour.clickable};
    ${p => p.focused && `background: ${p.theme.colour.innerBackground};`}
    border: 1px solid ${p => (p.focused ? p.theme.colour.grey : "transparent")};
    &:hover {
        border: 1px solid ${p => p.theme.colour.subtleClickable};
    }
`;

function MinimapItem({
    editor,
    focused,
    onClick,
}: {
    editor: MinimapEditor;
    focused: boolean;
    onClick(): void;
}) {
    const theme = useTheme();
    const workspace = assertSome(useContext(Workspace));
    const expr = useDebounce(assertFunc(workspace.get(editor.name)).expr, 1000);
    return (
        <MinimapItemStack key={editor.key} onClick={onClick} focused={focused}>
            <span>{editor.name}</span>
            <ExprView frozen theme={theme} scale={0.2} expr={expr} />
        </MinimapItemStack>
    );
}

export interface MinimapEditor {
    name: string;
    key: number;
}

export interface MinimapProps {
    editors: readonly MinimapEditor[];
    focused: number | null;
    onChangeFocus(index: number): void;
}

export default function Minimap({ editors, focused, onChangeFocus }: MinimapProps) {
    return (
        <Stack vertical gap={15}>
            {editors.map((editor, i) => (
                <MinimapItem
                    key={editor.key}
                    editor={editor}
                    onClick={() => onChangeFocus(i)}
                    focused={i === focused}
                />
            ))}
        </Stack>
    );
}
