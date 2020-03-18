import { useState, useEffect, useLayoutEffect } from "react";

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
