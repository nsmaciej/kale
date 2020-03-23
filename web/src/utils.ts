// T or nullish. Can be checked using == null. See
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Equality_comparisons_and_sameness
export type Optional<T> = T | undefined | null;

export function assert(condition: unknown, message?: string): asserts condition {
    if (!condition) throw new Error(message);
}

export function assertSome<T>(value: Optional<T>, message?: string): T {
    assert(value != null, message);
    return value;
}

export function assertFound(index: number): number {
    assert(index >= 0, "Search returned -1");
    return index;
}

export function filterMap<T, R>(array: readonly T[], predicate: (element: T) => Optional<R>): R[] {
    const acc: R[] = [];
    for (const x of array) {
        const result = predicate(x);
        if (result != null) {
            acc.push(result);
        }
    }
    return acc;
}

export function arrayEquals<T>(lhs: readonly T[], rhs: readonly T[]): boolean {
    return lhs.length === rhs.length && lhs.every((x, i) => x === rhs[i]);
}

// Max of an empty list is 0.
export function max(list: readonly number[]): number {
    return list.reduce((a, b) => Math.max(a, b), 0);
}

export function removeIndex<T>(array: readonly T[], ix: number): T[] {
    return array.slice(0, ix).concat(array.slice(ix + 1));
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

export function mod(n: number, m: number): number {
    return ((n % m) + m) % m;
}

export function reverseObject(obj: { [key: string]: string }): { [value: string]: string } {
    const reversed = {} as { [value: string]: string };
    for (const key in obj) {
        reversed[obj[key]] = key;
    }
    return reversed;
}

export function delay(timeout: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, timeout));
}

export async function asyncForEach<T>(
    array: T[],
    callback: (x: T, index: number) => Promise<void>,
) {
    for (let index = 0; index < array.length; index++) {
        await callback(array[index], index);
    }
}

export function insertSibling<T>(
    array: readonly T[],
    predicate: (item: T) => boolean,
    value: T,
    after: boolean,
): readonly T[] {
    const index = array.findIndex(predicate);
    if (index >= 0) {
        return [...array.slice(0, index + +after), value, ...array.slice(index + +after)];
    }
    return array;
}

export function createReducer<
    State,
    Actions extends { type: string },
    Types extends string = Actions["type"]
>(
    reducers: {
        [type in Types]: (state: State, type: Extract<Actions, { type: type }>) => State;
    },
): (state: State, action: Actions) => State {
    return (state, action) =>
        reducers[action.type as Types](state, action as Extract<Actions, { type: Types }>);
}

export function findNearestIndex<T>(
    list: readonly T[],
    index: number,
    predicate: (item: T) => boolean,
): number | null {
    for (let i = index; i >= 0; --i) {
        if (predicate(list[i])) return i;
    }
    for (let i = index + 1; i < list.length; ++i) {
        if (predicate(list[i])) return i;
    }
    return null;
}
