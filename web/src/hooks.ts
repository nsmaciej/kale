import React, { MutableRefObject, useContext, useEffect, useRef, useState, Context } from "react";

import { assert } from "utils";
import { Rect } from "geometry";
import DragAndDrop, { DropListener } from "contexts/drag_and_drop";
import Expr from "expr";

export function useDebounce<T>(value: T, delayMs: number): T {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delayMs);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delayMs]);
    return debouncedValue;
}

export function useDisableScrolling(): void {
    const preventDefault = (e: Event) => e.preventDefault();
    useWindowEvent("wheel", preventDefault, { passive: false });
    useWindowEvent("touchmove", preventDefault, { passive: false });
}

export function useRefMap<K, T>(keys: Iterable<K>): ReadonlyMap<K, MutableRefObject<T>> {
    const keySet = new Set(keys);
    const refs = useRef<Map<K, MutableRefObject<T>>>(new Map());
    // Sync the refs with the keys.
    for (const refKey of refs.current.keys()) {
        if (!keySet.has(refKey)) {
            refs.current.delete(refKey);
        }
    }
    for (const key of keySet) {
        if (!refs.current.has(key)) {
            refs.current.set(key, React.createRef() as MutableRefObject<T>);
        }
    }
    return refs.current;
}

export function useWindowEvent<K extends keyof WindowEventMap>(
    name: K,
    listener: (event: WindowEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
): void {
    useEffect(() => {
        window.addEventListener(name, listener, options);
        return () => window.removeEventListener(name, listener);
    }, [name, listener, options]);
}

export function useDrop(listener: DropListener): void {
    const dragAndDrop = useContextChecked(DragAndDrop);
    useEffect(() => {
        dragAndDrop.addListener(listener);
        return () => dragAndDrop.removeListener(listener);
    }, [dragAndDrop, listener]);
}

export function useSimpleDrop(
    ref: React.RefObject<HTMLElement>,
    onDrop: (expr: Expr) => void,
): boolean {
    const [lastContains, setLastContains] = useState(false);
    function getRect() {
        const clientRect = ref.current?.getBoundingClientRect();
        return clientRect === undefined ? null : Rect.fromBoundingRect(clientRect);
    }
    useDrop({
        dragUpdate(point) {
            const contains = (point !== null && getRect()?.contains(point)) ?? false;
            setLastContains(contains);
        },
        acceptDrop(point, expr) {
            if (getRect()?.contains(point)) {
                onDrop(expr);
                return true;
            }
            return false;
        },
    });
    return lastContains;
}

export function useMediaQuery(query: string): boolean {
    const [value, setValue] = useState<boolean | null>(null);
    const queryList = window.matchMedia(query);
    useEffect(() => {
        queryList.addListener((e) => setValue(e.matches));
    });
    return value ?? queryList.matches;
}

export function usePersistedState<T extends string>(
    key: string,
    defaultValue: T,
): [T, (value: T) => void] {
    const [state, setState] = useState(localStorage.getItem(key) ?? defaultValue);
    useEffect(() => {
        localStorage.setItem(key, state);
    }, [key, state]);
    return [state as T, setState];
}

export function useContextChecked<T>(context: Context<T | null>): T {
    const value = useContext(context);
    assert(value !== null, "No context provided");
    return value;
}

let modifierKeyDown = false;
const modifierKeyListeners = new Set<() => void>();
// The best modifier key for the current platform.
const modifierKey = navigator.platform.includes("Mac") ? "Alt" : "Control";
window.addEventListener("keydown", (e) => {
    if (e.key === modifierKey) modifierKeyDown = true;
    modifierKeyListeners.forEach((x) => x());
});
window.addEventListener("keyup", (e) => {
    if (e.key === modifierKey) modifierKeyDown = false;
    modifierKeyListeners.forEach((x) => x());
});

/** Check if the "platform modifier key" is being held down. Optionally recieving a callback when
 * the state changes. */
// This is sligthly complex because we want to detect the modifer key being pressed even before the
// component first mounts, hence the global state.
export function usePlatformModifierKey(): boolean {
    const [keyPressed, setKeyPressed] = useState(modifierKeyDown);
    useEffect(() => {
        const handle = () => {
            setKeyPressed(modifierKeyDown);
        };
        modifierKeyListeners.add(handle);
        return () => void modifierKeyListeners.delete(handle);
    }, []);
    return keyPressed;
}
