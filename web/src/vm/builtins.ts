import { mod } from "utils";
import { Type, Value, Builtin, VmError, assertNumber } from "vm/types";

function builtin<T extends unknown[]>(
    result: string,
    argTypes: (string | null)[],
    fn: (...rest: T) => unknown,
    help?: string,
): Value<Builtin> {
    return {
        type: Type.Builtin,
        value: {
            args: argTypes,
            builtin: (...args) => ({ type: result, value: fn(...(args.map(x => x.value) as T)) }),
            help,
        },
    };
}

const op = (fn: (a: number, b: number) => number, help: string) =>
    builtin(Type.Num, [Type.Num, Type.Num], fn, help);
const test = (fn: (a: number, b: number) => boolean, help: string) =>
    builtin(Type.Bool, [Type.Num, Type.Num], fn, help);

// Cannot use builtin here because it hides the type from us.
function typeTest(type: string, help: string): Value<Builtin> {
    return {
        type: Type.Builtin,
        value: {
            args: [null],
            builtin: (value: Value) => ({ type: Type.Bool, value: value.type === type }),
            help,
        },
    };
}

// The return type depends on the value.
const atIndex: Value<Builtin> = {
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
        help: "Index a list or piece of text with a number",
    },
};

export default {
    // Numbers.
    "+": op((a, b) => a + b, "Adds two numbers together"),
    "-": op((a, b) => a - b, "Subtracts a number from another"),
    "*": op((a, b) => a * b, "Multiplies two numbers together"),
    "/": op((a, b) => a / b, "Divides a number by another"),
    "%": op((a, b) => mod(a, b), "Takes a modulo of a number"),

    // Number tests.
    "=": test((a, b) => a === b, "Checks if two values are strictly equal"),
    "/=": test((a, b) => a !== b, "Check if two values are not stricly equal"),
    "<": test((a, b) => a < b, "Checks if one number is less than another"),
    ">": test((a, b) => a > b, "Checks if one number is greater than another"),
    "<=": test((a, b) => a <= b, "Checks if one number is less or equal to another"),
    ">=": test((a, b) => a >= b, "Checks if one number is more or equal to another"),

    // Strings.
    "++": builtin(
        Type.Str,
        [Type.Str, Type.Str],
        (a: string, b: string) => a + b,
        "Joins two pieces of text together",
    ),

    // Type testing.
    "is-null?": typeTest(Type.Null, "Checks if a value is null"),
    "is-text?": typeTest(Type.Str, "Checks if a value is a piece of text"),
    "is-number?": typeTest(Type.Num, "Checks if a value is a number"),
    "is-list?": typeTest(Type.List, "Checks if a value is a list of values"),

    // Indexing.
    "@": atIndex,

    // Conversion.
    "number->text": builtin(
        Type.Str,
        [Type.Num],
        (x: number) => x.toString(),
        "Convert a number to text",
    ),
    "text->number": builtin(
        Type.Num,
        [Type.Str],
        (x: string) => parseInt(x),
        "Read a piece of a text as a number",
    ),

    // I/O.
    print: builtin(
        Type.Null,
        [Type.Str],
        show => console.log(show),
        "Prints a piece of text to the browser's console",
    ),
} as { [name: string]: Value<Builtin> };
