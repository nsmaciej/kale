import { useReducer, useEffect } from "react";
import produce from "immer";

import { mod, createReducer, idGenerator } from "utils";
import { useRefMap, useDocumentEvent } from "hooks";
import { builtinFunctions } from "vm/interpreter";

const editorKeyGenerator = idGenerator("editor");
export type EditorKey = ReturnType<typeof editorKeyGenerator>;

function focusEditor(state: EditorStack, key: EditorKey | null): EditorStack {
    if (state.focus === key) {
        return state;
    }
    return produce(state, (draft) => {
        if (key !== null) {
            // Do not push duplicate editors onto the jump-list.
            if (!draft.jumpList.length || draft.jumpList[draft.jumpList.length - 1] !== key) {
                draft.jumpList.push(key);
            }
        }
        draft.focus = key;
    });
}

function createAndFocusEditor(state: EditorStack, name: string): EditorStack {
    const key = editorKeyGenerator();
    const type = builtinFunctions.has(name) ? "builtin" : "user";
    const updated = produce(state, (draft) => {
        draft.stack.unshift({ name, key, type });
    });
    return focusEditor(updated, key);
}

function jumpBack(state: EditorStack) {
    // Find the first editor different from the current focus. There is always at least one
    // editor on the stack (and it's the currently focused one).
    if (state.jumpList.length < 2) {
        return state;
    }
    return produce(state, (draft) => {
        draft.jumpList.pop();
        while (draft.jumpList.length) {
            const focus = draft.jumpList[draft.jumpList.length - 1];
            if (focus !== draft.focus) {
                draft.focus = focus ?? null;
                break;
            }
            draft.jumpList.pop();
        }
    });
}

function closeEditor(state: EditorStack, key: EditorKey) {
    return produce(state, (draft) => {
        draft.jumpList = draft.jumpList.filter((x) => x !== key);
        draft.stack = draft.stack.filter((x) => x.key !== key);
        if (!draft.stack.length) {
            draft.focus = null;
        }
    });
}

export type EditorStackActions =
    | { type: "createEditor"; name: string }
    | { type: "openEditor"; name: string }
    | { type: "closeEditor"; key: EditorKey }
    | { type: "closeFocusedEditor" }
    | { type: "focusEditor"; key: EditorKey | null }
    | { type: "jumpBack" }
    | { type: "moveFocus"; move: 1 | -1 };

const editorStackReducer = createReducer<EditorStack, EditorStackActions>({
    createEditor(state, { name }) {
        return createAndFocusEditor(state, name);
    },
    openEditor(state, { name }) {
        const existing = state.stack.find((x) => x.name === name);
        if (existing == null) {
            return createAndFocusEditor(state, name);
        }
        return focusEditor(state, existing.key);
    },
    closeEditor(state, { key }) {
        return closeEditor(state, key);
    },
    closeFocusedEditor(state) {
        return state.focus == null ? state : jumpBack(closeEditor(state, state.focus));
    },
    focusEditor(state, { key }) {
        return focusEditor(state, key);
    },
    jumpBack(state) {
        return jumpBack(state);
    },
    moveFocus(state, { move }) {
        return produce(state, (draft) => {
            if (draft.focus == null) {
                draft.focus = draft.stack[move === 1 ? 0 : draft.stack.length - 1]?.key;
            } else {
                const index = draft.stack.findIndex((x) => x.key === draft.focus);
                const nextIndex = mod(index + move, draft.stack.length);
                draft.focus = draft.stack[nextIndex].key;
            }
        });
    },
});

export interface OpenedEditor {
    type: "builtin" | "user";
    key: EditorKey;
    name: string;
}

interface EditorStack {
    // The current editor is always on the top of the JumpList.
    jumpList: readonly EditorKey[];
    stack: readonly OpenedEditor[];
    focus: EditorKey | null;
}

export default function useEditorStack() {
    const [state, dispatch] = useReducer(editorStackReducer, {
        jumpList: [],
        stack: [],
        focus: null,
    });

    // This is needed because React freezes the state, so it cannot contain refs. This hooks simply
    // syncs a map of refs with the existing editor-stack keys.
    const refs = useRefMap<EditorKey, HTMLDivElement>(state.stack.map((x) => x.key));

    function findEditorKey(element: EventTarget | null) {
        for (const editor of state.stack) {
            if (refs.get(editor.key)?.current === element) {
                return editor.key;
            }
        }
        return null;
    }

    // Here be dragons: focus managment logic.
    useDocumentEvent("focusout", (event) => {
        // Set focus to null if focusing-out out of an editor. This is useful to blur the editor
        // when the entire window loses focus. (Since focus-in does not fire then)
        if (findEditorKey(event.target) !== null) {
            dispatch({ type: "focusEditor", key: null });
        }
    });
    useDocumentEvent("focusin", (event) => {
        dispatch({ type: "focusEditor", key: findEditorKey(event.target) });
    });
    useEffect(() => {
        // Beware, focus logic relies on being cosistant, if for any reason the focus state
        // does not match the element being focused, a horrible infinite loop might occur.
        if (state.focus != null) {
            refs.get(state.focus)?.current?.focus();
        }
    }, [state.focus, state.stack, refs]);

    // Makes it easier to test.
    useEffect(() => dispatch({ type: "createEditor", name: "Hello-World" }), []);

    return {
        ...state,
        dispatch,
        refs,
    };
}
