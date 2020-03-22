import { mod } from "utils";
import { Type, Value, Builtin, VmError, assertNumber } from "vm/types";

function rawBuiltin(
    args: (string | null)[],
    fn: (args: Value[]) => Value,
    help?: string,
): Value<Builtin> {
    return {
        type: Type.Builtin,
        value: { args, builtin: fn, help },
    };
}

function builtin<T extends unknown[]>(
    result: string,
    argTypes: (string | null)[],
    fn: (...rest: T) => unknown,
    help?: string,
): Value<Builtin> {
    return rawBuiltin(
        argTypes,
        args => ({ type: result, value: fn(...(args.map(x => x.value) as T)) }),
        help,
    );
}

const op = (fn: (a: number, b: number) => number, help: string) =>
    builtin(Type.Num, [Type.Num, Type.Num], fn, help);
const test = (fn: (a: number, b: number) => boolean, help: string) =>
    builtin(Type.Bool, [Type.Num, Type.Num], fn, help);
const typeTest = (type: string, help: string) =>
    rawBuiltin([null], args => ({ type: Type.Bool, value: args[0].type === type }), help);

// The return type depends on the value.
const atIndex = rawBuiltin(
    [Type.Num, null],
    args => {
        const [index, indexable] = args;
        if (indexable.type === Type.Text) {
            return { type: Type.Text, value: (indexable.value as string)[assertNumber(index)] };
        } else if (indexable.type === Type.List) {
            return (indexable.value as Value[])[assertNumber(index)];
        }
        throw new VmError(`${indexable.type} is not indexable`);
    },
    "Index a list or piece of text with a number",
);

// Keep each group sorted.
export default {
    // Numbers.
    "-": op((a, b) => a - b, "Subtracts a number from another"),
    "*": op((a, b) => a * b, "Multiplies two numbers together"),
    "/": op((a, b) => a / b, "Divides a number by another"),
    "%": op((a, b) => mod(a, b), "Takes a modulo of a number"),
    "+": op((a, b) => a + b, "Adds two numbers together"),

    // Number tests.
    "/=": test((a, b) => a !== b, "Check if two values are not strictly equal"),
    "<": test((a, b) => a < b, "Checks if one number is less than another"),
    "<=": test((a, b) => a <= b, "Checks if one number is less or equal to another"),
    "=": test((a, b) => a === b, "Checks if two values are strictly equal"),
    ">": test((a, b) => a > b, "Checks if one number is greater than another"),
    ">=": test((a, b) => a >= b, "Checks if one number is more or equal to another"),

    // Strings.
    Text: builtin(
        Type.Text,
        [Type.Text, Type.Text],
        (a: string, b: string) => a + b,
        "Joins two pieces of text together",
    ),

    // Type testing.
    "Is-list?": typeTest(Type.List, "Checks if a value is a list of values"),
    "Is-null?": typeTest(Type.Null, "Checks if a value is null"),
    "Is-number?": typeTest(Type.Num, "Checks if a value is a number"),
    "Is-text?": typeTest(Type.Text, "Checks if a value is a piece of text"),

    // Indexing.
    "@": atIndex,

    // Conversion.
    "Number->text": builtin(
        Type.Text,
        [Type.Num],
        (x: number) => x.toString(),
        "Convert a number to text",
    ),
    "Text->number": builtin(
        Type.Num,
        [Type.Text],
        (x: string) => parseInt(x),
        "Read a piece of a text as a number",
    ),

    // I/O.
    Print: builtin(
        Type.Null,
        [Type.Text],
        // eslint-disable-next-line no-console
        show => alert(show),
        "Show a message in the browser",
    ),

    // Functional programming.
    Id: rawBuiltin([null], x => x[0], "Returns whatever value is passed to it"),
    //TODO: Add call and something to retrive a Func/Builtin from the workspace by name.
} as { [name: string]: Value<Builtin> };
