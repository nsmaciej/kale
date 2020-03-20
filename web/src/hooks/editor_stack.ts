import { useReducer, useEffect } from "react";
import produce from "immer";

import { removeIndex, mod, createReducer, findNearestIndex } from "utils";
import { useRefMap } from "hooks";
import { builtinFunctions } from "vm/interpreter";

let GlobalEditorId = 1;

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
        if (!draft.stack.length) {
            draft.focus = null;
        }
    });
}

export type EditorStackActions =
    | { type: "createEditor"; name: string }
    | { type: "openEditor"; index: number; name: string }
    | { type: "closeEditor"; index: number }
    | { type: "closeFocusedEditor" }
    | { type: "focusEditor"; index: number | null }
    | { type: "jumpBack" }
    | { type: "moveFocus"; move: 1 | -1 };

const editorStackReducer = createReducer<EditorStack, EditorStackActions>({
    createEditor(state, { name }) {
        return createAndFocusEditor(state, name);
    },
    openEditor(state, { index, name }) {
        const existing = findNearestIndex(state.stack, index, x => x.name === name);
        if (existing == null) {
            return createAndFocusEditor(state, name);
        }
        return focusEditor(state, existing);
    },
    closeEditor(state, { index }) {
        return closeEditor(state, index);
    },
    closeFocusedEditor(state) {
        return state.focus == null ? state : jumpBack(closeEditor(state, state.focus));
    },
    focusEditor(state, { index }) {
        return focusEditor(state, index);
    },
    jumpBack(state) {
        return jumpBack(state);
    },
    moveFocus(state, { move }) {
        return produce(state, draft => {
            if (draft.focus == null) {
                draft.focus = move === 1 ? 0 : draft.stack.length - 1;
            } else {
                draft.focus = mod(draft.focus + move, draft.stack.length);
            }
        });
    },
});

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

export default function useEditorStack() {
    const [state, dispatch] = useReducer(editorStackReducer, {
        jumpList: [],
        stack: [],
        focus: null,
    });
    // Makes it easier to test.
    useEffect(() => dispatch({ type: "createEditor", name: "Hello-World" }), []);
    // This is needed because React freezes the state, so it cannot contain refs. This hooks simply
    // syncs a map of refs with the existing editor-stack keys.
    const refs = useRefMap<EditorKey, HTMLDivElement>(state.stack.map(x => x.key));
    return {
        ...state,
        dispatch,
        refs,
    };
}
