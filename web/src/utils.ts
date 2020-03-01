export function assert(condition: any, message?: string): asserts condition {
    if (!condition) throw new Error(message);
}

export function assertSome<T>(value: Optional<T>): T {
    assert(value != null);
    return value;
}

// T or nullish. Can be checked using == null. See
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Equality_comparisons_and_sameness
export type Optional<T> = T | undefined | null;

export function filterMap<T, R>(array: readonly T[], predicate: (element: T) => Optional<R>) {
    const acc: R[] = [];
    for (const x of array) {
        const result = predicate(x);
        if (result != null) {
            acc.push(result);
        }
    }
    return acc;
}

export function arrayEquals<T>(lhs: readonly T[], rhs: readonly T[]) {
    return lhs.length === rhs.length && lhs.every((x, i) => x === rhs[i]);
}

// Max of an empty list is 0.
export function max(list: readonly number[]) {
    return list.reduce((a, b) => Math.max(a, b), 0);
}

export function insertIndex<T>(array: readonly T[], ix: number, item: T): T[] {
    return array.slice(0, ix + 1).concat(item, array.slice(ix + 1));
}

export function removeIndex<T>(array: readonly T[], ix: number): T[] {
    return array.slice(0, ix).concat(array.slice(ix + 1));
}

export function replaceIndex<T>(array: readonly T[], ix: number, item: T): T[] {
    const r = array.slice();
    r[ix] = item;
    return r;
}

export function partition<T>(array: readonly T[], test: (value: T) => boolean): [T[], T[]] {
    const left = [];
    const right = [];
    for (const x of array) {
        if (test(x)) left.push(x);
        else right.push(x);
    }
    return [left, right];
}
