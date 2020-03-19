import { useState, useContext } from "react";
import produce from "immer";

import { removeIndex, mod, assertSome } from "utils";
import { useRefMap } from "hooks";
import { builtinFunctions } from "vm/interpreter";
import { Workspace } from "contexts/workspace";

function findNearestIndex<T>(
    list: readonly T[],
    index: number,
    predicate: (item: T) => boolean,
): number | null {
    for (let i = index; i >= 0; --i) {
        if (predicate(list[i])) return i;
    }
    for (let i = index + 1; i < list.length; ++i) {
        if (predicate(list[i])) return i;
    }
    return null;
}

let GlobalEditorId = 1;

export type EditorKey = number;

export interface OpenedEditor {
    type: "builtin" | "user";
    key: EditorKey;
    name: string;
}

interface EditorStack {
    jumpList: readonly EditorKey[];
    stack: readonly OpenedEditor[];
    focus: number | null;
}

function focusEditor(state: EditorStack, index: number | null): EditorStack {
    return produce(state, draft => {
        if (draft.focus != null && index != null) {
            // If index is null this is a blur, don't push onto the jump-list.
            const key = draft.stack[draft.focus].key;
            if (!draft.jumpList.length || draft.jumpList[draft.jumpList.length - 1] !== key) {
                draft.jumpList.push(key);
            }
        }
        draft.focus = index;
    });
}

function createAndFocusEditor(state: EditorStack, name: string): EditorStack {
    const updated = produce(state, draft => {
        draft.stack.unshift({
            name,
            key: GlobalEditorId++,
            type: builtinFunctions.has(name) ? "builtin" : "user",
        });
    });
    return focusEditor(updated, 0);
}

function jumpBack(state: EditorStack) {
    return produce(state, draft => {
        const focusKey = draft.jumpList.pop();
        if (focusKey == null) {
            draft.focus = 0;
        } else {
            const nextIndex = draft.stack.findIndex(x => x.key === focusKey);
            draft.focus = nextIndex < 0 ? 0 : nextIndex;
        }
    });
}

function closeEditor(state: EditorStack, index: number) {
    return produce(state, draft => {
        draft.jumpList = draft.jumpList.filter(x => x !== draft.stack[index].key);
        draft.stack = removeIndex(draft.stack, index);
    });
}

function moveFocus(state: EditorStack, move: 1 | -1) {
    return produce(state, draft => {
        if (draft.focus == null) {
            draft.focus = move === 1 ? 0 : draft.stack.length - 1;
        } else {
            draft.focus = mod(draft.focus + move, draft.stack.length);
        }
    });
}

//TODO: This hook's function change like crazy with focus, re-rendering the whole app. Fix it.
export default function useEditorStack() {
    const workspace = assertSome(useContext(Workspace));
    const [editors, setEditors] = useState<EditorStack>(() => ({
        jumpList: [],
        stack: [
            { name: "Hello-World", key: GlobalEditorId++, type: "user" },
            { name: "Sample-1", key: GlobalEditorId++, type: "user" },
            { name: "Sample-2", key: GlobalEditorId++, type: "user" },
        ],
        focus: 0,
    }));
    // This is needed because React freezes the state, so it cannot contain refs. This hooks simply
    // syncs a map of refs with the existing editor-stack keys.
    const refs = useRefMap<EditorKey, HTMLDivElement>(editors.stack.map(x => x.key));

    return {
        ...editors,
        refs,
        createEditor(name: string) {
            setEditors(state => {
                workspace.ensureExists(name);
                return createAndFocusEditor(state, name);
            });
        },
        openEditor(index: number, name: string) {
            setEditors(state => {
                const existing = findNearestIndex(state.stack, index, x => x.name === name);
                if (existing == null) {
                    workspace.ensureExists(name);
                    return createAndFocusEditor(state, name);
                }
                return focusEditor(state, existing);
            });
        },
        closeEditor(index: number) {
            setEditors(state => closeEditor(state, index));
        },
        closeFocusedEditor() {
            setEditors(state =>
                state.focus == null ? state : jumpBack(closeEditor(state, state.focus)),
            );
        },
        focusEditor(index: number) {
            setEditors(state => focusEditor(state, index));
        },
        jumpBack() {
            setEditors(jumpBack);
        },
        moveFocus(move: 1 | -1) {
            setEditors(state => moveFocus(state, move));
        },
    };
}
