import { mod } from "utils";
import { Type, Value, Builtin, VmError, assertNumber } from "vm/types";

function builtin<T extends unknown[]>(
    result: string,
    argTypes: (string | null)[],
    fn: (...rest: T) => unknown,
): Value<Builtin> {
    return {
        type: Type.Builtin,
        value: {
            args: argTypes,
            builtin: (...args) => ({ type: result, value: fn(...(args.map(x => x.value) as T)) }),
        },
    };
}

const op = (fn: (a: number, b: number) => number) => builtin(Type.Num, [Type.Num, Type.Num], fn);
const test = (fn: (a: number, b: number) => boolean) =>
    builtin(Type.Bool, [Type.Num, Type.Num], fn);

function typeTest(type: string): Value<Builtin> {
    return {
        type: Type.Builtin,
        value: {
            args: [null],
            builtin: (value: Value) => ({ type: Type.Bool, value: value.type === type }),
        },
    };
}

const atIndex = {
    type: Type.Builtin,
    value: {
        args: [Type.Num, null],
        builtin(index, indexable) {
            if (indexable.type === Type.Str) {
                return {
                    type: Type.Str,
                    value: (indexable.value as string)[assertNumber(index)],
                };
            } else if (indexable.type === Type.List) {
                return (indexable.value as Value[])[assertNumber(index)];
            }
            throw new VmError(`${indexable.type} is not indexable`);
        },
    } as Builtin,
};

export default {
    // Numbers.
    "+": op((a, b) => a + b),
    "-": op((a, b) => a - b),
    "*": op((a, b) => a * b),
    "/": op((a, b) => a / b),
    "%": op((a, b) => mod(a, b)),
    // Number tests.
    "=": test((a, b) => a === b),
    "/=": test((a, b) => a !== b),
    "<": test((a, b) => a < b),
    ">": test((a, b) => a < b),
    // Strings.
    "++": builtin(Type.Str, [Type.Str, Type.Str], (a: string, b: string) => a + b),
    // Type testing.
    "is-null?": typeTest(Type.Null),
    "is-string?": typeTest(Type.Str),
    "is-number?": typeTest(Type.Num),
    "is-list?": typeTest(Type.List),
    // Indexing.
    "@": atIndex,
    // I/O.
    print: builtin(Type.Null, [Type.Str], show => console.log(show)),
} as { [name: string]: Value<Builtin> };
