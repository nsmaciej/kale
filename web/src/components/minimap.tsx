import React from "react";
import styled from "styled-components";

import { Stack } from "components";
import { assertSome } from "utils";
import ExprView from "expr_view";
import { assertFunc } from "vm/types";
import { useDebounce, useContextChecked } from "hooks";

import { EditorStackActions } from "hooks/editor_stack";
import Workspace from "contexts/workspace";

const MinimapItemStack = styled(Stack).attrs({ gap: 8, vertical: true })<{ focused: boolean }>`
    border-radius: ${(p) => p.theme.general.borderRadius}px;
    padding: 5px;
    color: ${(p) => p.theme.colour.clickable};
    ${(p) => p.focused && `background: ${p.theme.colour.innerBackground};`}
    border: 1px solid ${(p) => (p.focused ? p.theme.colour.grey : "transparent")};
    &:hover {
        border: 1px solid ${(p) => p.theme.colour.subtleClickable};
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
    const workspace = useContextChecked(Workspace).workspace;
    const expr = useDebounce(assertFunc(assertSome(workspace.scope.get(editor.name))).expr, 1000);
    return (
        <MinimapItemStack key={editor.key} onClick={onClick} focused={focused}>
            <span>{editor.name}</span>
            <ExprView frozen scale={0.2} expr={expr} />
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
    editorStackDispatch: React.Dispatch<EditorStackActions>;
}

export default function Minimap({ editors, focused, editorStackDispatch }: MinimapProps) {
    return (
        <Stack vertical gap={15}>
            {editors.map((editor, i) => (
                <MinimapItem
                    key={editor.key}
                    editor={editor}
                    onClick={() => editorStackDispatch({ type: "focusEditor", index: i })}
                    focused={i === focused}
                />
            ))}
        </Stack>
    );
}
