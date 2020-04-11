import React from "react";
import styled from "styled-components";

import { assertFunc } from "vm/types";
import { assertSome } from "utils";
import { Stack } from "components";
import { useDebounce, useContextChecked } from "hooks";
import { useSelector } from "state/root";
import ExprView from "expr_view";

import EditorStack, { OpenedEditor } from "contexts/editor_stack";

const MinimapItemStack = styled(Stack).attrs({ gap: 8, vertical: true })<{ focused: boolean }>`
    border-radius: ${(p) => p.theme.general.borderRadius}px;
    padding: 5px;
    color: ${(p) => p.theme.colour.clickable};
    ${(p) => p.focused && `background: ${p.theme.colour.background};`}
    border: 1px solid ${(p) => (p.focused ? p.theme.colour.subtleClickable : "transparent")};
    &:hover {
        border: 1px solid ${(p) => p.theme.colour.subtleClickable};
    }
`;

function MinimapExpr({ name }: { name: string }) {
    const scope = useSelector((x) => x.workspace.scope);
    const expr = useDebounce(assertFunc(assertSome(scope.get(name))).expr, 1000);
    return <ExprView immutable atomic persistent scale={0.2} expr={expr} />;
}

export default function Minimap() {
    const editorStack = useContextChecked(EditorStack);
    function onPointerUp(editor: OpenedEditor, event: React.MouseEvent) {
        if (event.button === 0) {
            editorStack.refs.get(editor.key)?.current.focus();
        } else if (event.button === 1) {
            editorStack.removeEditor(editor.key);
        } else {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
    }

    return (
        <Stack vertical gap={15}>
            {editorStack.stack.map((editor) => (
                <MinimapItemStack
                    key={editor.key.toString()}
                    onPointerUp={(e) => onPointerUp(editor, e)}
                    focused={editorStack.lastFocus === editor.key}
                >
                    <span>{editor.name}</span>
                    {editor.type === "user" && <MinimapExpr name={editor.name} />}
                </MinimapItemStack>
            ))}
        </Stack>
    );
}
