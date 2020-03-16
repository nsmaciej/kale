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
    border-radius: ${p => p.theme.borderRadiusPx}px;
    padding: 5px;
    color: ${p => p.theme.clickableColour};
    ${p => p.focused && "background: #f9f9f9;"}
    border: 1px solid ${p => (p.focused ? "#e4e4e4" : "transparent")};
    &:hover {
        border: 1px solid ${p => p.theme.grey};
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
    editors: MinimapEditor[];
    focused: number | null;
    changeFocus(index: number): void;
}

export default function Minimap({ editors, focused, changeFocus }: MinimapProps) {
    return (
        <Stack vertical gap={15}>
            {editors.map((editor, i) => (
                <MinimapItem
                    key={editor.key}
                    editor={editor}
                    onClick={() => changeFocus(i)}
                    focused={i === focused}
                />
            ))}
        </Stack>
    );
}
