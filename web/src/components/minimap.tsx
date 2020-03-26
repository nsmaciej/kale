import React from "react";
import styled from "styled-components";

import { assertFunc } from "vm/types";
import { assertSome } from "utils";
import { EditorStackActions, EditorKey, OpenedEditor } from "hooks/editor_stack";
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

function MinimapExpr({ name }: { name: string }) {
    const workspace = useContextChecked(Workspace).workspace;
    const expr = useDebounce(assertFunc(assertSome(workspace.scope.get(name))).expr, 1000);
    return <ExprView frozen scale={0.2} expr={expr} />;
}

export interface MinimapProps {
    editors: readonly OpenedEditor[];
    focused: EditorKey | null;
    editorStackDispatch: React.Dispatch<EditorStackActions>;
}

export default function Minimap({ editors, focused, editorStackDispatch }: MinimapProps) {
    return (
        <Stack vertical gap={15}>
            {editors.map((editor) => (
                <MinimapItemStack
                    key={editor.key.toString()}
                    onClick={() => editorStackDispatch({ type: "focusEditor", key: editor.key })}
                    focused={focused === editor.key}
                >
                    <span>{editor.name}</span>
                    {editor.type === "user" && <MinimapExpr name={editor.name} />}
                </MinimapItemStack>
            ))}
        </Stack>
    );
}
