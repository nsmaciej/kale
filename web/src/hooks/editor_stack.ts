import React, { useState } from "react";

import { removeIndex, mod } from "utils";
import { OpenedEditor } from "components/editor_list";
import produce from "immer";

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

interface EditorStack {
    jumpList: readonly number[];
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
        draft.stack.push({ name, key: GlobalEditorId++, ref: React.createRef() });
    });
    return focusEditor(updated, updated.stack.length - 1);
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

export default function useEditorStack() {
    const [editors, setEditors] = useState<EditorStack>(() => ({
        jumpList: [],
        stack: [
            { name: "Hello-World", key: GlobalEditorId++, ref: React.createRef() },
            { name: "Sample-1", key: GlobalEditorId++, ref: React.createRef() },
            { name: "Sample-2", key: GlobalEditorId++, ref: React.createRef() },
        ],
        focus: 0,
    }));

    return {
        ...editors,
        createEditor(name: string) {
            setEditors(state => createAndFocusEditor(state, name));
        },
        openEditor(index: number, name: string) {
            setEditors(state => {
                const existing = findNearestIndex(state.stack, index, x => x.name === name);
                return existing == null
                    ? createAndFocusEditor(state, name)
                    : focusEditor(state, existing);
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
