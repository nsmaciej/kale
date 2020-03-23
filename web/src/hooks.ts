import React, { MutableRefObject, useContext, useEffect, useRef, useState } from "react";

import { assertSome } from "utils";
import DragAndDrop, { DropListener } from "contexts/drag_and_drop";
import { Rect } from "geometry";
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
    useDocumentEvent("wheel", preventDefault, { passive: false });
    useDocumentEvent("touchmove", preventDefault, { passive: false });
}

export function useRefMap<K, T>(keys: Iterable<K>): ReadonlyMap<K, MutableRefObject<T>> {
    const refs = useRef<Map<K, MutableRefObject<T>>>(new Map());
    const keySet = new Set(keys);
    // Sync the refs with the keys.
    for (const refKey of refs.current.keys()) {
        if (!keySet.has(refKey)) {
            refs.current.delete(refKey);
        }
    }
    for (const key of keys) {
        if (!refs.current.has(key)) {
            refs.current.set(key, React.createRef() as MutableRefObject<T>);
        }
    }
    return refs.current;
}

export function useDocumentEvent<K extends keyof DocumentEventMap>(
    name: K,
    listener: (event: DocumentEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
) {
    useEffect(() => {
        document.addEventListener(name, listener, options);
        return () => document.removeEventListener(name, listener);
    }, [name, listener, options]);
}

function useDrop(listener: DropListener) {
    const dragAndDrop = assertSome(useContext(DragAndDrop));
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
                return "move";
            }
            return "reject";
        },
    });
    return lastContains;
}
