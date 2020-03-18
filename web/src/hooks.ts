import React, { useState, useEffect, useLayoutEffect, MutableRefObject, useRef } from "react";

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

export function useDisableScrolling() {
    useLayoutEffect(() => {
        const preventDefault = (e: Event) => e.preventDefault();
        window.addEventListener("wheel", preventDefault, { passive: false });
        window.addEventListener("touchmove", preventDefault, { passive: false });
        return () => {
            window.removeEventListener("wheel", preventDefault);
            window.removeEventListener("touchmove", preventDefault);
        };
    });
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
