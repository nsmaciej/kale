import React, { RefObject, useState, useEffect, useRef } from "react";
import { mod } from "utils";

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

export function useRefList<R>(list: { length: number }): RefObject<R>[] {
    const refList = useRef<RefObject<R>[]>([]);
    if (list.length !== refList.current.length) {
        refList.current = new Array(list.length).fill(null).map(() => React.createRef());
    }
    return refList.current;
}

type Index = number | null;
export function useIndex<T>(
    limit: number,
    value: Index,
): [Index, (x: Index) => void, (move: 1 | -1) => void] {
    const [counter, setCounter] = useState(value);
    return [
        counter,
        setCounter,
        (move: 1 | -1) => {
            setCounter(x => (x == null ? (move === 1 ? 0 : limit - 1) : mod(x + move, limit)));
        },
    ];
}
