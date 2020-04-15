import { mod } from "utils";
import { Type, Value, Builtin, VmError, assertNumber, Category } from "vm/types";

function rawBuiltin(
    args: (string | null)[],
    fn: (args: Value[]) => Value,
    category?: Category,
    help?: string,
): Value<Builtin> {
    return {
        type: Type.Builtin,
        value: { args, builtin: fn, help, category },
    };
}

function builtin<T extends unknown[]>(
    result: string,
    argTypes: (string | null)[],
    fn: (...rest: T) => unknown,
    category?: Category,
    help?: string,
): Value<Builtin> {
    return rawBuiltin(
        argTypes,
        (args) => ({ type: result, value: fn(...(args.map((x) => x.value) as T)) }),
        category,
        help,
    );
}

const op = (fn: (a: number, b: number) => number, help: string) =>
    builtin(Type.Num, [Type.Num, Type.Num], fn, Category.Maths, help);
const test = (fn: (a: number, b: number) => boolean, help: string) =>
    builtin(Type.Bool, [Type.Num, Type.Num], fn, Category.Maths, help);
const typeTest = (type: string, help: string) =>
    rawBuiltin(
        [null],
        (args) => ({ type: Type.Bool, value: args[0].type === type }),
        Category.Types,
        help,
    );

// The return type depends on the value.
const atIndex = rawBuiltin(
    [Type.Num, null],
    (args) => {
        const [index, indexable] = args;
        if (indexable.type === Type.Text) {
            return { type: Type.Text, value: (indexable.value as string)[assertNumber(index)] };
        } else if (indexable.type === Type.List) {
            return (indexable.value as Value[])[assertNumber(index)];
        }
        throw new VmError(`${indexable.type} is not indexable`);
    },
    Category.Lists,
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
        Category.Text,
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
    "Number->Text": builtin(
        Type.Text,
        [Type.Num],
        (x: number) => x.toString(),
        Category.Types,
        "Convert a number to text",
    ),
    "Text->Number": builtin(
        Type.Num,
        [Type.Text],
        (x: string) => parseInt(x),
        Category.Types,
        "Read a piece of a text as a number",
    ),

    // I/O.
    Print: rawBuiltin(
        [null],
        // eslint-disable-next-line no-console
        (args) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            alert((args[0].value as any).toString());
            return { type: Type.Null, value: null };
        },
        Category.General,
        "Show a message in the browser",
    ),

    // Functional programming.
    Id: rawBuiltin(
        [null],
        (x) => x[0],
        Category.Functions,
        "Returns whatever value is passed to it",
    ),
    //TODO: Add call and something to retrive a Func/Builtin from the workspace by name.
} as { [name: string]: Value<Builtin> };
