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

/** Map an array, removing any results which aqual null or undefined. */
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

/** Returns the maximum number if a list of numbers, returning 0 if empty. */
export function max(list: readonly number[]): number {
    return list.reduce((a, b) => Math.max(a, b), 0);
}

/* Partitions the array into two halves, one meeting the `test` and one that does not */
export function partition<T>(array: readonly T[], test: (value: T) => boolean): [T[], T[]] {
    const left = [];
    const right = [];
    for (const x of array) {
        if (test(x)) left.push(x);
        else right.push(x);
    }
    return [left, right];
}

/** Real mode function. */
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

export function groupEntries<K extends string | number | symbol, V>(
    entries: readonly [K, V][],
): { [k in K]: V[] } {
    const result = {} as { [k in K]: V[] };
    for (const [k, v] of entries) {
        if (!Object.prototype.hasOwnProperty.call(result, k)) {
            result[k] = [];
        }
        result[k].push(v);
    }
    return result;
}

/** Returns a promise that delays the execution by `timeout` miliseconds. */
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

/** Inserts a `value` next to or before the first element matching the `predicate`. */
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

/** Handy reducer transformer that logs the reducer state and actions. */
export function loggingReducer<S, A>(
    reducer: (state: S, action: A) => S,
    // eslint-disable-next-line no-console
    logger: (state: S, action: A) => void = console.log,
): typeof reducer {
    return (state, action) => {
        logger(state, action);
        return reducer(state, action);
    };
}

/** This is an alternative to React.createRef, which produces readonly ref objects. */
export function makeMutableRef<T>(): { current: T | null } {
    return { current: null };
}

/** Creates a function that when called returns unique (and debuggable) symbols. Using symbols means
 * that the IDs work with immer, but do not coerce to strings or numbers */
export function idGenerator(name: string): () => symbol {
    let id = 0;
    return () => Symbol(`${name}-${id++}`);
}

/** Returns the best modifier key for the current platform. */
export function platformModifierKey(): "Alt" | "Control" {
    if (navigator.platform.includes("Mac")) return "Alt";
    return "Control";
}

/** Returns if the event has a modifier key that should not be handled. Pass through single presses
 * of the platform modifier key. */
export function hasUnwantedMoidiferKeys(event: {
    key: string;
    altKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
}): boolean {
    if (event.metaKey) return true;
    switch (platformModifierKey()) {
        case "Alt":
            if (event.ctrlKey) return true;
            if (event.altKey) return event.key !== "Alt";
            return false;
        case "Control":
            if (event.altKey) return true;
            if (event.ctrlKey) return event.key !== "Control";
            return false;
    }
}
