import React, { useEffect, useRef, useCallback, useState, ReactNode, createContext } from "react";

import { idGenerator, assert } from "utils";
import { useRefMap, useWindowEvent } from "hooks";
import { builtinFunctions } from "vm/interpreter";

const editorKeyGenerator = idGenerator("editor");

export type EditorKey = ReturnType<typeof editorKeyGenerator>;

export interface OpenedEditor {
    type: "builtin" | "user";
    key: EditorKey;
    name: string;
}

/** This hook exposes a list of refs to be populated by each of the editors in a stack and a few
 * methods to manage this stack. It remembers the last focused editor, which might not reflect
 * the current document focus. */
// Focus actions that do not modify the stack should be implemented outside this hook.
function useEditorStack() {
    const [lastFocus, setLastFocus] = useState<EditorKey | null>(null);
    const [stack, setStack] = useState<OpenedEditor[]>([]);
    const jumpList = useRef<EditorKey[]>([]).current;
    // It would be way easier of this was state instead of refs, but actually this should be thought
    // of as dervied state from the browser's real focus.
    const futureFocus = useRef<EditorKey | null>(null);
    // This is needed because React freezes the state, so it cannot contain refs. This hooks simply
    // syncs a map of refs with the existing editor-stack keys.
    const refs = useRefMap<EditorKey, HTMLDivElement>(stack.map((x) => x.key));

    function findEditorKey(element: EventTarget | null) {
        for (const editor of stack) {
            if (refs.get(editor.key)?.current === element) {
                return editor.key;
            }
        }
        return null;
    }

    useWindowEvent("focusin", (event) => {
        const key = findEditorKey(event.target);
        if (key !== null) {
            jumpList.push(key);
            setLastFocus(key);
        }
    });

    /** Set the editor as last focused and mark it be focused. */
    function moveFocus(key: EditorKey) {
        setLastFocus(key);
        futureFocus.current = key;
    }

    const createEditor = useCallback((name: string) => {
        const key = editorKeyGenerator();
        const type = builtinFunctions.has(name) ? "builtin" : "user";
        setStack((current) => [{ type, key, name }, ...current]);
        moveFocus(key);
    }, []);

    const openEditor = useCallback(
        (name: string) => {
            const existing = stack.find((x) => x.name === name);
            if (existing == null) {
                createEditor(name);
            } else {
                refs.get(existing.key)?.current.focus();
            }
        },
        [stack, refs, createEditor],
    );

    const removeEditor = useCallback(
        (key: EditorKey) => {
            setStack((current) => current.filter((x) => x.key !== key));
            if (lastFocus === key) {
                if (jumpList.length) {
                    assert(jumpList.pop() === lastFocus);
                    moveFocus(jumpList[jumpList.length - 1] ?? null);
                } else if (stack.length) {
                    moveFocus(stack[0].key);
                } else {
                    setLastFocus(null);
                }
            }
        },
        [stack, lastFocus, jumpList],
    );

    const jumpBack = useCallback(() => {
        if (jumpList.length < 2) return; // The top of the jumpList always has the current editor.
        assert(jumpList.pop() === lastFocus);
        const nextFocus = jumpList[jumpList.length - 1];
        if (nextFocus !== undefined) {
            refs.get(nextFocus)?.current.focus();
        }
    }, [jumpList, lastFocus, refs]);

    // Refs should be populated now, set the focus to whatever we want it to be.
    useEffect(() => {
        if (futureFocus.current !== null) {
            refs.get(futureFocus.current)?.current.focus();
            futureFocus.current = null;
        }
    });

    // Makes it easier to test.
    useEffect(() => createEditor("Hello-World"), [createEditor]);

    return { openEditor, createEditor, removeEditor, jumpBack, lastFocus, stack, refs };
}

export type EditorStackContext = ReturnType<typeof useEditorStack>;

const EditorStack = createContext<EditorStackContext | null>(null);
export default EditorStack;

export function EditorStackProvider({ children }: { children: ReactNode }) {
    return <EditorStack.Provider value={useEditorStack()}>{children}</EditorStack.Provider>;
}
