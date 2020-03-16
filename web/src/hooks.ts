import React, { useState, useEffect } from "react";
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

type Index = number | null;
export function useIndex<T>(
    limit: number,
    value: Index,
): [Index, (x: React.SetStateAction<Index>) => void, (move: 1 | -1) => void] {
    const [counter, setCounter] = useState(value);
    return [
        counter,
        setCounter,
        (move: 1 | -1) => {
            setCounter(x => (x == null ? (move === 1 ? 0 : limit - 1) : mod(x + move, limit)));
        },
    ];
}
