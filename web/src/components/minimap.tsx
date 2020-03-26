import React from "react";
import styled from "styled-components";

import { assertFunc } from "vm/types";
import { assertSome } from "utils";
import { EditorStackActions, EditorKey } from "hooks/editor_stack";
import { Stack } from "components";
import { useDebounce, useContextChecked } from "hooks";
import ExprView from "expr_view";
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
        <MinimapItemStack key={editor.key.toString()} onClick={onClick} focused={focused}>
            <span>{editor.name}</span>
            <ExprView frozen scale={0.2} expr={expr} />
        </MinimapItemStack>
    );
}

export interface MinimapEditor {
    name: string;
    key: EditorKey;
}

export interface MinimapProps {
    editors: readonly MinimapEditor[];
    focused: EditorKey | null;
    editorStackDispatch: React.Dispatch<EditorStackActions>;
}

export default function Minimap({ editors, focused, editorStackDispatch }: MinimapProps) {
    return (
        <Stack vertical gap={15}>
            {editors.map((editor) => (
                <MinimapItem
                    key={editor.key.toString()}
                    editor={editor}
                    onClick={() => editorStackDispatch({ type: "focusEditor", key: editor.key })}
                    focused={editor.key === focused}
                />
            ))}
        </Stack>
    );
}
