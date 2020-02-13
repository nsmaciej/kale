export function assert(condition: any, message?: string): asserts condition {
    if (!condition) throw new Error(message);
}

// Max of an empty list is 0.
export function max(list: number[]): number {
    return list.reduce((a, b) => Math.max(a, b), 0);
}
